"""
BI Services - الربحية المتقدمة والتنبؤ.
"""
from decimal import Decimal
from typing import Any

from django.db.models import Sum

from core.error_logging import log_system_error


def get_advanced_profit_report(
    brand_id: int | None = None,
    branch_ids: list[int] | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict[str, Any]:
    """
    تقرير الربحية المتقدمة:
    الربح الصافي = الإيرادات - (المواد الخام + الرواتب + الإيجار + الكهرباء + الإهلاك)
    """
    from accounting.consolidation_services import get_consolidated_income
    from accounting.models import JournalEntryLine
    from django.db.models import Q

    income = get_consolidated_income(
        brand_ids=[brand_id] if brand_id else brand_ids,
        branch_ids=branch_ids,
        from_date=from_date or "1900-01-01",
        to_date=to_date or "9999-12-31",
    )

    qs = JournalEntryLine.objects.filter(
        journal_entry__entry_date__gte=from_date or "1900-01-01",
        journal_entry__entry_date__lte=to_date or "9999-12-31",
    )
    if branch_ids:
        qs = qs.filter(journal_entry__branch_id__in=branch_ids)
    if brand_id:
        qs = qs.filter(journal_entry__branch__brand_id=brand_id)

    # تجميع حسب بداية كود الحساب (05 = مصروفات)
    raw_materials = qs.filter(account__code__startswith="051").aggregate(s=Sum("debit_amount"))["s"] or Decimal("0")
    salaries = qs.filter(account__code__startswith="052").aggregate(s=Sum("debit_amount"))["s"] or Decimal("0")
    rent = qs.filter(Q(account__code__startswith="053") | Q(account__name_ar__icontains="إيجار")).aggregate(s=Sum("debit_amount"))["s"] or Decimal("0")
    electricity = qs.filter(Q(account__code__startswith="054") | Q(account__name_ar__icontains="كهرباء")).aggregate(s=Sum("debit_amount"))["s"] or Decimal("0")
    depreciation = qs.filter(account__code__startswith="055").aggregate(s=Sum("debit_amount"))["s"] or Decimal("0")

    total_revenue = income["total_revenue"]
    total_expenses = income["total_expenses"]
    cogs_and_opex = raw_materials + salaries + rent + electricity + depreciation

    return {
        "total_revenue": float(total_revenue),
        "total_expenses": float(total_expenses),
        "net_income_basic": float(total_revenue - total_expenses),
        "breakdown": {
            "raw_materials": float(raw_materials),
            "salaries": float(salaries),
            "rent": float(rent),
            "electricity": float(electricity),
            "depreciation": float(depreciation),
        },
        "net_profit_advanced": float(total_revenue - total_expenses - cogs_and_opex),
    }


def forecast_sales_next_week(
    branch_id: int | None = None,
    brand_id: int | None = None,
) -> dict[str, Any]:
    """
    التنبؤ بالمبيعات - الأسبوع القادم.
    يستخدم المتوسط التاريخي (أو نموذج بسيط).
    """
    try:
        from imports.models import DailySale, ProductSale
        from django.db.models import Sum
        from django.utils import timezone
        from datetime import timedelta

        end = timezone.now().date()
        start = end - timedelta(days=90)

        qs = DailySale.objects.filter(date__gte=start, date__lte=end)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if brand_id:
            qs = qs.filter(branch__brand_id=brand_id)

        agg = qs.values("date").annotate(total=Sum("total_sales"))
        if not agg:
            return {"forecast": 0, "method": "no_data", "confidence": 0}

        totals = [float(r["total"] or 0) for r in agg]
        avg_weekly = sum(totals) / (len(totals) / 7) if totals else 0

        return {
            "forecast": round(avg_weekly, 2),
            "method": "historical_average",
            "confidence": 0.7,
            "period": "next_7_days",
        }
    except Exception as e:
        log_system_error("bi_forecast_failed", str(e), exc=e)
        return {"forecast": 0, "method": "error", "confidence": 0}


def get_control_center_data(
    brand_id: int | None = None,
    branch_ids: list[int] | None = None,
) -> dict[str, Any]:
    """
    مركز المراقبة - مبيعات لحظية، حالة الفروع، تنبيهات.
    """
    from django.db.models import Sum
    from django.utils import timezone
    from datetime import timedelta

    today = timezone.now().date()
    since = timezone.now() - timedelta(hours=24)

    branches_status = []
    recent_sales = []
    alerts = []

    try:
        from org.models import Branch
        from pos.models import SaleTransaction

        qs_branches = Branch.objects.filter(is_active=True)
        if brand_id:
            qs_branches = qs_branches.filter(brand_id=brand_id)
        if branch_ids:
            qs_branches = qs_branches.filter(id__in=branch_ids)

        for b in qs_branches[:50]:
            today_sales = SaleTransaction.objects.filter(
                branch=b,
                created_at__date=today,
            ).aggregate(s=Sum("total"))["s"] or 0
            last_sale = (
                SaleTransaction.objects.filter(branch=b)
                .order_by("-created_at")
                .values("sale_number", "total", "created_at")
                .first()
            )
            branches_status.append({
                "branch_id": b.id,
                "branch_name": b.name,
                "today_sales": float(today_sales),
                "last_sale": last_sale,
            })

        recent_qs = SaleTransaction.objects.filter(created_at__gte=since)
        if brand_id:
            recent_qs = recent_qs.filter(branch__brand_id=brand_id)
        if branch_ids:
            recent_qs = recent_qs.filter(branch_id__in=branch_ids)
        recent_sales = list(
            recent_qs.values("id", "sale_number", "branch_id", "total", "created_at")
            .order_by("-created_at")[:30]
        )
        for s in recent_sales:
            dt = s.get("created_at")
            s["created_at"] = dt.isoformat() if dt else None
            s["total"] = float(s.get("total") or 0)

        from quality.models import IoTAlert
        iot_alerts = list(
            IoTAlert.objects.filter(acknowledged=False)
            .select_related("device")
            .order_by("-created_at")[:20]
        )
        for a in iot_alerts:
            alerts.append({
                "type": "iot",
                "alert_type": a.alert_type,
                "message": a.message,
                "device_id": a.device.device_id if a.device else None,
                "created_at": a.created_at.isoformat(),
            })

        from inventory.models import BranchStock
        neg_stocks = BranchStock.objects.filter(on_hand__lt=0).select_related("branch", "ingredient")[:10]
        for ns in neg_stocks:
            alerts.append({
                "type": "negative_stock",
                "branch_id": ns.branch_id,
                "ingredient": ns.ingredient.name_en if ns.ingredient else "",
                "on_hand": float(ns.on_hand),
            })
    except Exception as e:
        log_system_error("bi_control_center_failed", str(e), exc=e)

    return {
        "branches_status": branches_status,
        "recent_sales": recent_sales,
        "alerts": alerts,
    }
