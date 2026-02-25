from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from typing import Iterable

import pandas as pd

from accounting.models import FoodicsPaymentCategory, FoodicsPaymentRecord


class ParseError(Exception):
    """Raised when Excel data fails strict validation (e.g. missing Branch Code)."""
    def __init__(self, message: str, row_num: int | None = None, col_name: str | None = None):
        self.row_num = row_num
        self.col_name = col_name
        super().__init__(message)


from imports.models import DailySale, ExcelReportType, HourlySale, ProductSale
from imports.smart_parser import detect_brand_from_filename
from org.models import Brand, Branch, City


def _default_city():
    city = City.objects.first()
    if city is None:
        city = City.objects.create(name_en="Unspecified", code="unspecified", name_ar="")
    return city


@dataclass
class ParsedMeta:
    date_from: date | None
    date_to: date | None
    new_products_count: int = 0  # [Ref: 134505] Product auto-discovery


# 8OZ Branch name mappings (English <-> Arabic) for auto-mapping
BRANCH_NAME_AR = {
    "al-roseifa": "الرصيفة",
    "al-rosifa": "الرصيفة",
    "al-rusaifah": "الرصيفة",
    "rusaifah": "الرصيفة",
    "roseifa": "الرصيفة",
    "الرصيفة": "الرصيفة",
    "al-awali": "العوالي",
    "alawali": "العوالي",
    "makkah-al-awali": "مكة العوالي",
    "makkah-alawali": "مكة العوالي",
    "العوالي": "العوالي",
    "kiosk al-awali": "كشك العوالي",
    "kiosk al-awaly": "كشك العوالي",
    "كشك العوالي": "كشك العوالي",
    "al-sharai": "الشرائع",
    "alsharai": "الشرائع",
    "الشرائع": "الشرائع",
    "fourth ring": "الدائري الرابع",
    "4th ring": "الدائري الرابع",
    "الدائري الرابع": "الدائري الرابع",
    "al-buhairat": "البحيرات",
    "albuhairat": "البحيرات",
    "البحيرات": "البحيرات",
}

# Column mapping: English + Arabic headers (Foodics exports in KSA may use Arabic)
# 8OZ Jan 2026 / Foodics exports: auto-discover column names
BRAND_COLS = ["Brand", "العلامة التجارية", "الماركة"]
BRANCH_COLS = ["Branch", "الفرع"]
BRANCH_REF_COLS = ["Branch Reference", "مرجع الفرع", "كود الفرع"]
DATE_COLS = ["Day", "يوم", "التاريخ"]
DATE_CONTAINS = ["day", "يوم"]
HOUR_COLS = ["Hour", "Time", "hour", "الوقت", "الساعة"]
# MAIN: Net Sales only. Never Gross Sales.
# [Ref: 981,459.30 SAR - Column L صافي المبيعات only, never إجمالي or gross]
NET_SALES_COLS = ["Net Sales", "صافي المبيعات"]

# [Ref: 135441, 161033] Product Sales: ONLY "Net Sales" or "صافي المبيعات". NEVER Gross Sales.
PRODUCT_SALES_ALLOWED_NORMALIZED = frozenset({
    "صافي المبيعات",
    "net sales",
})
PRODUCT_SALES_EXCLUDE = ["gross", "إجمالي", "total", "مع الضريبة"]
CASH_COLS = ["Cash", "Cash Amount", "نقد", "النقد"]
NETWORK_COLS = ["Network", "Card", "MADA", "VISA", "الشبكة", "بطاقات"]
TAX_COLS = ["Taxes", "الضرائب"]
DISCOUNT_COLS = ["Discount Amount", "مبلغ الخصم"]
# [Ref: 7bddb3, 866466] STRICT RULE: Order Count != Product Quantity
# عدد الطلبات / Order Count = transactions (use for Total Orders / إجمالي الطلبات)
# كمية المبيعات / Sales Quantity = items sold (NEVER use for order totals)
ORDER_COUNT_COLS = ["Order Count", "عدد الطلبات"]
ORDER_COUNT_CONTAINS = ["order count", "عدد الطلبات"]
AVG_ORDER_COLS = ["Average Order", "متوسط الطلب"]
RETURN_AMOUNT_COLS = ["Return Amount", "مبلغ الإرجاع"]
RETURN_QTY_COLS = ["Return Quantity", "كمية المرتجع"]
VOID_AMOUNT_COLS = ["Void Amount", "مبلغ الإلغاء"]
VOID_QTY_COLS = ["Void Quantity", "كمية الإلغاء"]
# Product Sales per Branch per Day [Ref: image_7bddb3]
PRODUCT_COLS = ["Product", "Item", "المنتج", "الصنف"]
SKU_COLS = ["SKU", "PLU", "Barcode", "كود تعريف المنتج"]
# Qty: صافي الكمية (net qty) or كمية المبيعات (sales quantity) - ITEMS SOLD, NOT ORDERS
QTY_COLS = ["Qty", "Quantity", "الكمية", "صافي الكمية", "كمية المبيعات"]

# [Ref: image_86561c] Payments Report: يوم, الفرع, طريقة الدفع, المبلغ الصافي
PAYMENTS_DATE_COLS = ["يوم", "Day", "التاريخ", "Date"]
PAYMENTS_BRANCH_COLS = ["الفرع", "Branch"]
PAYMENTS_METHOD_COLS = ["طريقة الدفع", "Payment Method"]
PAYMENTS_NET_AMOUNT_COLS = ["المبلغ الصافي", "Net Amount"]

# Payment method categorization: Cash/كاش, Span/سبان, Delivery Apps (تطبيق كيتا, Hanger Station CARD, Jahez, ToYou)
CASH_METHODS = frozenset({"cash", "كاش", "نقد", "النقد"})
SPAN_METHODS = frozenset({"span", "سبان", "سبان بي", "span pay"})
DELIVERY_APP_METHODS = frozenset({
    "تطبيق كيتا", "keta", "kita", "هانجر استيشن كارد", "hanger station card",
    "jahez", "جاهز", "toyou", "toyou delivery", "توي يو", "تطبيقات التوصيل",
})


