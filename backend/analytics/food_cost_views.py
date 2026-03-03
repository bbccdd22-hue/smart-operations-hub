"""
Food Cost Analytics API
========================

GET /api/dashboard/food-cost/?period=day|week|month&branch_id=<id>

Returns:
  - food_cost_pct: overall food cost % for the period
  - food_cost_sar: total food cost in SAR
  - revenue_sar: total revenue for the period
  - top_expensive_dishes: top 10 most expensive dishes (cost per serving)
  - top_waste_ingredients: top 5 ingredients by waste quantity/cost
  - reorder_alerts: ingredients below reorder level
  - trend: daily food cost % for the period (for chart)
"""
from __future__ import annotations

from datetime import date, timedelta
from datetime import datetime as _datetime
from decimal import Decimal

from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


def _period_dates(period: str) -> tuple[date, date]:
    today = timezone.now().date()
    if period == "day":
        return today, today
    elif period == "week":
        start = today - timedelta(days=today.weekday())
        return start, today
    elif period == "month":
        return today.replace(day=1), today
    else:
        # Default: last 30 days
        return today - timedelta(days=29), today


def _get_revenue(branch_ids: list[int], date_from: date, date_to: date) -> Decimal:
    """Sum system_total_sales from ShiftClosings in range."""
    from shifts.models import ShiftClosing
    from django.db.models import Sum
    if not branch_ids:
        return Decimal("0")
    qs = ShiftClosing.objects.filter(
        shift__branch_id__in=branch_ids,
        submitted_at__date__gte=date_from,
        submitted_at__date__lte=date_to,
    )
    total = qs.aggregate(s=Sum("system_total_sales"))["s"]
    return total or Decimal("0")


def _get_food_cost_sar(branch_ids: list[int], date_from: date, date_to: date) -> Decimal:
    """
    Food cost = sum of depletion (StockMovement type=depletion) × unit_cost.
    Falls back to 0 if ingredients have no unit_cost.
    """
    if not branch_ids:
        return Decimal("0")
    from inventory.models import StockMovement, StockMovementType
    from django.db.models import Sum

    dt_from = _datetime.combine(date_from, _datetime.min.time())
    dt_to = _datetime.combine(date_to, _datetime.max.time())

    movements = StockMovement.objects.filter(
        branch_id__in=branch_ids,
        movement_type=StockMovementType.DEPLETION,
        created_at__gte=dt_from,
        created_at__lte=dt_to,
    ).select_related("ingredient")

    total_cost = Decimal("0")
    for mv in movements:
        unit_cost = mv.ingredient.unit_cost or Decimal("0")
        total_cost += abs(mv.qty_delta) * unit_cost
    return total_cost


def _get_top_expensive_dishes(limit: int = 10) -> list[dict]:
    """Top dishes sorted by cost_per_serving descending."""
    from inventory.models import Recipe

    results = []
    for recipe in Recipe.objects.prefetch_related("lines__ingredient", "lines__unit").select_related("product"):
        cost = recipe.total_ingredients_cost
        product = recipe.product
        selling_price = product.price_excl_tax or Decimal("0")
        food_cost_pct = None
        if selling_price > 0 and cost > 0:
            food_cost_pct = float((cost / selling_price * 100).quantize(Decimal("0.1")))

        results.append({
            "product_id": product.pk,
            "product_name": product.name,
            "cost_per_serving": float(cost.quantize(Decimal("0.01"))),
            "selling_price": float(selling_price.quantize(Decimal("0.01"))),
            "food_cost_pct": food_cost_pct,
        })

    results.sort(key=lambda x: x["cost_per_serving"], reverse=True)
    return results[:limit]


def _get_top_waste_ingredients(
    branch_ids: list[int], date_from: date, date_to: date, limit: int = 5
) -> list[dict]:
    """Top ingredients by waste log qty × unit_cost."""
    if not branch_ids:
        return []
    from inventory.models import WasteLog
    from django.db.models import Sum

    dt_from = _datetime.combine(date_from, _datetime.min.time())
    dt_to = _datetime.combine(date_to, _datetime.max.time())

    waste_qs = (
        WasteLog.objects.filter(
            branch_id__in=branch_ids,
            created_at__gte=dt_from,
            created_at__lte=dt_to,
        )
        .select_related("ingredient")
        .values("ingredient_id", "ingredient__name_en", "ingredient__name_ar", "ingredient__unit_cost")
        .annotate(total_variance=Sum("variance"))
    )

    results = []
    for row in waste_qs:
        variance = row["total_variance"] or Decimal("0")
        unit_cost = row["ingredient__unit_cost"] or Decimal("0")
        waste_cost = float((abs(variance) * unit_cost).quantize(Decimal("0.01")))
        results.append({
            "ingredient_id": row["ingredient_id"],
            "ingredient_name": row["ingredient__name_en"],
            "ingredient_name_ar": row["ingredient__name_ar"] or "",
            "waste_qty": float(abs(variance).quantize(Decimal("0.001"))),
            "waste_cost_sar": waste_cost,
        })

    results.sort(key=lambda x: x["waste_cost_sar"], reverse=True)
    return results[:limit]


