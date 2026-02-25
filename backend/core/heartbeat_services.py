"""
تسجيل نبض المهام الخلفية – للتحقق من عمل المراقب الآلي.
"""
from django.utils import timezone

from org.models import SystemTaskHeartbeat


def record_task_heartbeat(
    task_name: str,
    status: str = "ok",
    message: str = "",
) -> None:
    """سجّل آخر تشغيل للمهمة (للمراقبة من واجهة سيف)."""
    try:
        obj, _ = SystemTaskHeartbeat.objects.get_or_create(
            task_name=task_name,
            defaults={"last_status": "unknown"},
        )
        obj.last_run_at = timezone.now()
        obj.last_status = status if status in ("ok", "error", "warning", "unknown") else "unknown"
        obj.last_message = (message or "")[:500]
        obj.save(update_fields=["last_run_at", "last_status", "last_message", "updated_at"])
    except Exception:  # noqa: BLE001
        pass


def get_all_heartbeats():
    """استعلام عن نبض جميع المهام – لواجهة Health Check."""
    return list(
        SystemTaskHeartbeat.objects.all().values(
            "task_name", "last_run_at", "last_status", "last_message", "updated_at"
        )
    )