def _scalar(ser, idx: int):
    """Safely extract scalar at index. Avoids 'truth value of Series is ambiguous'."""
    if ser is None:
        return None
    try:
        val = ser.iloc[idx]
        if isinstance(val, pd.Series):
            val = val.iloc[0] if len(val) else None
        if pd.isna(val):
            return None
        if hasattr(val, "item") and not isinstance(val, (str, bytes)):
            try:
                return val.item()
            except (ValueError, AttributeError):
                pass
        return val
    except (IndexError, KeyError, ValueError, TypeError):
        return None


def _parse_amount(val) -> Decimal:
    """[Ref: 134505] Strip currency symbols and convert to Decimal. Handles SAR, ر.س, etc."""
    if val is None:
        return Decimal("0")
    if isinstance(val, pd.Series):
        val = val.iloc[0] if len(val) else None
    if val is None:
        return Decimal("0")
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        try:
            return Decimal(str(val))
        except Exception:
            return Decimal("0")
    s = str(val).strip()
    if not s or s.lower() in ("nan", ""):
        return Decimal("0")
    for pat in [r"SAR\s*", r"SR\s*", r"USD\s*", r"\$\s*", r"€\s*", r"£\s*", r"ريال\s*", r"ر\.س\s*", r"ر.س\s*"]:
        s = re.sub(pat, "", s, flags=re.I)
    s = s.replace("،", "").replace(",", "").replace("\u202f", "").replace(" ", "").strip()
    if not s:
        return Decimal("0")
    try:
        return Decimal(s)
    except Exception:
        return Decimal("0")


# Month abbreviations for date normalization [Ref: 135441] Jan-26, JAN/2026 -> 2026-01-01
MONTH_ABBREV = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "يناير": 1, "فبراير": 2, "مارس": 3, "أبريل": 4, "مايو": 5, "يونيو": 6,
    "يوليو": 7, "أغسطس": 8, "سبتمبر": 9, "أكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12,
}

# Values that indicate a header row (Day/يوم column) - skip these rows
DATE_HEADER_VALUES = frozenset({
    "day", "يوم", "date", "التاريخ", "تاريخ", "time", "الوقت",
})


def _parse_date_cell(val) -> date | None:
    """
    Parse date from Excel cell. Handles: header labels (skip), Excel serial numbers,
    datetime objects, and standard date strings (e.g. 1/1/2026, 1-1-2026).
    Returns None for header-like values.
    """
    if val is None:
        return None
    if isinstance(val, pd.Series):
        val = val.iloc[0] if len(val) else None
    if val is None:
        return None
    if isinstance(val, date):
        return val if not isinstance(val, datetime) else val.date()
    s = str(val).strip()
    if not s or s.lower() in ("nan", ""):
        return None
    s_lower = s.lower().strip()
    if s_lower in DATE_HEADER_VALUES:
        return None
    # Explicit handling for M/D/YYYY or D/M/YYYY (e.g. 1/1/2026)
    if "/" in s or "-" in s:
        parts = re.split(r"[/\-]", s)
        nums = [p.strip() for p in parts if p.strip().isdigit()]
        if len(nums) >= 3:
            try:
                a, b, c = int(nums[0]), int(nums[1]), int(nums[2])
                # Assume DD/MM/YYYY or MM/DD/YYYY; try both
                for m, d, y in [(a, b, c), (b, a, c)]:
                    if 1 <= m <= 12 and 1 <= d <= 31 and y >= 1900:
                        return date(y, m, d)
            except (ValueError, TypeError):
                pass
    try:
        dt = pd.to_datetime(val, errors="coerce")
        if pd.isna(dt):
            return None
        return dt.date() if hasattr(dt, "date") else None
    except Exception:
        return None


def _normalize_product_sales_date(val) -> date | None:
    """
    [Ref: 135441] Convert Jan-26, JAN/2026, يناير 2026, etc. to date(2026, 1, 1).
    Returns None if not parseable.
    """
    if val is None:
        return None
    if isinstance(val, pd.Series):
        val = val.iloc[0] if len(val) else None
    if val is None:
        return None
    if isinstance(val, date):
        return val if not isinstance(val, datetime) else val.date()
    s = str(val).strip()
    if not s or s.lower() in ("nan", ""):
        return None
    if s.lower() in DATE_HEADER_VALUES:
        return None
    s_lower = s.lower().replace("/", "-").replace(".", "-").replace(" ", "-")
    parts = re.split(r"[-/\s]+", s_lower)
    year = None
    month = None
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if p.isdigit():
            y = int(p)
            if y < 100:
                year = 2000 + y if y < 50 else 1900 + y
            else:
                year = y
        elif p in MONTH_ABBREV:
            month = MONTH_ABBREV[p]
        elif len(p) >= 3:
            for k, v in MONTH_ABBREV.items():
                if k in p or p in k:
                    month = v
                    break
    if year and month:
        try:
            return date(year, month, 1)
        except (ValueError, TypeError):
            pass
    try:
        dt = pd.to_datetime(val, errors="coerce")
        if pd.isna(dt):
            return None
        return dt.date() if hasattr(dt, "date") else None
    except Exception:
        return None


# Summary/total row patterns to drop [Ref: 134505, 135441, 161033, 180508]
# Strictly skip Total, المجموع to ensure 981,459.30 (Column L صافي المبيعات only)
SUMMARY_ROW_PATTERNS = (
    "total", "grand total", "مجموع", "الإجمالي", "إجمالي", "اجمالي", "المجموع",
    "subtotal", "المجموع الفرعي", "sum", "total row", "صف الإجمالي",
)


def _is_summary_row(product_val, sku_val) -> bool:
    """Return True if row looks like a summary/total row and should be dropped."""
    if product_val is None and sku_val is None:
        return True
    for v in (product_val, sku_val):
        if v is None:
            continue
        s = str(v).strip().lower()
        if not s or s in ("nan", ""):
            continue
        for pat in SUMMARY_ROW_PATTERNS:
            if pat in s:
                return True
    return False


def _branch_or_brand_is_summary(branch_val, brand_val) -> bool:
    """[Ref: 135441] Skip row if Branch or Brand column contains Total or المجموع."""
    for v in (branch_val, brand_val):
        if v is None:
            continue
        s = str(v).strip().lower()
        if not s or s in ("nan", ""):
            continue
        if "total" in s or "المجموع" in s or "مجموع" in s:
            return True
    return False