def _get_reorder_alerts(branch_ids: list[int]) -> list[dict]:
    """Ingredients where on_hand < reorder_level (if reorder_level set)."""
    if not branch_ids:
        return []
    from inventory.models import BranchStock

    qs = BranchStock.objects.filter(
        branch_id__in=branch_ids,
        ingredient__is_active=True,
    ).select_related("ingredient", "ingredient__base_unit", "branch")

    alerts = []
    for stock in qs:
        # Use 10 units as a simple reorder threshold (can be customized per ingredient later)
        reorder_level = Decimal("10")
        if stock.on_hand < reorder_level:
            alerts.append({
                "ingredient_id": stock.ingredient_id,
                "ingredient_name": stock.ingredient.name_en,
                "ingredient_name_ar": stock.ingredient.name_ar or "",
                "branch_id": stock.branch_id,
                "branch_name": stock.branch.name,
                "on_hand": float(stock.on_hand.quantize(Decimal("0.001"))),
                "unit": stock.ingredient.base_unit.code,
                "reorder_level": float(reorder_level),
            })
    return alerts[:20]


def _get_daily_trend(
    branch_ids: list[int], date_from: date, date_to: date
) -> list[dict]:
    """Daily food cost % trend for chart."""
    from inventory.models import StockMovement, StockMovementType

    trend = []
    current = date_from
    while current <= date_to:
        dt_from = _datetime.combine(current, _datetime.min.time())
        dt_to = _datetime.combine(current, _datetime.max.time())

        revenue = _get_revenue(branch_ids, current, current)

        movements = StockMovement.objects.filter(
            branch_id__in=branch_ids,
            movement_type=StockMovementType.DEPLETION,
            created_at__gte=dt_from,
            created_at__lte=dt_to,
        ).select_related("ingredient")

        food_cost = Decimal("0")
        for mv in movements:
            uc = mv.ingredient.unit_cost or Decimal("0")
            food_cost += abs(mv.qty_delta) * uc

        pct = None
        if revenue > 0:
            pct = float((food_cost / revenue * 100).quantize(Decimal("0.1")))

        trend.append({
            "date": str(current),
            "food_cost_sar": float(food_cost.quantize(Decimal("0.01"))),
            "revenue_sar": float(revenue.quantize(Decimal("0.01"))),
            "food_cost_pct": pct,
        })
        current += timedelta(days=1)

    return trend


class FoodCostDashboardView(APIView):
    """
    GET /api/dashboard/food-cost/

    Query params:
      period=day|week|month   (default: week)
      branch_id=<int>         (default: all user branches)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from analytics.views import _apply_branch_scope
        from org.models import Branch

        period = request.query_params.get("period", "week")
        branch_id = request.query_params.get("branch_id")

        date_from, date_to = _period_dates(period)

        # Resolve branches from user scope
        all_branches = Branch.objects.filter(is_active=True)
        scoped_branches = _apply_branch_scope(request, all_branches)
        if branch_id:
            try:
                branch_ids = [int(branch_id)]
            except ValueError:
                branch_ids = list(scoped_branches.values_list("id", flat=True))
        else:
            branch_ids = list(scoped_branches.values_list("id", flat=True))

        if not branch_ids:
            # No branches in scope — return zeroed structure with date points for trend
            if period == "day":
                trend_empty = [{"date": str(date_from), "food_cost_sar": 0, "revenue_sar": 0, "food_cost_pct": None}]
            else:
                trend_empty = [
                    {"date": str(date_from + timedelta(days=i)), "food_cost_sar": 0, "revenue_sar": 0, "food_cost_pct": None}
                    for i in range((date_to - date_from).days + 1)
                ]
            return Response({
                "period": period,
                "date_from": str(date_from),
                "date_to": str(date_to),
                "food_cost_pct": None,
                "food_cost_sar": 0,
                "revenue_sar": 0,
                "top_expensive_dishes": _get_top_expensive_dishes(),
                "top_waste_ingredients": [],
                "reorder_alerts": [],
                "trend": trend_empty,
            })

        revenue = _get_revenue(branch_ids, date_from, date_to)
        food_cost = _get_food_cost_sar(branch_ids, date_from, date_to)
        food_cost_pct = None
        if revenue > 0:
            food_cost_pct = float((food_cost / revenue * 100).quantize(Decimal("0.1")))

        # Only run trend for week/month (day is single point)
        if period == "day":
            trend = [{
                "date": str(date_from),
                "food_cost_sar": float(food_cost.quantize(Decimal("0.01"))),
                "revenue_sar": float(revenue.quantize(Decimal("0.01"))),
                "food_cost_pct": food_cost_pct,
            }]
        else:
            trend = _get_daily_trend(branch_ids, date_from, date_to)

        return Response({
            "period": period,
            "date_from": str(date_from),
            "date_to": str(date_to),
            "food_cost_pct": food_cost_pct,
            "food_cost_sar": float(food_cost.quantize(Decimal("0.01"))),
            "revenue_sar": float(revenue.quantize(Decimal("0.01"))),
            "top_expensive_dishes": _get_top_expensive_dishes(),
            "top_waste_ingredients": _get_top_waste_ingredients(branch_ids, date_from, date_to),
            "reorder_alerts": _get_reorder_alerts(branch_ids),
            "trend": trend,
        })
