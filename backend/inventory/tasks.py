"""
Celery tasks for Inventory — تنبيهات إعادة الطلب.
"""
from celery import shared_task
from django.db.models import F

from core.heartbeat_services import record_task_heartbeat


@shared_task(bind=True, name="inventory.tasks.check_reorder_levels")
def check_reorder_levels(self):
    """
    فحص مستويات إعادة الطلب — يُشغّل يومياً (8 صباحاً).
    يُرسل تنبيهات للموردين أو المالك عند انخفاض المخزون.
    """
    record_task_heartbeat("reorder-alerts", "running", "بدء فحص المخزون")
    try:
        from inventory.models import BranchStock

        low_count = BranchStock.objects.filter(
            reorder_level__gt=0,
            on_hand__lte=F("reorder_level"),
        ).count()
        msg = f"{low_count} صنف تحت الحد الأدنى" if low_count else "لا تنبيهات"
        status = "warning" if low_count else "ok"
        record_task_heartbeat("reorder-alerts", status, msg)
        return {"status": "ok", "task": "check_reorder_levels", "low_stock_count": low_count}
    except Exception as e:
        record_task_heartbeat("reorder-alerts", "error", str(e)[:500])
        return {"status": "error", "task": "check_reorder_levels", "error": str(e)}
