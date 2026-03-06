"""
Celery tasks for Accounting — تقارير شهرية، مطابقات.
"""
from celery import shared_task
from django.utils import timezone

from core.heartbeat_services import record_task_heartbeat


@shared_task(bind=True, name="accounting.tasks.generate_monthly_financial_reports")
def generate_monthly_financial_reports(self):
    """
    تقارير مالية شهرية — يُشغّل في أول كل شهر (3 صباحاً).
    Phase 1: placeholder؛ Phase 2: PDF + email للعملاء.
    """
    record_task_heartbeat("monthly-reports", "running", "بدء التقارير الشهرية")
    try:
        # Placeholder — Phase 2: loop tenants, generate PDF, send email
        record_task_heartbeat("monthly-reports", "ok", "اكتمل (placeholder)")
        return {"status": "ok", "task": "generate_monthly_financial_reports"}
    except Exception as e:
        record_task_heartbeat("monthly-reports", "error", str(e)[:500])
        return {"status": "error", "task": "generate_monthly_financial_reports", "error": str(e)}
