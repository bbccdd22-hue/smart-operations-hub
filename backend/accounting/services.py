"""
Reconciliation logic: combines Source A (Excel), B (ShiftClosing), C (Settlements).
Foodics Payment data is REFERENCE ONLY - shows variances, never overrides Actual Cash.
"""
from datetime import date
from decimal import Decimal
from typing import Any

from django.db.models import Sum

from accounting.models import FoodicsPaymentCategory, FoodicsPaymentRecord
from imports.models import DailySale
from org.models import Branch
from shifts.models import ShiftClosing


def get_daily_reconciliation(
    target_date: date,
    brand_slug: str | None = None,
    branch_ids: list[int] | None = None,
    submitted_only: bool = False,
) -> list[dict[str, Any]]:
    """
    Returns reconciliation rows: one per branch per date.
    Columns: branch_id, branch_name, brand_name, system_cash, actual_cash, cash_variance,
             system_card, actual_card, card_variance, delivery_total, manual_notes, has_variance
    """
    qs = Branch.objects.filter(is_active=True).select_related("brand")
    if brand_slug:
        qs = qs.filter(brand__slug=brand_slug)
    if branch_ids:
        qs = qs.filter(id__in=branch_ids)

    # System values from DailySale (Source A)
    daily_by_branch = {
        r["branch_id"]: {"cash": r["cash"], "network": r["network"]}
        for r in DailySale.objects.filter(
            date=target_date,
            branch_id__in=[b.id for b in qs],
        ).values("branch_id").annotate(
            cash=Sum("cash_amount"),
            network=Sum("network_amount"),
        )
    }

    # Foodics Payments Report (REFERENCE ONLY - for variance display)
    foodics_by_branch: dict[int, dict[str, float]] = {}
    for r in FoodicsPaymentRecord.objects.filter(
        report_date=target_date,
        branch_id__in=[b.id for b in qs],
    ).values("branch_id", "category").annotate(amt=Sum("net_amount")):
        bid = r["branch_id"]
        if bid not in foodics_by_branch:
            foodics_by_branch[bid] = {"cash": 0.0, "span": 0.0, "delivery_apps": 0.0}
        amt = float(r["amt"] or 0)
        if r["category"] == FoodicsPaymentCategory.CASH:
            foodics_by_branch[bid]["cash"] += amt
        elif r["category"] == FoodicsPaymentCategory.SPAN:
            foodics_by_branch[bid]["span"] += amt
        elif r["category"] == FoodicsPaymentCategory.DELIVERY_APPS:
            foodics_by_branch[bid]["delivery_apps"] += amt

    # Actual + system from ShiftClosing (Source B)
    closings_qs = ShiftClosing.objects.filter(
        shift__opened_at__date=target_date,
        shift__branch__in=qs,
    ).select_related("shift", "shift__branch", "shift__branch__brand")
    if submitted_only:
        closings_qs = closings_qs.filter(status="submitted")
    closings = list(closings_qs)

    by_branch: dict[int, dict[str, Any]] = {}
    for c in closings:
        bid = c.shift.branch_id
        if bid not in by_branch:
            by_branch[bid] = {
                "branch_id": bid,
                "branch_name": c.shift.branch.name,
                "brand_name": c.shift.branch.brand.name,
                "system_cash": float(c.system_cash or 0),
                "actual_cash": float(c.manual_cash_total()),
                "system_card": float(c.system_network or 0),
                "actual_card": float(c.manual_network_total()),
                "delivery_total": float(c.manual_delivery_total()),
                "manual_notes": c.shift.notes or "",
            }
        else:
            by_branch[bid]["actual_cash"] += float(c.manual_cash_total())
            by_branch[bid]["actual_card"] += float(c.manual_network_total())
            by_branch[bid]["delivery_total"] += float(c.manual_delivery_total())
            by_branch[bid]["system_cash"] += float(c.system_cash or 0)
            by_branch[bid]["system_card"] += float(c.system_network or 0)
            if c.shift.notes:
                by_branch[bid]["manual_notes"] += "\n" + c.shift.notes

    # Fill from DailySale for branches with no shift closing; prefer DailySale when ShiftClosing system is zero
    for b in qs:
        sys = daily_by_branch.get(b.id, {})
        if b.id not in by_branch:
            # Only include branches that have DailySale data (avoid empty rows)
            if sys.get("cash") or sys.get("network"):
                by_branch[b.id] = {
                    "branch_id": b.id,
                    "branch_name": b.name,
                    "brand_name": b.brand.name,
                    "system_cash": float(sys.get("cash") or 0),
                    "actual_cash": 0.0,
                    "system_card": float(sys.get("network") or 0),
                    "actual_card": 0.0,
                    "delivery_total": 0.0,
                    "manual_notes": "",
                }
        else:
            if by_branch[b.id]["system_cash"] == 0 and sys.get("cash"):
                by_branch[b.id]["system_cash"] = float(sys["cash"])
            if by_branch[b.id]["system_card"] == 0 and sys.get("network"):
                by_branch[b.id]["system_card"] = float(sys["network"])

    # Compute variances and attach Foodics reference (for Reconciliation view)
    result = []
    for bid, row in by_branch.items():
        cash_var = round(row["actual_cash"] - row["system_cash"], 2)
        card_var = round(row["actual_card"] - row["system_card"], 2)
        row["cash_variance"] = cash_var
        row["card_variance"] = card_var
        row["has_variance"] = cash_var != 0 or card_var != 0

        # Foodics reference (variance vs employee entry - NEVER overrides actual_cash)
        # Only set when we have Foodics data for this branch
        has_foodics = bid in foodics_by_branch
        fref = foodics_by_branch.get(bid, {})
        row["foodics_cash"] = round(fref.get("cash", 0), 2) if has_foodics else None
        row["foodics_span"] = round(fref.get("span", 0), 2) if has_foodics else None
        row["foodics_delivery"] = round(fref.get("delivery_apps", 0), 2) if has_foodics else None
        row["foodics_cash_variance"] = (
            round(row["actual_cash"] - fref.get("cash", 0), 2) if has_foodics else None
        )
        row["foodics_span_variance"] = (
            round(row["actual_card"] - fref.get("span", 0), 2) if has_foodics else None
        )
        result.append(row)

    return sorted(result, key=lambda r: (r["brand_name"], r["branch_name"]))


