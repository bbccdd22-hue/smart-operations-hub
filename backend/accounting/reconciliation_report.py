"""
تقرير المطابقة اليومي – مقارنة تلقائية بين مصادر المبيعات الثلاثة.
إذا وجد فرق ولو بـ هللة واحدة يُرسل تنبيه فوري للمالك (سيف).
"""
from datetime import date
from decimal import Decimal

from django.db.models import Sum

from imports.models import DailySale, ProductSale
from org.models import AdminNotification, Branch
from shifts.models import ShiftClosing


DIFF_THRESHOLD = Decimal("0.01")  # هللة واحدة
EVENT_TYPE = "daily_reconciliation_mismatch"
REFERENCE_PREFIX = "recon_"


def run_daily_reconciliation_check(
    target_date: date,
    brand_slug: str | None = None,
    branch_ids: list[int] | None = None,
) -> list[dict]:
    """
    يقارن لكل فرع+تاريخ:
    - إجمالي مبيعات المنتجات (ProductSale.total_sales)
    - إجمالي المبيعات اليومية (DailySale.total_sales)
    - إجمالي إقفالات الورديات (ShiftClosing.system_total_sales)

    إذا وُجد فرق > 0.01 ريال يُرجع الفجوات ويُرسل AdminNotification لسيف.
    """
    from django.contrib.auth import get_user_model

    saif = get_user_model().objects.filter(username="SAIF").first()
    if not saif:
        return []

    branches = Branch.objects.filter(is_active=True).select_related("brand")
    if brand_slug:
        branches = branches.filter(brand__slug=brand_slug)
    if branch_ids:
        branches = branches.filter(id__in=branch_ids)
    branch_ids_list = list(branches.values_list("id", flat=True))
    if not branch_ids_list:
        return []

    # تجميع المصادر الثلاثة لكل (فرع، تاريخ)
    product_totals = {
        (r["branch_id"], r["date"]): r["total"]
        for r in ProductSale.objects.filter(
            branch_id__in=branch_ids_list, date=target_date
        ).values("branch_id", "date").annotate(total=Sum("total_sales"))
    }
    daily_totals = {
        (r["branch_id"], r["date"]): r["total"]
        for r in DailySale.objects.filter(
            branch_id__in=branch_ids_list, date=target_date
        ).values("branch_id", "date").annotate(total=Sum("total_sales"))
    }
    closing_totals = {
        (r["shift__branch_id"], target_date): r["total"]
        for r in ShiftClosing.objects.filter(
            shift__branch_id__in=branch_ids_list,
            shift__opened_at__date=target_date,
        ).values("shift__branch_id").annotate(total=Sum("system_total_sales"))
    }

    branch_names = {b.id: (b.name, b.brand.name if b.brand_id else "") for b in branches}
    mismatches: list[dict] = []

    def _to_dec(v) -> Decimal:
        if v is None:
            return Decimal("0")
        return Decimal(str(v))

    checked: set[tuple[int, date]] = set()
    for bid in branch_ids_list:
        key = (bid, target_date)
        if key in checked:
            continue
        checked.add(key)
        prod = _to_dec(product_totals.get(key))
        daily = _to_dec(daily_totals.get(key))
        closing = _to_dec(closing_totals.get(key))

        if prod == daily == closing:
            continue
        diff_prod_daily = abs(prod - daily)
        diff_prod_closing = abs(prod - closing)
        diff_daily_closing = abs(daily - closing)
        if diff_prod_daily <= DIFF_THRESHOLD and diff_prod_closing <= DIFF_THRESHOLD and diff_daily_closing <= DIFF_THRESHOLD:
            continue

        bn, brand_n = branch_names.get(bid, ("", ""))
        row = {
            "branch_id": bid,
            "branch_name": bn,
            "brand_name": brand_n,
            "date": str(target_date),
            "product_sales_total": float(prod),
            "daily_sales_total": float(daily),
            "shift_closing_total": float(closing),
            "gaps": [],
        }
        if diff_prod_daily > DIFF_THRESHOLD:
            row["gaps"].append(f"منتج–يومي: {float(diff_prod_daily):.2f} ر.س")
        if diff_prod_closing > DIFF_THRESHOLD:
            row["gaps"].append(f"منتج–إقفال: {float(diff_prod_closing):.2f} ر.س")
        if diff_daily_closing > DIFF_THRESHOLD:
            row["gaps"].append(f"يومي–إقفال: {float(diff_daily_closing):.2f} ر.س")
        mismatches.append(row)

        ref = f"{REFERENCE_PREFIX}{bid}_{target_date}"
        if AdminNotification.objects.filter(
            user=saif,
            event_type=EVENT_TYPE,
            reference=ref,
            read=False,
        ).exists():
            continue
        AdminNotification.objects.create(
            user=saif,
            event_type=EVENT_TYPE,
            title="فجوة في المطابقة اليومية",
            message=(
                f"{brand_n} – {bn} ({target_date}): "
                f"مبيعات منتجات={prod:.2f}، مبيعات يومية={daily:.2f}، إقفالات={closing:.2f}. "
                f"الفجوات: {'؛ '.join(row['gaps'])}"
            ),
            reference=ref,
        )

    return mismatches
