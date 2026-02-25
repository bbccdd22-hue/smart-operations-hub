"""
BI API - التقارير الذكية.
"""
from rest_framework import permissions, response, views

from core.permissions import get_user_scope
from .services import forecast_sales_next_week, get_advanced_profit_report, get_control_center_data


class AdvancedProfitReportView(views.APIView):
    """تقرير الربحية المتقدمة."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        brand_id = request.query_params.get("brand_id")
        branch_ids = request.query_params.get("branch_ids")
        from_date = request.query_params.get("from_date")
        to_date = request.query_params.get("to_date")

        bid = int(brand_id) if brand_id and brand_id.isdigit() else None
        brids = None
        if branch_ids:
            try:
                brids = [int(x.strip()) for x in branch_ids.split(",") if x.strip().isdigit()]
            except (ValueError, AttributeError):
                pass
        if scope["branch_ids"] and brids:
            brids = [b for b in brids if b in (scope["branch_ids"] or [])]

        data = get_advanced_profit_report(
            brand_id=bid,
            branch_ids=brids,
            from_date=from_date,
            to_date=to_date,
        )
        return response.Response(data)


class SalesForecastView(views.APIView):
    """التنبؤ بالمبيعات للأسبوع القادم."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        branch_id = request.query_params.get("branch_id")
        brand_id = request.query_params.get("brand_id")

        bid = int(branch_id) if branch_id and branch_id.isdigit() else None
        brand_id_int = int(brand_id) if brand_id and brand_id.isdigit() else None
        if scope["branch_ids"] and bid and bid not in (scope["branch_ids"] or []):
            bid = None

        data = forecast_sales_next_week(branch_id=bid, brand_id=brand_id_int)
        return response.Response(data)


class ControlCenterView(views.APIView):
    """مركز المراقبة - مبيعات لحظية، حالة الفروع، تنبيهات."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        brand_id = request.query_params.get("brand_id")
        branch_ids = request.query_params.get("branch_ids")

        bid = int(brand_id) if brand_id and brand_id.isdigit() else None
        brids = None
        if branch_ids:
            try:
                brids = [int(x.strip()) for x in branch_ids.split(",") if x.strip().isdigit()]
            except (ValueError, AttributeError):
                pass
        if scope["branch_ids"] and brids:
            brids = [b for b in brids if b in (scope["branch_ids"] or [])]

        data = get_control_center_data(brand_id=bid, branch_ids=brids)
        return response.Response(data)
