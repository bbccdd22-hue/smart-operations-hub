"""
Sales Summary API — Oracle legacy style (SALES view).
Replicates: SALESPERSON_ID, CUSTOMER_ID, PRODUCT_ID, SUM(ITEM.TOTAL) AS AMOUNT.
We use: branch, product (product_name), total_sales from ProductSale.
GET /api/analytics/sales-summary/?from_date=&to_date=&branch_id=&group_by=branch|product
"""
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.report_data_sources import (
    CANONICAL_SALES_FIELD,
    PRODUCT_SALE_EXCLUDE_SUMMARY,
)


def _parse_date(s: str | None, default: date) -> date:
    if not s:
        return default
    try:
        return date.fromisoformat(s)
    except Exception:
        return default


class SalesSummaryView(APIView):
    """
    GET /api/analytics/sales-summary/
    Query: from_date, to_date, branch_id (optional), group_by=branch|product
    Returns: by_branch, by_product, total_sales (Oracle SALES view style).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from imports.models import ProductSale
        from org.models import Branch

        today = date.today()
        from_date = _parse_date(request.query_params.get("from_date"), today - timedelta(days=30))
        to_date = _parse_date(request.query_params.get("to_date"), today)
        branch_id = request.query_params.get("branch_id")
        group_by = request.query_params.get("group_by", "branch")  # branch | product

        if from_date > to_date:
            from_date, to_date = to_date, from_date

        qs = ProductSale.objects.filter(
            date__gte=from_date,
            date__lte=to_date,
        ).exclude(PRODUCT_SALE_EXCLUDE_SUMMARY)

        branch_ids = None
        if branch_id:
            try:
                bid = int(branch_id)
                qs = qs.filter(branch_id=bid)
                branch_ids = [bid]
            except ValueError:
                pass
        else:
            # Scope by user's accessible branches
            from analytics.views import _apply_branch_scope
            all_branches = Branch.objects.filter(is_active=True)
            scoped = _apply_branch_scope(request, all_branches)
            branch_ids = list(scoped.values_list("id", flat=True))
            if branch_ids:
                qs = qs.filter(branch_id__in=branch_ids)

        # Total
        total_agg = qs.aggregate(total=Sum(CANONICAL_SALES_FIELD))
        total_sales = float((total_agg.get("total") or Decimal("0")).quantize(Decimal("0.01")))

        # By branch
        by_branch = []
        branch_qs = qs.values("branch_id", "branch__name", "branch__name_ar").annotate(
            amount=Sum(CANONICAL_SALES_FIELD)
        ).order_by("-amount")
        for row in branch_qs:
            by_branch.append({
                "branch_id": row["branch_id"],
                "branch_name": row["branch__name"] or "",
                "branch_name_ar": row["branch__name_ar"] or "",
                "amount": float((row["amount"] or Decimal("0")).quantize(Decimal("0.01"))),
            })

        # By product (product_name as category/label)
        by_product = []
        if group_by == "product":
            prod_qs = qs.values("product_name", "product_sku").annotate(
                amount=Sum(CANONICAL_SALES_FIELD)
            ).order_by("-amount")[:100]
            for row in prod_qs:
                by_product.append({
                    "product_name": row["product_name"] or "",
                    "product_sku": row["product_sku"] or "",
                    "amount": float((row["amount"] or Decimal("0")).quantize(Decimal("0.01"))),
                })

        return Response({
            "from_date": str(from_date),
            "to_date": str(to_date),
            "total_sales": total_sales,
            "by_branch": by_branch,
            "by_product": by_product,
        })
