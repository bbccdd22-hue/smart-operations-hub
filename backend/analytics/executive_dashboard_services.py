"""
لوحة تحكم المالك النهائية – Executive Dashboard.
صافي الربح، تنبيهات الأمان، تقارير تحليلية.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Sum

from analytics.report_data_sources import PRODUCT_SALE_EXCLUDE_SUMMARY
from imports.models import DailySale, ProductSale
from inventory.models import BranchStock
from inventory.profit_services import get_profit_summary
from org.models import Branch


def _get_sales_and_cogs(
    branch_ids: list[int],
    date_from: date,
    date_to: date,
) -> tuple[float, float]:
    """إرجاع (total_sales, total_cogs) للفترة."""
    profit = get_profit_summary(
        branch_ids=branch_ids,
        date_from=date_from,
        date_to=date_to,
    )
    sales = float(profit.get("total_sales", "0") or 0)
    cogs = float(profit.get("total_cogs", "0") or 0)
    return sales, cogs


def get_net_profit_series(
    branch_ids: list[int],
    date_from: date,
    date_to: date,
    *,
    brand_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    """
    سلسلة صافي الربح يومياً: المبيعات - التكاليف (COGS + الرواتب + الإهلاك).
    """
    from hr.models import PayrollRun, PayrollRunLine
    from assets.models import AssetDepreciation

    series = []
    current = date_from
    while current <= date_to:
        sales, cogs = _get_sales_and_cogs(branch_ids, current, current)
        gross_profit = sales - cogs

        # رواتب الشهر: توزيع على أيام الشهر
        year, month = current.year, current.month
        payroll_total = (
            PayrollRunLine.objects.filter(
                payroll_run__period_year=year,
                payroll_run__period_month=month,
                cost_center__branch_id__in=branch_ids,
            ).aggregate(s=Sum("net_amount"))["s"] or Decimal("0")
        )

        payroll_total = payroll_total or Decimal("0")
        if payroll_total > 0:
            days_in_month = 31
            try:
                import calendar
                days_in_month = calendar.monthrange(year, month)[1]
            except Exception:
                pass
            payroll_daily = float(payroll_total) / days_in_month
        else:
            payroll_daily = 0.0

        # إهلاك الشهر: توزيع يومي
        dep_qs = AssetDepreciation.objects.filter(period_year=year, period_month=month)
        if branch_ids:
            dep_qs = dep_qs.filter(asset__branch_id__in=branch_ids)
        dep_total = dep_qs.aggregate(s=Sum("depreciation_amount"))["s"] or Decimal("0")
        days_in_month = 31
        try:
            import calendar
            days_in_month = calendar.monthrange(year, month)[1]
        except Exception:
            pass
        dep_daily = float(dep_total) / days_in_month

        net_profit = gross_profit - payroll_daily - dep_daily

        series.append({
            "date": current.isoformat(),
            "sales": round(sales, 2),
            "cogs": round(cogs, 2),
            "gross_profit": round(gross_profit, 2),
            "payroll": round(payroll_daily, 2),
            "depreciation": round(dep_daily, 2),
            "net_profit": round(net_profit, 2),
        })
        current += timedelta(days=1)

    return series


def get_safety_alerts(
    branch_ids: list[int],
    *,
    late_attendance_threshold_minutes: int = 30,
) -> dict[str, list[dict[str, Any]]]:
    """
    تنبيهات الأمان: عجز مخزني، تأخير حضور، طلبات شراء معلقة.
    """
    from hr.models import AttendanceRecord
    from procurement.models import PurchaseRequest, PurchaseRequestStatus

    real_branches = list(
        Branch.objects.exclude(branch_code="IN_TRANSIT")
        .filter(id__in=branch_ids)
        .values_list("id", flat=True)
    )

    # 1. عجز مخزني (رصيد سالب أو دون حد إعادة الطلب)
    stock_alerts = []
    for bs in (
        BranchStock.objects.filter(branch_id__in=real_branches)
        .select_related("ingredient", "branch")
        .order_by("on_hand")[:20]
    ):
        if bs.on_hand < 0 or (bs.reorder_level and bs.on_hand <= bs.reorder_level):
            stock_alerts.append({
                "type": "negative" if bs.on_hand < 0 else "low",
                "ingredient_name": bs.ingredient.name_en,
                "ingredient_name_ar": bs.ingredient.name_ar or "",
                "branch_name": bs.branch.name_ar or bs.branch.name,
                "on_hand": float(bs.on_hand),
                "reorder_level": float(bs.reorder_level or 0),
            })
    stock_alerts = sorted(stock_alerts, key=lambda x: x["on_hand"])[:10]

    # 2. تأخير حضور: اليوم فقط، clock_in بعد 9:30 (أو 9 + threshold)
    today_start = datetime.now().replace(hour=9, minute=late_attendance_threshold_minutes, second=0, microsecond=0)
    today_date = date.today()
    late_attendance = []
    for ar in (
        AttendanceRecord.objects.filter(
            clock_in__date=today_date,
            branch_id__in=branch_ids,
            clock_in__gt=today_start,
        )
        .select_related("employee", "branch")[:15]
    ):
        late_attendance.append({
            "employee_name": ar.employee.full_name if hasattr(ar.employee, "full_name") else str(ar.employee),
            "branch_name": ar.branch.name_ar or ar.branch.name,
            "clock_in": ar.clock_in.isoformat() if ar.clock_in else None,
        })

    # 3. طلبات شراء معلقة (draft أو submitted)
    pending_purchases = []
    pr_qs = PurchaseRequest.objects.filter(
        status__in=[PurchaseRequestStatus.DRAFT, PurchaseRequestStatus.SUBMITTED],
        branch_id__in=branch_ids,
    ).select_related("branch", "requested_by").order_by("-requested_at")[:15]
    for pr in pr_qs:
        pending_purchases.append({
            "id": pr.id,
            "request_number": pr.request_number,
            "branch_name": pr.branch.name_ar or pr.branch.name,
            "status": pr.status,
            "requested_at": pr.requested_at.isoformat() if pr.requested_at else None,
        })

    return {
        "stock_shortage": stock_alerts,
        "late_attendance": late_attendance,
        "pending_purchase_orders": pending_purchases,
    }


def get_product_profitability(
    branch_ids: list[int],
    date_from: date,
    date_to: date,
    top_n: int = 10,
) -> list[dict[str, Any]]:
    """
    أكثر المنتجات ربحية: إيرادات - تكلفة المبيعات لكل منتج.
    """
    from inventory.services import explode_recipe_requirements
    from inventory.models import Ingredient

    qs = ProductSale.objects.filter(
        branch_id__in=branch_ids,
        date__gte=date_from,
        date__lte=date_to,
    ).exclude(PRODUCT_SALE_EXCLUDE_SUMMARY)

    sku_to_qty: dict[str, int] = defaultdict(int)
    sku_to_revenue: dict[str, float] = defaultdict(float)
    sku_to_name: dict[str, str] = {}

    for r in qs.values("product_sku", "product_name", "qty", "total_sales"):
        sku = (r.get("product_sku") or "").strip()
        if not sku:
            continue
        qty = int(float(r.get("qty") or 0))
        rev = float(r.get("total_sales") or 0)
        sku_to_qty[sku] += qty
        sku_to_revenue[sku] += rev
        sku_to_name[sku] = r.get("product_name") or sku

    if not sku_to_qty:
        return []

    product_profits = []
    for sku, qty in sku_to_qty.items():
        if qty <= 0:
            continue
        reqs = explode_recipe_requirements({sku: qty})
        cogs = Decimal("0")
        for r in reqs:
            ing = Ingredient.objects.filter(id=r.ingredient_id).first()
            uc = Decimal(str(ing.unit_cost or 0)) if ing else Decimal("0")
            cogs += r.qty * uc
        revenue = sku_to_revenue.get(sku, 0)
        profit = float(revenue) - float(cogs)
        product_profits.append({
            "product_sku": sku,
            "product_name": sku_to_name.get(sku, sku),
            "revenue": round(revenue, 2),
            "cogs": round(float(cogs), 2),
            "profit": round(profit, 2),
            "margin_pct": round(profit / revenue * 100, 1) if revenue else 0,
        })

    product_profits.sort(key=lambda x: -x["profit"])
    return product_profits[:top_n]


def get_branch_efficiency(
    branch_ids: list[int],
    date_from: date,
    date_to: date,
) -> list[dict[str, Any]]:
    """
    أكثر الفروع كفاءة: إجمالي المبيعات، إجمالي الربح، هامش الربح.
    """
    result = []
    for bid in branch_ids:
        sales, cogs = _get_sales_and_cogs([bid], date_from, date_to)
        gross_profit = sales - cogs
        margin_pct = round(gross_profit / sales * 100, 1) if sales else 0
        branch = Branch.objects.filter(id=bid).first()
        name = (branch.name_ar or branch.name) if branch else str(bid)
        result.append({
            "branch_id": bid,
            "branch_name": name,
            "sales": round(sales, 2),
            "gross_profit": round(gross_profit, 2),
            "margin_pct": margin_pct,
        })
    result.sort(key=lambda x: -x["gross_profit"])
    return result
