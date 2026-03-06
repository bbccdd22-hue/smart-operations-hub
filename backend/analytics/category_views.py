"""
Category Analytics API — للسوبرماركت
====================================
GET /api/dashboard/categories/?period=month&compare_branches=true

Returns:
  - category_sales: { beverages: { pct, sar, count }, meals: {...}, ... }
  - branch_comparison: [{ branch_name, beverages_pct, meals_pct, ... }]
  - abc_analysis: top 20% products = 80% of sales (Top 20 products by revenue)
"""
from __future__ import annotations

from datetime import date, timedelta
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
        return today - timedelta(days=29), today


class CategoryAnalyticsView(APIView):
    """
    GET /api/dashboard/categories/
    Query: period=day|week|month, compare_branches=true|false
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from analytics.views import _apply_branch_scope
        from org.models import Branch
        from pos.models import SaleTransaction
        from inventory.models import FoodicsProduct, ProductCategory

        period = request.query_params.get("period", "month")
        compare_branches = request.query_params.get("compare_branches", "false").lower() == "true"

        date_from, date_to = _period_dates(period)
        all_branches = Branch.objects.filter(is_active=True)
        scoped = _apply_branch_scope(request, all_branches)
        branch_ids = list(scoped.values_list("id", flat=True))

        if not branch_ids:
            empty_cats = {c: {"sar": 0, "pct": 0, "count": 0} for c, _ in ProductCategory.choices}
            return Response({
                "period": period,
                "date_from": str(date_from),
                "date_to": str(date_to),
                "category_sales": empty_cats,
                "total_revenue_sar": 0,
                "branch_comparison": [],
                "abc_analysis": [],
            })

        # Aggregate sales by product (from SaleTransaction.items) and map to category
        from django.db.models import Sum
        from datetime import datetime as _dt
        dt_from = _dt.combine(date_from, _dt.min.time())
        dt_to = _dt.combine(date_to, _dt.max.time())

        sales = SaleTransaction.objects.filter(
            branch_id__in=branch_ids,
            created_at__gte=dt_from,
            created_at__lte=dt_to,
        ).values_list("items", flat=True)

        # Build product_sku -> revenue map
        product_revenue: dict[str, Decimal] = {}
        for items in sales:
            if not isinstance(items, list):
                continue
            for it in items:
                sku = it.get("product_sku") or it.get("sku") or ""
                qty = Decimal(str(it.get("qty", 0) or 0))
                price = Decimal(str(it.get("unit_price", 0) or 0))
                if sku:
                    product_revenue[sku] = product_revenue.get(sku, Decimal("0")) + qty * price

        # Map SKU to product (foodics_product_id) and category
        products = FoodicsProduct.objects.filter(foodics_product_id__in=product_revenue.keys()).values("foodics_product_id", "name", "category")
        sku_to_cat = {p["foodics_product_id"]: p["category"] or "other" for p in products}
        sku_to_name = {p["foodics_product_id"]: p["name"] for p in products}

        # Aggregate by category
        cat_sales: dict[str, Decimal] = {}
        for sku, rev in product_revenue.items():
            cat = sku_to_cat.get(sku, "other")
            cat_sales[cat] = cat_sales.get(cat, Decimal("0")) + rev

        total_rev = sum(product_revenue.values()) or Decimal("1")
        category_sales = {}
        for cat, _ in ProductCategory.choices:
            sar = float(cat_sales.get(cat, Decimal("0")).quantize(Decimal("0.01")))
            pct = float((cat_sales.get(cat, Decimal("0")) / total_rev * 100).quantize(Decimal("0.1"))) if total_rev else 0
            count = sum(1 for s in sku_to_cat.values() if s == cat)
            category_sales[cat] = {"sar": sar, "pct": pct, "count": count}

        # ABC Analysis: top 20% products by revenue
        sorted_products = sorted(product_revenue.items(), key=lambda x: x[1], reverse=True)
        top_count = max(1, len(sorted_products) // 5)  # top 20%
        top_rev = sum(r for _, r in sorted_products[:top_count])
        abc_analysis = [
            {"sku": sku, "name": sku_to_name.get(sku, sku), "revenue_sar": float(rev)}
            for sku, rev in sorted_products[:min(20, len(sorted_products))]
        ]

        branch_comparison = []
        if compare_branches and len(branch_ids) > 1:
            for bid in branch_ids:
                branch_sales = SaleTransaction.objects.filter(
                    branch_id=bid,
                    created_at__gte=dt_from,
                    created_at__lte=dt_to,
                ).values_list("items", flat=True)
                b_rev: dict[str, Decimal] = {}
                for items in branch_sales:
                    if not isinstance(items, list):
                        continue
                    for it in items:
                        sku = it.get("product_sku") or it.get("sku") or ""
                        qty = Decimal(str(it.get("qty", 0) or 0))
                        price = Decimal(str(it.get("unit_price", 0) or 0))
                        if sku:
                            b_rev[sku] = b_rev.get(sku, Decimal("0")) + qty * price
                b_cat = {}
                b_total = sum(b_rev.values()) or Decimal("1")
                for sku, rev in b_rev.items():
                    cat = sku_to_cat.get(sku, "other")
                    b_cat[cat] = b_cat.get(cat, Decimal("0")) + rev
                branch = Branch.objects.get(pk=bid)
                branch_comparison.append({
                    "branch_id": bid,
                    "branch_name": branch.name,
                    **{f"{c}_pct": float((b_cat.get(c, Decimal("0")) / b_total * 100).quantize(Decimal("0.1"))) for c, _ in ProductCategory.choices},
                })

        return Response({
            "period": period,
            "date_from": str(date_from),
            "date_to": str(date_to),
            "category_sales": category_sales,
            "total_revenue_sar": float((total_rev or Decimal("0")).quantize(Decimal("0.01"))),
            "branch_comparison": branch_comparison,
            "abc_analysis": abc_analysis,
        })