def _cell_value(df: pd.DataFrame, col_name: str, idx: int):
    """Extract single scalar from cell. If col returns DataFrame (duplicates), take first col."""
    if col_name not in df.columns:
        return None
    try:
        col = df[col_name]
        if isinstance(col, pd.DataFrame):
            col = col.iloc[:, 0]
        val = col.iloc[idx]
        if isinstance(val, pd.Series):
            val = val.iloc[0] if len(val) else None
        if pd.isna(val):
            return None
        return val
    except (IndexError, KeyError, ValueError, TypeError):
        return None


def _normalize_header(h: str) -> str:
    """Lowercase, strip whitespace, collapse multiple spaces. Bulletproof for SAIF/Foodics."""
    if h is None:
        return ""
    s = str(h).strip().strip("\ufeff")
    return " ".join(s.lower().split())


def _build_header_lookup(df: pd.DataFrame) -> dict[str, str]:
    """Map normalized header -> actual column name. First occurrence wins."""
    lookup: dict[str, str] = {}
    for c in df.columns:
        norm = _normalize_header(str(c))
        if norm and norm not in lookup:
            lookup[norm] = str(c)
    return lookup


def _get_col_net_sales_only(df: pd.DataFrame) -> pd.Series | None:
    """
    [Ref: 135441, 161033] Product Sales: ONLY "Net Sales" (EN) or "صافي المبيعات" (AR).
    NEVER use Gross Sales - that causes 1,120,267 instead of 981,459.30.
    """
    lookup = _build_header_lookup(df)
    exclude_lower = [e.strip().lower() for e in PRODUCT_SALES_EXCLUDE if e]

    for norm_header, actual_col in lookup.items():
        # REJECT: Gross Sales, إجمالي, or any column containing exclude terms
        if any(ex in norm_header for ex in exclude_lower):
            continue
        # ACCEPT: ONLY exact "Net Sales" or "صافي المبيعات"
        if norm_header in PRODUCT_SALES_ALLOWED_NORMALIZED:
            col = df[actual_col]
            if isinstance(col, pd.DataFrame):
                col = col.iloc[:, 0]
            return col

    return None


def _get_col(
    df: pd.DataFrame,
    options: Iterable[str],
    required: bool = True,
    *,
    contains_match: bool = False,
    first_col_fallback: bool = False,
) -> pd.Series | None:
    """
    Flexible column matching: case-insensitive, space-agnostic.
    - contains_match: match if any option is a substring of the normalized header
    - first_col_fallback: if no match, use first column (emergency for Date in Foodics exports)
    """
    lookup = _build_header_lookup(df)
    opts_lower = [o.strip().lower() for o in options if o]

    # 1. Exact match (normalized)
    for opt in opts_lower:
        if opt in lookup:
            col = df[lookup[opt]]
            if isinstance(col, pd.DataFrame):
                col = col.iloc[:, 0]
            return col

    # 2. Contains match (e.g. "Net Sales" matches "gross sales amount")
    if contains_match:
        for norm_header, actual_col in lookup.items():
            for opt in opts_lower:
                if opt in norm_header:
                    col = df[actual_col]
                    if isinstance(col, pd.DataFrame):
                        col = col.iloc[:, 0]
                    return col

    # 3. First column fallback (Date/Day emergency)
    if first_col_fallback and len(df.columns) > 0:
        col = df.iloc[:, 0]
        return col

    if required:
        raise ValueError(f"Missing required column. Tried: {', '.join(options)}")
    return None


def _resolve_fallback_brand(brand: Brand | None, filename: str) -> Brand:
    """Get brand from param, filename, or create Unspecified."""
    if brand:
        return brand
    slug = detect_brand_from_filename(filename)
    if slug:
        name = slug.replace("-", " ").title()
        if slug == "8oz":
            name = "8OZ"
        elif slug in ("blanca", "hemi", "chart"):
            name = slug.upper()
        brand_obj, _ = Brand.objects.get_or_create(
            slug=slug, defaults={"name": name}
        )
        return brand_obj
    brand_obj, _ = Brand.objects.get_or_create(
        slug="unspecified", defaults={"name": "Unspecified"}
    )
    return brand_obj


def _resolve_branch_by_code(brand_obj: Brand, branch_code: str | None) -> Branch | None:
    """Resolve Branch by branch_code within brand. Returns None if not found or code empty."""
    if not branch_code or not str(branch_code).strip():
        return None
    code = str(branch_code).strip()
    return Branch.objects.filter(brand=brand_obj, branch_code=code).first()


def _resolve_fallback_branch(
    branch: Branch | None, brand_obj: Brand, default_name: str = "Main"
) -> Branch:
    """Get branch from param or create default for brand."""
    if branch:
        return branch
    code = f"{brand_obj.slug}-{default_name.lower().replace(' ', '-')}"
    branch_obj, _ = Branch.objects.get_or_create(
        brand=brand_obj,
        code=code[:120],
        defaults={"name": default_name, "city": _default_city()},
    )
    return branch_obj


