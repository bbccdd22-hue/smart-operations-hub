"""
Authentication views: Login, Logout, Current User.
"""
from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from core.permissions import get_user_profile
from org.models import UserRole


@ensure_csrf_cookie
@require_GET
def csrf_token_view(request):
    """Ensure CSRF cookie is set for SPA."""
    get_token(request)
    return JsonResponse({"detail": "CSRF cookie set"})


@require_POST
def login_view(request):
    """Session-based login. Expects JSON: {username, password}."""
    import json
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return JsonResponse({"detail": "Username and password required"}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"detail": "Invalid credentials"}, status=401)

    if not user.is_active:
        return JsonResponse({"detail": "Account disabled"}, status=401)

    login(request, user)
    from core.activity_log import log_activity
    from core.permissions import is_super_admin

    log_activity(user, "login", "تسجيل دخول", request=request)
    try:
        from hr.attendance_services import record_clock_in
        record_clock_in(user)
    except Exception:
        pass
    profile = get_user_profile(user)
    branch = profile.branch if profile else None
    brand = (branch.brand if branch else profile.brand) if profile else None
    display_name = f"{(getattr(user, 'first_name', '') or '').strip()} {(getattr(user, 'last_name', '') or '').strip()}".strip() or user.username
    _all_perms = [
        "view_financial_reports", "upload_files", "view_activity_log", "edit_chart_of_accounts",
        "perm_shift_closing", "perm_financial_reports", "perm_management_reports",
        "perm_full_system_access", "perm_order_forecasting", "perm_financial_auditor",
        "view_cost_price", "cancel_invoice", "view_customer_phone",
    ]
    perms = {k: True for k in _all_perms} if is_super_admin(user) else _get_role_permissions(profile)
    return JsonResponse({
        "user": {
            "id": user.id,
            "username": user.username,
            "email": getattr(user, "email", "") or "",
            "role": profile.role if profile else UserRole.BRANCH_SUPERVISOR,
            "brand_id": brand.id if brand else None,
            "branch_id": branch.id if branch else None,
            "brand_slug": brand.slug if brand else None,
            "branch_name": branch.name if branch else None,
            "employee_id": profile.employee_id if profile else "",
            "display_name": display_name,
            "permissions": perms,
        }
    })


@require_POST
def logout_view(request):
    """Session logout."""
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        try:
            from hr.attendance_services import record_clock_out
            record_clock_out(user)
        except Exception:
            pass
    logout(request)
    return JsonResponse({"detail": "Logged out"})


def _get_role_permissions(profile):
    """صلاحيات الدور – تُضاف لـ auth/me للتطبيق الفوري."""
    from core.permissions import _role_has_permission
    if not profile:
        return {}
    keys = [
        "view_financial_reports", "upload_files", "view_activity_log", "edit_chart_of_accounts",
        "perm_shift_closing", "perm_financial_reports", "perm_management_reports",
        "perm_full_system_access", "perm_order_forecasting", "perm_financial_auditor",
        "view_cost_price", "cancel_invoice", "view_customer_phone",
    ]
    return {k: _role_has_permission(profile, k) for k in keys}


class CurrentUserView(APIView):
    """Returns current authenticated user and role."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core.permissions import is_super_admin
        user = request.user
        profile = get_user_profile(user)
        branch = profile.branch if profile else None
        brand = (branch.brand if branch else profile.brand) if profile else None
        display_name = f"{(getattr(user, 'first_name', '') or '').strip()} {(getattr(user, 'last_name', '') or '').strip()}".strip() or user.username
        _all_perms = [
            "view_financial_reports", "upload_files", "view_activity_log", "edit_chart_of_accounts",
            "perm_shift_closing", "perm_financial_reports", "perm_management_reports",
            "perm_full_system_access", "perm_order_forecasting", "perm_financial_auditor",
            "view_cost_price", "cancel_invoice", "view_customer_phone",
        ]
        perms = {k: True for k in _all_perms} if is_super_admin(user) else _get_role_permissions(profile)
        return Response({
            "user": {
                "id": user.id,
                "username": user.username,
                "email": getattr(user, "email", "") or "",
                "role": profile.role if profile else UserRole.BRANCH_SUPERVISOR,
                "brand_id": brand.id if brand else None,
                "branch_id": branch.id if branch else None,
                "brand_slug": brand.slug if brand else None,
                "branch_name": branch.name if branch else None,
                "employee_id": profile.employee_id if profile else "",
                "display_name": display_name,
                "permissions": perms,
            }
        })
