"""سجل الرقابة – تسجيل حركات المستخدمين (فقط سيف يرى الصفحة)."""
from org.models import ActivityLog


def log_activity(
    user,
    action_type: str,
    description: str = "",
    page_path: str = "",
    file_name: str = "",
    target_model: str = "",
    target_id: str = "",
    request=None,
):
    """تسجيل حركة في سجل الرقابة."""
    if not user or not user.is_authenticated:
        return
    ip = None
    if request and hasattr(request, "META"):
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            ip = xff.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR")
    try:
        ActivityLog.objects.create(
            user=user,
            action_type=action_type,
            description=description[:500],
            page_path=page_path[:256],
            file_name=file_name[:255],
            target_model=target_model[:64],
            target_id=str(target_id)[:64],
            ip_address=ip,
        )
    except Exception:
        pass
