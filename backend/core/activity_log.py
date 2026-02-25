"""
سجل الرقابة – تسجيل حركات المستخدمين.
"""
from org.models import ActivityLog


def log_activity(user, action_type=None, description="", request=None, **kwargs):
    """
    سجّل حركة للمستخدم في ActivityLog.
    الاستخدام:
        log_activity(user, "login", "تسجيل دخول", request=request)
        log_activity(user, action_type="page_view", description="...", request=request, ...)
    """
    at = kwargs.pop("action_type", action_type) or "page_view"
    desc = (kwargs.get("description") or description or "")[:500]
    page_path = (kwargs.get("page_path") or "")[:256]
    file_name = (kwargs.get("file_name") or "")[:255]
    target_model = (kwargs.get("target_model") or "")[:64]
    target_id = str(kwargs.get("target_id") or "")[:64]

    ip = None
    if request and hasattr(request, "META"):
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            ip = xff.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR")

    ActivityLog.objects.create(
        user=user,
        action_type=at,
        description=desc,
        page_path=page_path,
        file_name=file_name,
        target_model=target_model,
        target_id=target_id,
        ip_address=ip,
    )
