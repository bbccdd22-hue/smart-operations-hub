"""
Tenant & Request Context - للعزل وتدقيق الطلبات.
يخزن الطلب الحالي في thread-local ليصل إليه التدقيق والـ Tenant.
"""
import threading

_request_local = threading.local()


def get_current_request():
    return getattr(_request_local, "request", None)


def get_current_tenant_org():
    """المؤسسة الحالية من الطلب (من بروفايل المستخدم)."""
    request = get_current_request()
    if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
        return None
    profile = getattr(request.user, "profile", None)
    if not profile:
        return None
    brand = getattr(profile, "brand", None)
    if brand and hasattr(brand, "organization"):
        return brand.organization_id
    return None


class RequestContextMiddleware:
    """يخزن الطلب الحالي في thread-local."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _request_local.request = request
        try:
            return self.get_response(request)
        finally:
            if hasattr(_request_local, "request"):
                del _request_local.request