def get_financial_summary(
    date_from: date,
    date_to: date,
    brand_slug: str | None = None,
    brand_slugs: list[str] | None = None,
    branch_ids: list[int] | None = None,
) -> dict[str, float]:
    """
    [Ref: 86561c, 873374] Financial Summary uses Payments Report (تقرير المقبوضات) ONLY.
    NO overlap with Daily Sales. Source: FoodicsPaymentRecord.
    - Cash Foodics (كاش فودكس): Sum of كاش/Cash
    - Span (سبان): Sum of سبان/Span
    - Delivery Apps (تطبيقات التوصيل): Jahez, ToYou, Hanger Station, etc.
    """
    from django.db.models import Sum

    qs = FoodicsPaymentRecord.objects.filter(
        report_date__gte=date_from,
        report_date__lte=date_to,
        branch__is_active=True,
    )
    if brand_slugs:
        qs = qs.filter(branch__brand__slug__in=brand_slugs)
    elif brand_slug:
        qs = qs.filter(branch__brand__slug=brand_slug)
    if branch_ids:
        qs = qs.filter(branch_id__in=branch_ids)

    agg = qs.values("category").annotate(amt=Sum("net_amount"))
    cash_foodics = 0.0
    span = 0.0
    delivery_apps = 0.0
    for r in agg:
        amt = float(r["amt"] or 0)
        if r["category"] == FoodicsPaymentCategory.CASH:
            cash_foodics += amt
        elif r["category"] == FoodicsPaymentCategory.SPAN:
            span += amt
        elif r["category"] == FoodicsPaymentCategory.DELIVERY_APPS:
            delivery_apps += amt

    # [Ref: 87a319] Branch breakdown for Cash Foodics and Span (عرض مفصل للفروع)
    cash_by_branch = list(
        qs.filter(category=FoodicsPaymentCategory.CASH)
        .values("branch_id", "branch__name", "branch__name_ar")
        .annotate(amt=Sum("net_amount"))
        .order_by("-amt")
    )
    span_by_branch = list(
        qs.filter(category=FoodicsPaymentCategory.SPAN)
        .values("branch_id", "branch__name", "branch__name_ar")
        .annotate(amt=Sum("net_amount"))
        .order_by("-amt")
    )
    cash_foodics_breakdown = [
        {
            "branch_id": r["branch_id"],
            "branch_name": r["branch__name_ar"] or r["branch__name"] or "",
            "total": round(float(r["amt"] or 0), 2),
        }
        for r in cash_by_branch
    ]
    span_breakdown = [
        {
            "branch_id": r["branch_id"],
            "branch_name": r["branch__name_ar"] or r["branch__name"] or "",
            "total": round(float(r["amt"] or 0), 2),
        }
        for r in span_by_branch
    ]

    # [Ref: 86561c, 874561] Granular delivery: per app (Jahez, ToYou, Hanger Station) + per branch
    delivery_qs = qs.filter(category=FoodicsPaymentCategory.DELIVERY_APPS)
    by_app_branch = delivery_qs.values(
        "raw_method", "branch_id", "branch__name", "branch__name_ar"
    ).annotate(amt=Sum("net_amount"))
    app_totals: dict[str, float] = {}
    app_by_branch: dict[str, list[dict]] = {}
    for r in by_app_branch:
        app_name = (r.get("raw_method") or "Other").strip() or "Other"
        amt = float(r.get("amt") or 0)
        branch_name = r.get("branch__name_ar") or r.get("branch__name") or ""
        branch_id = r.get("branch_id") or 0
        app_totals[app_name] = app_totals.get(app_name, 0) + amt
        if app_name not in app_by_branch:
            app_by_branch[app_name] = []
        app_by_branch[app_name].append({
            "branch_id": branch_id,
            "branch_name": branch_name,
            "total": amt,
        })

    delivery_apps_breakdown = [
        {
            "app_name": name,
            "total": round(tot, 2),
            "by_branch": [
                {"branch_id": b["branch_id"], "branch_name": b["branch_name"], "total": round(b["total"], 2)}
                for b in sorted(app_by_branch.get(name, []), key=lambda x: -x["total"])
            ],
        }
        for name, tot in sorted(app_totals.items(), key=lambda x: -x[1])
    ]

    return {
        "cash_foodics": round(cash_foodics, 2),
        "span": round(span, 2),
        "delivery_apps": round(delivery_apps, 2),
        "cash_foodics_breakdown": cash_foodics_breakdown,
        "span_breakdown": span_breakdown,
        "delivery_apps_breakdown": delivery_apps_breakdown,
    }


