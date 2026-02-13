"""
Universal File Parser with fuzzy column matching.
Supports Excel (.xlsx, .csv) and PDF. Auto-detects columns and brand.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd

try:
    from rapidfuzz import fuzz
except ImportError:
    fuzz = None

# Known brand identifiers in file content
BRAND_SIGNATURES = {
    "8oz": ["8oz", "8 oz", "8OZ"],
    "hemi": ["hemi", "HEMI"],
    "sweet bread": ["sweet bread", "sweetbread", "SWEET BREAD"],
    "blanca": ["blanca", "BLANCA"],
    "tea plus": ["tea plus", "teaplus", "TEA PLUS"],
    "chart": ["chart", "CHART"],
}

# [Ref: User simplified Foodics] ONLY these header pairs. Net Sales for totals.
COLUMN_OPTIONS = {
    "brand": ["Brand", "العلامة التجارية", "الماركة"],
    "branch": ["Branch", "الفرع"],
    "branch_reference": ["Branch Reference", "مرجع الفرع", "كود الفرع"],
    "date": ["Day", "يوم", "التاريخ"],
    "hour": ["Hour", "Time", "hour", "الوقت", "الساعة"],
    "total_sales": ["Net Sales", "صافي المبيعات"],
    "cash": ["Cash", "Cash Amount", "نقد", "النقد"],
    "network": ["Network", "Card", "MADA", "VISA", "الشبكة", "بطاقات"],
    "product": ["Product", "Item", "المنتج", "الصنف"],
    "sku": ["SKU", "PLU", "Barcode", "كود تعريف المنتج"],
    "qty": ["Qty", "Quantity", "الكمية", "صافي الكمية", "كمية المبيعات"],
    "tax": ["Taxes", "الضرائب"],
    "discount": ["Discount Amount", "مبلغ الخصم"],
    "order_count": ["Order Count", "عدد الطلبات"],
    "avg_check": ["Average Order", "متوسط الطلب"],
    "return_amount": ["Return Amount", "مبلغ الإرجاع"],
    "void_amount": ["Void Amount", "مبلغ الإلغاء"],
    "return_quantity": ["Return Quantity", "كمية المرتجع"],
    "void_quantity": ["Void Quantity", "كمية الإلغاء"],
    # [Ref: image_86561c] Payments Report
    "payment_method": ["Payment Method", "طريقة الدفع"],
    "net_amount": ["Net Amount", "المبلغ الصافي"],
}

FUZZY_THRESHOLD = 70  # Minimum similarity for fuzzy match


def _fuzzy_match(header: str, options: list[str]) -> tuple[str | None, int]:
    """Return (best_match, score) or (None, 0). Uses rapidfuzz if available else exact match."""
    header = str(header).strip().lower()
    if not header:
        return None, 0
    if header in [o.lower() for o in options]:
        idx = [o.lower() for o in options].index(header)
        return options[idx], 100
    if fuzz:
        best = None
        best_score = 0
        for opt in options:
            score = fuzz.ratio(header, opt.lower())
            if score > best_score and score >= FUZZY_THRESHOLD:
                best = opt
                best_score = score
        return best, best_score
    return None, 0


def detect_columns(df: pd.DataFrame) -> dict[str, str | None]:
    """
    Detect which DataFrame columns map to our DB fields using fuzzy matching.
    Returns {db_field: actual_column_name or None}
    """
    result: dict[str, str | None] = {}
    for db_field, options in COLUMN_OPTIONS.items():
        best_col = None
        best_score = 0
        for col in df.columns:
            match, score = _fuzzy_match(str(col), options)
            if match and score > best_score:
                best_col = str(col)
                best_score = score
        result[db_field] = best_col if best_col else None
    return result


def detect_brand_from_filename(filename: str) -> str | None:
    """Scan filename for brand signature. Returns brand slug or None."""
    combined = (filename or "").lower()
    for slug, sigs in BRAND_SIGNATURES.items():
        for s in sigs:
            if s.lower() in combined:
                return slug
    return None


def detect_brand_from_content(df: pd.DataFrame, mapping: dict[str, str | None]) -> str | None:
    """Scan first rows for brand name. Returns brand slug or None."""
    brand_col = mapping.get("brand") or None
    text_cols = [c for c in df.columns if df[c].dtype == "object" or str(df[c].dtype) == "string"]
    sample = []
    if brand_col is not None and brand_col != "" and brand_col in df.columns:
        sample.extend(df[brand_col].dropna().astype(str).head(20).tolist())
    for c in text_cols[:3]:  # First 3 text columns
        sample.extend(df[c].dropna().astype(str).head(10).tolist())

    combined = " ".join(sample).lower()
    for slug, sigs in BRAND_SIGNATURES.items():
        for s in sigs:
            if s.lower() in combined:
                return slug
    return None


def extract_dataframe(file, filename: str) -> pd.DataFrame:
    """
    Extract DataFrame from Excel, CSV, or PDF.
    SAIF: Always header=0 (row 1). Deduplicate column names immediately to avoid Series ambiguity.
    """
    if hasattr(file, "seek"):
        file.seek(0)
    name = (filename or "").lower()

    if name.endswith(".csv"):
        df = pd.read_csv(file, encoding="utf-8-sig", on_bad_lines="skip", header=0)
    elif name.endswith(".xlsx") or name.endswith(".xls"):
        df = pd.read_excel(file, header=0)
    else:
        df = None

    if df is not None:
        cols_list = list(df.columns)
        df.columns = [
            f"{c}_{i}" if cols_list.count(c) > 1 else c for i, c in enumerate(cols_list)
        ]
        return df

    if name.endswith(".pdf"):
        try:
            import pdfplumber
        except ImportError:
            raise ValueError("PDF support requires pdfplumber. Install with: pip install pdfplumber")

        with pdfplumber.open(file) as pdf:
            tables = []
            for page in pdf.pages:
                tbls = page.extract_tables()
                if tbls:
                    for tbl in tbls:
                        if tbl and len(tbl) > 1:
                            df_page = pd.DataFrame(tbl[1:], columns=tbl[0])
                            tables.append(df_page)
            if not tables:
                raise ValueError("No tables found in PDF")
            df = pd.concat(tables, ignore_index=True)
            cols_list = list(df.columns)
            df.columns = [f"{c}_{i}" if cols_list.count(c) > 1 else c for i, c in enumerate(cols_list)]
            return df

    raise ValueError(f"Unsupported format. Use .xlsx, .csv, or .pdf")


def _classify_report_type(df: pd.DataFrame, mapping: dict[str, str | None]) -> str:
    """
    Smart classifier: scan header row to identify report type.
    - طريقة الدفع + المبلغ الصافي -> payments_report
    - Hourly -> hourly_sales
    - المنتج or Product/SKU -> product_sales (Product Sales per Branch per Day)
    - Payment/Mada/Visa -> receipts (maps to daily for now; future: receipts)
    - Daily/default -> daily_sales
    """
    headers_lower = " ".join(str(c).lower() for c in df.columns)
    headers_raw = " ".join(str(c) for c in df.columns)
    # [Ref: image_86561c] Payments Report: يوم, الفرع, طريقة الدفع, المبلغ الصافي
    if mapping.get("payment_method") and mapping.get("net_amount"):
        return "payments_report"
    if "طريقة الدفع" in headers_raw and "المبلغ الصافي" in headers_raw:
        return "payments_report"
    if "hourly" in headers_lower or "hour" in headers_lower and mapping.get("hour"):
        return "hourly_sales"
    # [Ref: image_7bddb3] المنتج = Product Name -> Product Sales mode
    if "المنتج" in headers_raw or "product" in headers_lower or "sku" in headers_lower or "plu" in headers_lower:
        if mapping.get("product") or mapping.get("sku") or mapping.get("qty"):
            return "product_sales"
    if "payment" in headers_lower or "mada" in headers_lower or "visa" in headers_lower or "متاب" in headers_lower:
        return "daily_sales"  # Receipts: use daily for now
    if mapping.get("hour") and mapping.get("total_sales"):
        return "hourly_sales"
    if mapping.get("product") or mapping.get("qty"):
        return "product_sales"
    return "daily_sales"


def _safe_date(val: Any) -> date | None:
    try:
        if isinstance(val, pd.Series):
            val = val.iloc[0] if len(val) else None
        if val is None or (hasattr(pd, "isna") and pd.isna(val)):
            return None
        if isinstance(val, date) and not isinstance(val, datetime):
            return val
        dt = pd.to_datetime(val)
        return dt.date() if hasattr(dt, "date") and not isinstance(dt, pd.Series) else None
    except Exception:
        return None


def _safe_decimal(val: Any) -> Decimal:
    try:
        if isinstance(val, pd.Series):
            val = val.iloc[0] if len(val) else None
        if val is None or (hasattr(pd, "isna") and pd.isna(val)) or val == "":
            return Decimal("0")
        return Decimal(str(val))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


@dataclass
class ParsePreviewResult:
    """Result of parse_preview."""
    rows: list[dict[str, Any]]
    columns: list[str]
    mapping: dict[str, str | None]
    detected_brand: str | None
    suggested_report_type: str  # daily_sales, hourly_sales, product_sales
    error_rows: list[dict] = field(default_factory=list)
    total_rows: int = 0


def parse_preview(file, filename: str) -> ParsePreviewResult:
    """
    Parse file and return preview (first 5 rows) plus column mapping.
    Identifies error rows (missing date/amount).
    """
    df = extract_dataframe(file, filename)
    mapping = detect_columns(df)
    detected_brand = detect_brand_from_content(df, mapping)

    # Smart classifier: scan headers for report type
    suggested_report_type = _classify_report_type(df, mapping)

    preview_rows = []
    for idx in range(min(5, len(df))):
        row_dict = {}
        for col in df.columns:
            val = df[col].iloc[idx]
            if isinstance(val, pd.Series):
                val = val.iloc[0] if len(val) else None
            if pd.isna(val):
                row_dict[str(col)] = ""
            elif isinstance(val, (date, datetime)):
                row_dict[str(col)] = str(val)[:10]
            else:
                row_dict[str(col)] = str(val)[:100]
        preview_rows.append(row_dict)

    # Scan all rows for missing critical values (use scalar extraction to avoid Series ambiguity [Ref: 125212])
    error_rows = []
    date_col = mapping.get("date")
    total_col = mapping.get("total_sales")
    for idx in range(len(df)):
        dt_cell = None
        amt_cell = None
        if pd.notna(date_col) and str(date_col).strip() != "" and date_col in df.columns:
            v = df[date_col].iloc[idx]
            dt_cell = v.iloc[0] if isinstance(v, pd.Series) else v
        if pd.notna(total_col) and str(total_col).strip() != "" and total_col in df.columns:
            v = df[total_col].iloc[idx]
            amt_cell = v.iloc[0] if isinstance(v, pd.Series) else v
        dt_val = _safe_date(dt_cell)
        amt_val = _safe_decimal(amt_cell)
        if dt_val is None or amt_val == 0:
            row_dict = {}
            for c in df.columns:
                v = df[c].iloc[idx]
                v = v.iloc[0] if isinstance(v, pd.Series) else v
                row_dict[str(c)] = str(v)[:50] if pd.notna(v) else ""
            error_rows.append({"row_index": idx + 1, "sample": row_dict})
        if len(error_rows) >= 10:
            break

    return ParsePreviewResult(
        rows=preview_rows,
        columns=[str(c) for c in df.columns],
        mapping=mapping,
        detected_brand=detected_brand,
        suggested_report_type=suggested_report_type,
        error_rows=error_rows[:10],
        total_rows=len(df),
    )
