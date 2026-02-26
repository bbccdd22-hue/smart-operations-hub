"""Profit & Waste Control Center API."""
from datetime import datetime

from rest_framework import permissions, response, views

from core.permissions import can_view_cost_price
from org.models import Branch, Brand

from inventory.profit_services import get_profit_summary


class FinancialSummaryView(views.APIView):
    """
    api/financials/summary/
    Total Sales (Foodics), Total Cost (Prep List × unit_cost), Net Profit.
    Query: branch_id, branch_ids, date_from, date_to, brands.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        branch_id = request.query_params.get("branch_id")
        branch_ids_param = request.query_params.get("branch_ids")
        brands_param = request.query_params.get("brands")
        date_from_s = request.query_params.get("date_from")
        date_to_s = request.query_params.get("date_to")

        branch_ids = None
        brand_ids = None

        if branch_ids_param:
            try:
                branch_ids = [int(x.strip()) for x in branch_ids_param.split(",") if x.strip()]
            except (TypeError, ValueError):
                pass
        elif branch_id:
            try:
                branch_ids = [int(branch_id)]
            except (TypeError, ValueError):
                pass

        if brands_param:
            slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
            if slugs:
                brand_ids = list(Brand.objects.filter(slug__in=slugs).values_list("id", flat=True))

        if not branch_ids and not brand_ids:
            branch_ids = list(Branch.objects.filter(is_active=True).values_list("id", flat=True)[:50])

        today = datetime.now().date()
        try:
            date_from = datetime.strptime(date_from_s or "", "%Y-%m-%d").date() if date_from_s else today
        except ValueError:
            date_from = today
        try:
            date_to = datetime.strptime(date_to_s or "", "%Y-%m-%d").date() if date_to_s else today
        except ValueError:
            date_to = today

        # إعادة حساب من الصفر في كل طلب – لا cache، النطاق التاريخي صارم فقط
        result = get_profit_summary(
            branch_ids=branch_ids,
            date_from=date_from,
            date_to=date_to,
            brand_ids=brand_ids if not branch_ids else None,
        )
        if not can_view_cost_price(request.user):
            result = {
                "total_sales": result.get("total_sales", "0"),
                "total_cogs": None,
                "gross_profit": None,
                "ingredients_with_cost": [],
                "flagged_for_review": [],
                **({"error": result["error"]} if "error" in result else {}),
            }
        resp = response.Response(result)
        resp["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return resp