def get_cash_to_bank(
    target_date: date,
    brand_slug: str | None = None,
) -> dict[str, Any]:
    """
    Cash-to-Bank report: collected vs expected deposit.
    """
    rows = get_daily_reconciliation(target_date, brand_slug=brand_slug)
    total_collected = sum(r["actual_cash"] for r in rows)
    total_system_cash = sum(r["system_cash"] for r in rows)
    total_variance = sum(r["cash_variance"] for r in rows)
    return {
        "date": str(target_date),
        "total_collected": round(total_collected, 2),
        "total_system_cash": round(total_system_cash, 2),
        "total_variance": round(total_variance, 2),
        "branches": rows,
    }


def get_discrepancy_alerts(
    days: int = 30,
    brand_slug: str | None = None,
    min_occurrences: int = 2,
    threshold: float = 50.0,
) -> list[dict[str, Any]]:
    """
    Branches with recurring cash shortages.
    """
    from datetime import timedelta

    start = date.today() - timedelta(days=days)
    alerts = []
    branch_shortages: dict[int, list[float]] = {}

    for d in (start + timedelta(i) for i in range(days + 1)):
        rows = get_daily_reconciliation(d, brand_slug=brand_slug)
        for r in rows:
            if r["cash_variance"] < -threshold:
                bid = r["branch_id"]
                branch_shortages.setdefault(bid, []).append(r["cash_variance"])

    for bid, variances in branch_shortages.items():
        if len(variances) >= min_occurrences:
            branch = Branch.objects.get(id=bid)
            alerts.append({
                "branch_id": bid,
                "branch_name": branch.name,
                "brand_name": branch.brand.name,
                "occurrences": len(variances),
                "total_shortage": round(sum(variances), 2),
                "avg_shortage": round(sum(variances) / len(variances), 2),
            })

    return sorted(alerts, key=lambda a: a["total_shortage"])