def parse_hourly_sales(
    df: pd.DataFrame,
    upload,
    *,
    brand: Brand | None = None,
    branch: Branch | None = None,
    filename: str = "",
) -> ParsedMeta:
    """
    Expect Foodics-style Hourly Sales export (English or Arabic columns).
    Brand and Branch columns are OPTIONAL; use brand/branch params or filename fallback.
    """
    brand_col = _get_col(df, BRAND_COLS, required=False)
    branch_col = _get_col(df, BRANCH_COLS, required=False)
    date_col = _get_col(
        df, DATE_COLS + DATE_CONTAINS,
        contains_match=True, first_col_fallback=True
    )
    hour_col = _get_col(df, HOUR_COLS)
    total_col = _get_col(df, NET_SALES_COLS)
    cash_col = _get_col(df, CASH_COLS, required=False)
    network_col = _get_col(df, NETWORK_COLS, required=False)

    fallback_brand = _resolve_fallback_brand(brand, filename)

    rows: list[HourlySale] = []
    d_min: date | None = None
    d_max: date | None = None

    for idx in range(len(df)):
        br_val = _scalar(branch_col, idx)
        br_name = str(br_val).strip() if br_val is not None and str(br_val).strip().lower() != "nan" else ""
        b_val = _scalar(brand_col, idx)
        b_str = str(b_val).strip() if b_val is not None and str(b_val).strip().lower() not in ("nan", "") else ""
        if _branch_or_brand_is_summary(br_val, b_val):
            continue
        row_brand = brand if brand else (
            Brand.objects.get_or_create(name=(b_str or "Unspecified"))[0]
            if b_str
            else fallback_brand
        )

        if br_name:
            city = branch.city if branch else _default_city()
            code = br_name.lower().replace(" ", "-").replace("_", "-")[:120]
            code = "".join(c for c in code if c.isalnum() or c == "-")
            name_ar = BRANCH_NAME_AR.get(code) or BRANCH_NAME_AR.get(br_name.strip()) or ""
            branch_obj, created = Branch.objects.get_or_create(
                brand=row_brand,
                code=code or "branch",
                defaults={"name": br_name, "name_ar": name_ar, "city": city},
            )
            if not created and name_ar and not branch_obj.name_ar:
                branch_obj.name_ar = name_ar
                branch_obj.save(update_fields=["name_ar"])
        else:
            branch_obj = _resolve_fallback_branch(branch, row_brand, "Main")

        dt_raw = _scalar(date_col, idx)
        hr_raw = _scalar(hour_col, idx)
        dt_val = _parse_date_cell(dt_raw)
        if dt_val is None or hr_raw is None or pd.isna(hr_raw):
            continue
        try:
            hr_dt = pd.to_datetime(hr_raw, errors="coerce")
            hr_val = None if pd.isna(hr_dt) else hr_dt.time()
        except Exception:
            hr_val = None
        if hr_val is None:
            continue

        total = Decimal(str(_scalar(total_col, idx) or 0))
        cash = Decimal(str(_scalar(cash_col, idx) or 0))
        network = Decimal(str(_scalar(network_col, idx) or 0))

        rows.append(
            HourlySale(
                brand=row_brand,
                branch=branch_obj,
                date=dt_val,
                hour=hr_val,
                total_sales=total,
                cash_amount=cash,
                network_amount=network,
                upload=upload,
            )
        )

        d_min = dt_val if d_min is None or dt_val < d_min else d_min
        d_max = dt_val if d_max is None or dt_val > d_max else d_max

    # [Idempotency] Reject duplicate hourly sales for same branch+date+hour from other uploads
    if rows:
        triples = list({(r.branch_id, r.date, r.hour) for r in rows})
        for bid, d, h in triples:
            if HourlySale.objects.filter(branch_id=bid, date=d, hour=h).exclude(upload=upload).exists():
                from org.models import Branch
                br = Branch.objects.filter(pk=bid).first()
                name = br.name if br else str(bid)
                raise ParseError(
                    f"بيانات المبيعات بالساعة مكررة: يوجد بالفعل بيانات لـ {name} في {d} الساعة {h}"
                )

    HourlySale.objects.bulk_create(rows, batch_size=500)
    return ParsedMeta(date_from=d_min, date_to=d_max)


