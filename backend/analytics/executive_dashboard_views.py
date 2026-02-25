"""
لوحة تحكم المالك النهائية – Executive Dashboard API.
"""
from datetime import datetime, timedelta

from rest_framework import permissions, response, views

from core.permissions import get_user_scope, is_super_admin
from org.models import Branch

from analytics.executive_dashboard_services import (
    get_net_profit_series,
    get_safety_alerts,
    get_product_profitability,
    get_branch_efficiency,
)


def _resolve_branch_ids(request):
    """Resolve branch_ids from request params and user scope."""
    branch_ids_param = request.query_params.get("branch_ids")
    branch_id = request.query_params.get("branch_id")
    brand = request.query_params.get("brand")
    brands_param = request.query_params.get("brands")

    qs = Branch.objects.filter(is_active=True)
    if brand:
        qs = qs.filter(brand__slug=brand)
    elif brands_param:
        slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
        if slugs:
            qs = qs.filter(brand__slug__in=slugs)

    if request.user.is_authenticated:
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None:
            qs = qs.filter(id__in=(scope["branch_ids"] or []))

    branch_ids = list(qs.values_list("id", flat=True))
    if branch_id:
        try:
            bid = int(branch_id)
            if bid in branch_ids:
                branch_ids = [bid]
        except (ValueError, TypeError):
            pass
    elif branch_ids_param:
        try:
            branch_ids = [int(x.strip()) for x in branch_ids_param.split(",") if x.strip()]
        except (ValueError, TypeError):
            pass

    return branch_ids if branch_ids else list(Branch.objects.filter(is_active=True).values_list("id", flat=True))


class ExecutiveDashboardView(views.APIView):
    """
    لوحة تحكم المالك النهائية:
    - سلسلة صافي الربح (مبيعات - تكاليف - رواتب - إهلاك)
    - تنبيهات الأمان: عجز مخزني، تأخير حضور، طلبات شراء معلقة
    - تقارير: أكثر المنتجات ربحية، أكثر الفروع كفاءة
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_super_admin(request.user):
            from core.permissions import _role_has_permission, get_user_profile
            profile = get_user_profile(request.user)
            if not _role_has_permission(profile, "perm_full_system_access"):
                return response.Response({"detail": "غير مصرح"}, status=403)

        date_from_s = request.query_params.get("date_from")
        date_to_s = request.query_params.get("date_to")
        today = datetime.now().date()

        try:
            date_from = datetime.strptime(date_from_s, "%Y-%m-%d").date() if date_from_s else today - timedelta(days=30)
            date_to = datetime.strptime(date_to_s, "%Y-%m-%d").date() if date_to_s else today
        except ValueError:
            date_from = today - timedelta(days=30)
            date_to = today

        if date_from > date_to:
            date_from, date_to = date_to, date_from

        branch_ids = _resolve_branch_ids(request)
        if not branch_ids:
            return response.Response({
                "net_profit_series": [],
                "safety_alerts": {"stock_shortage": [], "late_attendance": [], "pending_purchase_orders": []},
                "top_profitable_products": [],
                "branch_efficiency": [],
            })

        net_profit_series = get_net_profit_series(branch_ids, date_from, date_to)
        safety_alerts = get_safety_alerts(branch_ids)
        top_products = get_product_profitability(branch_ids, date_from, date_to, top_n=10)
        branch_eff = get_branch_efficiency(branch_ids, date_from, date_to)

        return response.Response({
            "filters": {"date_from": str(date_from), "date_to": str(date_to), "branch_ids": branch_ids},
            "net_profit_series": net_profit_series,
            "safety_alerts": safety_alerts,
            "top_profitable_products": top_products,
            "branch_efficiency": branch_eff,
        })