def parse_daily_sales(
    df: pd.DataFrame,
    upload,
    *,
    brand: Brand | None = None,
    branch: Branch | None = None,
    filename: str = "",
) -> ParsedMeta:
    """
    [Ref: 7bddb3, 873374] DAILY SALES REPORT (تقرير المبيعات اليومية) - ONLY source for:
    - Total Orders (إجمالي الطلبات): عدد الطلبات column.
    - Average Check (متوسط الفاتورة): متوسط الطلب column OR (Net Sales / Order Count).
    NO overlap with Payments Report. Brand and Branch columns OPTIONAL.
    """
    brand_col = _get_col(df, BRAND_COLS, required=False)
    branch_col = _get_col(df, BRANCH_COLS, required=False)
    branch_ref_col = _get_col(df, BRANCH_REF_COLS, required=False)
    date_col = _get_col(
        df, DATE_COLS + DATE_CONTAINS,
        contains_match=True, first_col_fallback=True
    )
    total_col = _get_col(df, NET_SALES_COLS)
    cash_col = _get_col(df, CASH_COLS, required=False)
    network_col = _get_col(df, NETWORK_COLS, required=False)
    order_col = _get_col(
        df, ORDER_COUNT_COLS + list(ORDER_COUNT_CONTAINS),
        required=False,
        contains_match=True,
    )
    # [Ref: 87b658] Explicit fallback: scan for عدد الطلبات / متوسط الطلب when auto-detect misses
    if order_col is None:
        for c in df.columns:
            s = str(c).strip()
            if "عدد" in s and "طلبات" in s:
                order_col = df[c]
                if isinstance(order_col, pd.DataFrame):
                    order_col = order_col.iloc[:, 0]
                break
    avg_order_col = _get_col(df, AVG_ORDER_COLS, required=False)
    if avg_order_col is None:
        for c in df.columns:
            s = str(c).strip()
            if "متوسط" in s and "الطلب" in s:
                avg_order_col = df[c]
                if isinstance(avg_order_col, pd.DataFrame):
                    avg_order_col = avg_order_col.iloc[:, 0]
                break

    fallback_brand = _resolve_fallback_brand(brand, filename)

    DailySale.objects.filter(upload=upload).delete()

    # [Idempotency] Collect (branch_id, date) from rows first for duplicate check
    rows: list[DailySale] = []
    d_min: date | None = None
    d_max: date | None = None
    first_branch_by_brand: dict[int, Branch] = {}

    for idx in range(len(df)):
        br_val = _scalar(branch_col, idx)
        br_name = str(br_val).strip() if br_val is not None and str(br_val).strip().lower() != "nan" else ""
        b_val = _scalar(brand_col, idx)
        b_str = str(b_val).strip() if b_val is not None and str(b_val).strip().lower() not in ("nan", "") else ""
        is_summary = _branch_or_brand_is_summary(br_val, b_val)

        row_brand = brand if brand else (
            Brand.objects.get_or_create(name=(b_str or "Unspecified"))[0]
            if b_str
            else fallback_brand
        )

        # [Ref: 35,985] Summary row (المجموع): capture order_count & average_order before skipping
        if is_summary and (order_col is not None or avg_order_col is not None):
            dt_raw = _scalar(date_col, idx)
            dt_val = _parse_date_cell(dt_raw)
            summary_date = dt_val if dt_val else d_max
            if summary_date and row_brand:
                order_raw = _scalar(order_col, idx)
                try:
                    order_cnt = int(float(order_raw)) if order_raw is not None else 0
                except (ValueError, TypeError):
                    order_cnt = 0
                avg_order_raw = _scalar(avg_order_col, idx) if avg_order_col is not None else None
                avg_order_val = None
                if avg_order_raw is not None:
                    try:
                        avg_order_val = _parse_amount(avg_order_raw)
                        if avg_order_val == Decimal("0"):
                            avg_order_val = None
                    except Exception:
                        pass
                if order_cnt > 0 or avg_order_val:
                    branch_obj = first_branch_by_brand.get(row_brand.id) or _resolve_fallback_branch(
                        branch, row_brand, "Main"
                    )
                    total = Decimal(str(_scalar(total_col, idx) or 0))
                    rows.append(
                        DailySale(
                            brand=row_brand,
                            branch=branch_obj,
                            date=summary_date,
                            total_sales=total,
                            cash_amount=Decimal("0"),
                            network_amount=Decimal("0"),
                            order_count=max(0, order_cnt),
                            average_order=avg_order_val,
                            upload=upload,
                        )
                    )
                    d_min = summary_date if d_min is None or summary_date < d_min else d_min
                    d_max = summary_date if d_max is None or summary_date > d_max else d_max
            continue

        if is_summary:
            continue

        # [Ref: STRICT] When Branch Code column exists, require it and resolve by code first
        branch_code_val = None
        if branch_ref_col is not None:
            branch_code_val = _scalar(branch_ref_col, idx)
            code_str = str(branch_code_val).strip() if branch_code_val is not None else ""
            if not code_str or code_str.lower() in ("nan", ""):
                col_name = getattr(branch_ref_col, "name", "Branch Reference") or "Branch Reference"
                raise ParseError(
                    f"Error at Row {idx + 2}, Column {col_name}: Missing Branch Code. Please verify your Excel data.",
                    row_num=idx + 2,
                    col_name=str(col_name),
                )

        branch_obj = None
        if branch_code_val and str(branch_code_val).strip():
            branch_obj = _resolve_branch_by_code(row_brand, str(branch_code_val).strip())
        if branch_obj is None and br_name:
            city = branch.city if branch else _default_city()
            code = br_name.lower().replace(" ", "-").replace("_", "-")[:120]
            code = "".join(c for c in code if c.isalnum() or c == "-")
            name_ar = BRANCH_NAME_AR.get(code) or BRANCH_NAME_AR.get(br_name.strip()) or ""
            branch_obj, created = Branch.objects.get_or_create(
                brand=row_brand,
                code=code or "branch",
                defaults={"name": br_name, "name_ar": name_ar, "city": city},
            )
            if not created and name_ar and not branch_obj.name_ar:
                branch_obj.name_ar = name_ar
                branch_obj.save(update_fields=["name_ar"])
        if branch_obj is None:
            branch_obj = _resolve_fallback_branch(branch, row_brand, "Main")
        first_branch_by_brand.setdefault(row_brand.id, branch_obj)

        dt_raw = _scalar(date_col, idx)
        dt_val = _parse_date_cell(dt_raw)
        if dt_val is None:
            continue

        total = Decimal(str(_scalar(total_col, idx) or 0))
        cash = Decimal(str(_scalar(cash_col, idx) or 0))
        network = Decimal(str(_scalar(network_col, idx) or 0))
        order_raw = _scalar(order_col, idx)
        try:
            order_cnt = int(float(order_raw)) if order_raw is not None else 0
        except (ValueError, TypeError):
            order_cnt = 0
        order_cnt = max(0, order_cnt)

        # [Ref: 7bddb3] Read متوسط الطلب directly from Excel - DO NOT calculate
        avg_order_raw = _scalar(avg_order_col, idx)
        avg_order_val = None
        if avg_order_raw is not None:
            try:
                avg_order_val = _parse_amount(avg_order_raw)
                if avg_order_val == Decimal("0"):
                    avg_order_val = None
            except Exception:
                pass

        rows.append(
            DailySale(
                brand=row_brand,
                branch=branch_obj,
                date=dt_val,
                total_sales=total,
                cash_amount=cash,
                network_amount=network,
                order_count=order_cnt,
                average_order=avg_order_val,
                upload=upload,
            )
        )

        d_min = dt_val if d_min is None or dt_val < d_min else d_min
        d_max = dt_val if d_max is None or dt_val > d_max else d_max

    # [Idempotency] Reject duplicate sales for same branch+date from other uploads
    if rows:
        pairs = {(r.branch_id, r.date) for r in rows}
        branch_ids = [p[0] for p in pairs]
        dates = [p[1] for p in pairs]
        existing = DailySale.objects.filter(
            branch_id__in=branch_ids,
            date__in=dates,
        ).exclude(upload=upload).values_list("branch_id", "date").distinct()
        existing_set = set(existing)
        duplicates = [(b, d) for b, d in pairs if (b, d) in existing_set]
        if duplicates:
            from org.models import Branch
            parts = []
            for bid, d in duplicates[:5]:
                br = Branch.objects.filter(pk=bid).first()
                name = br.name if br else str(bid)
                parts.append(f"{name} على {d}")
            msg = (
                "بيانات مبيعات مكررة: يوجد بالفعل بيانات لنفس الفرع واليوم. "
                "الفروع والتواريخ المكررة: " + "؛ ".join(parts)
            )
            if len(duplicates) > 5:
                msg += f" (و{len(duplicates) - 5} أخرى)"
            raise ParseError(msg)

    DailySale.objects.bulk_create(rows, batch_size=500)
    return ParsedMeta(date_from=d_min, date_to=d_max)


def parse_product_sales(
    df: pd.DataFrame,
    upload,
    *,
    brand: Brand | None = None,
    branch: Branch | None = None,
    filename: str = "",
) -> ParsedMeta:
    """
    Product Sales per Branch per Day [Ref: image_7bddb3].
    Headers: المنتج, كود تعريف المنتج, يوم (date), الفرع, صافي المبيعات, كمية المبيعات, الضرائب, مبلغ الخصم.
    - يوم: Date column (like Day in Daily Sales). Handles 1/1/2026 format per row.
    - If المنتج present -> Product Sales mode. Date parsed per row from يوم.
    - صافي المبيعات used for revenue; كمية المبيعات or صافي الكمية for qty.
    """
    from inventory.models import FoodicsProduct

    brand_col = _get_col(df, BRAND_COLS, required=False)
    branch_col = _get_col(df, BRANCH_COLS, required=False)
    branch_ref_col = _get_col(df, BRANCH_REF_COLS, required=False)
    date_col = _get_col(
        df, DATE_COLS + DATE_CONTAINS,
        contains_match=True, first_col_fallback=True
    )
    prod_name_col = _get_col(df, PRODUCT_COLS)
    sku_col = _get_col(df, SKU_COLS, required=False)
    qty_col = _get_col(df, QTY_COLS)
    # [Ref: 135441, 161033] ONLY "Net Sales" or "صافي المبيعات" - exact match
    total_col = _get_col_net_sales_only(df)
    if total_col is None:
        raise ValueError(
            "Product Sales requires column named exactly 'Net Sales' (EN) or 'صافي المبيعات' (AR). "
            "Do not use إجمالي المبيعات, Gross Sales, Total, or الضرائب."
        )

    fallback_brand = _resolve_fallback_brand(brand, filename)

    if hasattr(upload, "progress_pct"):
        upload.progress_pct = 0
        upload.progress_message = "بدء القراءة..."
        upload.save(update_fields=["progress_pct", "progress_message"])

    ProductSale.objects.filter(upload=upload).delete()

    rows: list[ProductSale] = []
    branches_in_file: set[int] = set()
    dates_seen: set[date] = set()
    new_products_count = 0
    total_df_rows = len(df)
    progress_interval = max(500, total_df_rows // 20)  # تحديث كل 500 صف أو 5% تقريباً

    def _update_parse_progress(parsed: int):
        if hasattr(upload, "progress_pct") and total_df_rows:
            pct = min(95, int(50 * parsed / total_df_rows))  # 0–50% خلال القراءة
            upload.progress_pct = pct
            upload.progress_message = f"قراءة {parsed}/{total_df_rows} صف"
            upload.save(update_fields=["progress_pct", "progress_message"])

    for idx in range(len(df)):
        p_raw = _scalar(prod_name_col, idx)
        sku_raw = _scalar(sku_col, idx)
        br_val = _scalar(branch_col, idx)
        b_val = _scalar(brand_col, idx)
        dt_raw = _scalar(date_col, idx)

        if _is_summary_row(p_raw, sku_raw):
            continue
        if _branch_or_brand_is_summary(br_val, b_val):
            continue

        pname = str(p_raw or "").strip()
        if not pname or pname.lower() in ("nan", ""):
            continue

        # Parse date per row from يوم column (1/1/2026, etc.)
        row_date = _parse_date_cell(dt_raw) or _normalize_product_sales_date(dt_raw)
        if row_date is None:
            continue
        dates_seen.add(row_date)

        sku = str(sku_raw or "").strip()
        if not sku:
            sku = pname[:50].lower().replace(" ", "-").replace("_", "-")
            sku = "".join(c for c in sku if c.isalnum() or c == "-") or f"prod-{idx}"
        sku = sku[:64]

        br_name = str(br_val).strip() if br_val is not None and str(br_val).strip().lower() != "nan" else ""
        b_str = str(b_val).strip() if b_val is not None and str(b_val).strip().lower() not in ("nan", "") else ""
        row_brand = brand if brand else (
            Brand.objects.get_or_create(name=(b_str or "Unspecified"))[0]
            if b_str
            else fallback_brand
        )

        # [Ref: STRICT] When Branch Code column exists, require it and resolve by code first
        branch_code_val = None
        if branch_ref_col is not None:
            branch_code_val = _scalar(branch_ref_col, idx)
            code_str = str(branch_code_val).strip() if branch_code_val is not None else ""
            if not code_str or code_str.lower() in ("nan", ""):
                col_name = getattr(branch_ref_col, "name", "Branch Reference") or "Branch Reference"
                raise ParseError(
                    f"Error at Row {idx + 2}, Column {col_name}: Missing Branch Code. Please verify your Excel data.",
                    row_num=idx + 2,
                    col_name=str(col_name),
                )

        branch_obj = None
        if branch_code_val and str(branch_code_val).strip():
            branch_obj = _resolve_branch_by_code(row_brand, str(branch_code_val).strip())
        if branch_obj is None and br_name:
            city = branch.city if branch else _default_city()
            code = br_name.lower().replace(" ", "-").replace("_", "-")[:120]
            code = "".join(c for c in code if c.isalnum() or c == "-")
            name_ar = BRANCH_NAME_AR.get(code) or BRANCH_NAME_AR.get(br_name.strip()) or br_name
            branch_obj, created = Branch.objects.get_or_create(
                brand=row_brand,
                code=code or "branch",
                defaults={"name": br_name, "name_ar": name_ar, "city": city},
            )
            if not created and name_ar and not branch_obj.name_ar:
                branch_obj.name_ar = name_ar
                branch_obj.save(update_fields=["name_ar"])
        if branch_obj is None:
            branch_obj = _resolve_fallback_branch(branch, row_brand, "Main")

        branches_in_file.add(branch_obj.id)

        qty = _parse_amount(_scalar(qty_col, idx))
        total = _parse_amount(_scalar(total_col, idx))

        _, created = FoodicsProduct.objects.get_or_create(
            foodics_product_id=sku,
            defaults={"name": pname[:255], "is_active": True},
        )
        if created:
            new_products_count += 1

        rows.append(
            ProductSale(
                brand=row_brand,
                branch=branch_obj,
                date=row_date,
                product_name=pname,
                product_sku=sku,
                qty=qty,
                total_sales=total,
                upload=upload,
            )
        )
        if (idx + 1) % progress_interval == 0:
            _update_parse_progress(idx + 1)

    # [Idempotency] Reject duplicate product sales for same branch+date from other uploads
    if branches_in_file and dates_seen:
        existing = ProductSale.objects.filter(
            branch_id__in=branches_in_file,
            date__in=dates_seen,
        ).exclude(upload=upload).values_list("branch_id", "date").distinct()
        existing_set = set(existing)
        if existing_set:
            from org.models import Branch
            parts = []
            for bid, d in list(existing_set)[:5]:
                br = Branch.objects.filter(pk=bid).first()
                name = br.name if br else str(bid)
                parts.append(f"{name} على {d}")
            msg = (
                "بيانات مبيعات المنتجات مكررة: يوجد بالفعل بيانات لنفس الفرع واليوم. "
                "الفروع والتواريخ المكررة: " + "؛ ".join(parts)
            )
            if len(existing_set) > 5:
                msg += f" (و{len(existing_set) - 5} أخرى)"
            raise ParseError(msg)

    # [Atomicity] حفظ المبيعات + خصم المخزون في عملية واحدة – إذا فشل الخصم يُلغى الرفع بالكامل
    # [Chunked] bulk_create بالأجزاء مع تحديث progress_pct لشريط التقدم
    from django.db import transaction
    from inventory.depletion_services import process_product_sale_depletion

    total_rows = len(rows)
    chunk_size = 1000
    processed = 0

    def _update_progress(pct: int, msg: str = ""):
        if hasattr(upload, "progress_pct"):
            upload.progress_pct = min(100, pct)
            upload.progress_message = msg[:200] if msg else ""
            upload.save(update_fields=["progress_pct", "progress_message"])

    with transaction.atomic():
        for i in range(0, total_rows, chunk_size):
            batch = rows[i : i + chunk_size]
            ProductSale.objects.bulk_create(batch, batch_size=chunk_size)
            processed += len(batch)
            _update_progress(int(100 * processed / total_rows) if total_rows else 100, f"حفظ {processed}/{total_rows} صف")
        process_product_sale_depletion(upload)
        _update_progress(100, "اكتمل")

    d_min = min(dates_seen) if dates_seen else None
    d_max = max(dates_seen) if dates_seen else None
    return ParsedMeta(date_from=d_min, date_to=d_max, new_products_count=new_products_count)


def _map_payment_method_to_category(raw: str) -> str | None:
    """
    [Ref: image_86561c] Map raw طريقة الدفع to FoodicsPaymentCategory.
    Returns None to skip row (uncategorized).
    """
    if not raw:
        return None
    s = str(raw).strip().lower()
    if not s or s == "nan":
        return None
    s_ar = str(raw).strip()  # Keep Arabic for matching
    if s in CASH_METHODS or s_ar in ("كاش", "نقد", "النقد"):
        return FoodicsPaymentCategory.CASH
    if s in SPAN_METHODS or "سبان" in s_ar or "span" in s:
        return FoodicsPaymentCategory.SPAN
    # Delivery Apps: تطبيق كيتا, Hanger Station CARD, Jahez, ToYou
    for term in DELIVERY_APP_METHODS:
        if term in s or term in s_ar:
            return FoodicsPaymentCategory.DELIVERY_APPS
    if "delivery" in s or "توصيل" in s_ar or "تطبيق" in s_ar:
        return FoodicsPaymentCategory.DELIVERY_APPS
    return None


def parse_payments_report(
    df: pd.DataFrame,
    upload,
    *,
    brand: Brand | None = None,
    branch: Branch | None = None,
    filename: str = "",
) -> ParsedMeta:
    """
    [Ref: image_86561c] Foodics Payments Report - REFERENCE ONLY.
    Headers: يوم (date), الفرع (branch), طريقة الدفع (payment method), المبلغ الصافي (net amount).
    Does NOT override Actual Cash from Shift Closing. Creates FoodicsPaymentRecord for variance display.
    """
    date_col = _get_col(
        df, PAYMENTS_DATE_COLS,
        required=True, contains_match=True, first_col_fallback=True
    )
    branch_col = _get_col(df, PAYMENTS_BRANCH_COLS + BRANCH_COLS, required=True)
    branch_ref_col = _get_col(df, BRANCH_REF_COLS, required=False)
    method_col = _get_col(df, PAYMENTS_METHOD_COLS, required=True)
    amount_col = _get_col(df, PAYMENTS_NET_AMOUNT_COLS, required=True)

    fallback_brand = _resolve_fallback_brand(brand, filename)
    city = branch.city if branch else _default_city()

    rows: list[FoodicsPaymentRecord] = []
    d_min: date | None = None
    d_max: date | None = None

    for idx in range(len(df)):
        branch_code_val = None
        br_val = _scalar(branch_col, idx)
        br_name = str(br_val).strip() if br_val is not None and str(br_val).strip().lower() != "nan" else ""
        if not br_name or _branch_or_brand_is_summary(br_val, None):
            continue

        # [Ref: STRICT] When Branch Code column exists, require it and resolve by code first
        if branch_ref_col is not None:
            branch_code_val = _scalar(branch_ref_col, idx)
            code_str = str(branch_code_val).strip() if branch_code_val is not None else ""
            if not code_str or code_str.lower() in ("nan", ""):
                col_name = getattr(branch_ref_col, "name", "Branch Reference") or "Branch Reference"
                raise ParseError(
                    f"Error at Row {idx + 2}, Column {col_name}: Missing Branch Code. Please verify your Excel data.",
                    row_num=idx + 2,
                    col_name=str(col_name),
                )

        dt_raw = _scalar(date_col, idx)
        dt_val = _parse_date_cell(dt_raw)
        if dt_val is None:
            continue

        raw_method = str(_scalar(method_col, idx) or "").strip()
        category = _map_payment_method_to_category(raw_method)
        if category is None:
            continue

        net_amount = Decimal(str(_scalar(amount_col, idx) or 0))
        if net_amount <= 0:
            continue

        branch_obj = None
        if branch_code_val and str(branch_code_val).strip():
            branch_obj = _resolve_branch_by_code(fallback_brand, str(branch_code_val).strip())
        if branch_obj is None:
            code = br_name.lower().replace(" ", "-").replace("_", "-")[:120]
            code = "".join(c for c in code if c.isalnum() or c == "-")
            name_ar = BRANCH_NAME_AR.get(code) or BRANCH_NAME_AR.get(br_name.strip()) or ""
            branch_obj, _ = Branch.objects.get_or_create(
                brand=fallback_brand,
                code=code or "branch",
                defaults={"name": br_name, "name_ar": name_ar, "city": city},
            )

        rows.append(
            FoodicsPaymentRecord(
                branch=branch_obj,
                report_date=dt_val,
                category=category,
                raw_method=raw_method[:128],
                net_amount=net_amount,
            )
        )

        d_min = dt_val if d_min is None or dt_val < d_min else d_min
        d_max = dt_val if d_max is None or dt_val > d_max else d_max

    # Replace records for affected branches/dates (avoid duplicates on re-upload)
    if rows:
        branches_ids = {r.branch_id for r in rows}
        dates_seen = {r.report_date for r in rows}
        FoodicsPaymentRecord.objects.filter(
            branch_id__in=branches_ids,
            report_date__in=dates_seen,
        ).delete()
        FoodicsPaymentRecord.objects.bulk_create(rows, batch_size=500)

    return ParsedMeta(date_from=d_min, date_to=d_max)


# Map smart_parser db_field -> parser expected column (first of COLS)
FIELD_TO_PARSER_COL = {
    "brand": BRAND_COLS[0],
    "branch": BRANCH_COLS[0],
    "branch_reference": BRANCH_REF_COLS[0],
    "date": DATE_COLS[0],
    "hour": HOUR_COLS[0],
    "total_sales": NET_SALES_COLS[0],
    "cash": CASH_COLS[0],
    "network": NETWORK_COLS[0],
    "tax": TAX_COLS[0],
    "discount": DISCOUNT_COLS[0],
    "order_count": ORDER_COUNT_COLS[0],
    "avg_check": AVG_ORDER_COLS[0],
    "return_amount": RETURN_AMOUNT_COLS[0],
    "void_amount": VOID_AMOUNT_COLS[0],
    "product": PRODUCT_COLS[0],
    "sku": SKU_COLS[0],
    "qty": QTY_COLS[0],
}


# [Ref: Audit] حماية من CSV/Excel Formula Injection – خلايا تبدأ بـ =, +, -, @
DANGEROUS_PREFIXES = ("=", "+", "-", "@")


def _sanitize_cell_value(val) -> str | float | int | None:
    """تعطيل صيغ CSV/Excel الخبيثة: خلايا تبدأ بـ =, +, -, @ تُسبق بفاصلة علوية."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return val
    s = str(val).strip()
    if not s:
        return val
    if s.startswith(DANGEROUS_PREFIXES):
        return "'" + s  # Excel: ' يجعل الخلية نصاً ولا يُنفّذ الصيغة
    return val


def sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """تعطيل خلايا قد تحتوي صيغاً خبيثة (CSV/Excel Injection)."""
    if df.empty:
        return df
    result = df.copy()
    for col in result.columns:
        result[col] = result[col].apply(_sanitize_cell_value)
    return result


def apply_column_mapping(df: pd.DataFrame, mapping: dict[str, str | None]) -> pd.DataFrame:
    """Rename columns using mapping so parser finds them. [Ref: 125212] Strict checks only."""
    rename = {}
    for db_field, actual_col in mapping.items():
        if (
            actual_col is not None
            and pd.notna(actual_col)
            and str(actual_col).strip() != ""
            and actual_col in df.columns
            and db_field in FIELD_TO_PARSER_COL
        ):
            rename[actual_col] = FIELD_TO_PARSER_COL[db_field]
    if rename:
        return df.rename(columns=rename)
    return df


def parse_excel_upload(upload, *, report_type: str, column_mapping: dict | None = None):
    from imports.smart_parser import extract_dataframe, detect_columns

    file = upload.file
    if hasattr(file, "seek"):
        file.seek(0)
    filename = getattr(file, "name", "") or ""

    if filename.lower().endswith(".csv"):
        df = pd.read_csv(file, encoding="utf-8-sig", on_bad_lines="skip", header=0)
    elif filename.lower().endswith(".pdf"):
        file.seek(0)
        df = extract_dataframe(file, filename)
    else:
        if hasattr(file, "seek"):
            file.seek(0)
        df = pd.read_excel(file, header=0)
        # [Ref: 8OZ_JAN_2026] Foodics "Sales by Branch" has metadata rows 0-4; data starts row 5
        first_col = str(df.columns[0]) if len(df.columns) > 0 else ""
        if "sales by branch" in first_col.lower() or "title" in str(df.iloc[0].iloc[0] if len(df) > 0 else "").lower():
            file.seek(0)
            df = pd.read_excel(file, header=5)

    cols_list = list(df.columns)
    df.columns = [
        f"{c}_{i}" if cols_list.count(c) > 1 else c
        for i, c in enumerate(cols_list)
    ]

    df.dropna(how="all", inplace=True)
    df.dropna(axis=1, how="all", inplace=True)
    df.reset_index(drop=True, inplace=True)

    df = sanitize_dataframe(df)

    def _norm_col(c):
        if c is None:
            return ""
        s = str(c).strip().strip("\ufeff")
        return " ".join(s.lower().split())

    df.columns = [_norm_col(c) for c in df.columns]

    mapping = column_mapping or detect_columns(df)
    brand = getattr(upload, "brand", None)
    branch = getattr(upload, "branch", None)

    if report_type == ExcelReportType.PRODUCT_SALES:
        # [Ref: 135441, 161033] Product Sales: do NOT apply mapping for total_sales.
        # Parse uses original column names to find ONLY صافي المبيعات (Column L, never إجمالي or ضرائب).
        meta = parse_product_sales(df, upload, brand=brand, branch=branch, filename=filename)
    elif report_type == ExcelReportType.PAYMENTS_REPORT:
        # [Ref: image_86561c] Payments Report: uses يوم, الفرع, طريقة الدفع, المبلغ الصافي
        meta = parse_payments_report(df, upload, brand=brand, branch=branch, filename=filename)
    else:
        df = apply_column_mapping(df, mapping)
        if report_type == ExcelReportType.HOURLY_SALES:
            meta = parse_hourly_sales(df, upload, brand=brand, branch=branch, filename=filename)
        elif report_type == ExcelReportType.DAILY_SALES:
            meta = parse_daily_sales(df, upload, brand=brand, branch=branch, filename=filename)
        else:
            raise ValueError(f"Unsupported report_type: {report_type}")

    if meta.date_from and meta.date_to:
        upload.report_date_from = meta.date_from
        upload.report_date_to = meta.date_to
        upload.save(update_fields=["report_date_from", "report_date_to", "updated_at"])

    return meta

