"""
Celery tasks for Smart Operations Hub.
Heavy reports, backups, reconciliation — run in background.
"""
from celery import shared_task
from django.core.management import call_command
from django.utils import timezone

from core.heartbeat_services import record_task_heartbeat


@shared_task(bind=True, name="core.tasks.daily_backup_task")
def daily_backup_task(self):
    """
    Daily backup (2 AM) — SQLite DB + media archives.
    With PostgreSQL (Render): backs up media only; DB has managed backups.
    """
    record_task_heartbeat("daily-backup", "running", "بدء النسخ الاحتياطي")
    try:
        call_command("backup", "--retention", "30")
        record_task_heartbeat("daily-backup", "ok", "تم بنجاح")
        return {"status": "ok", "task": "daily_backup"}
    except Exception as e:
        record_task_heartbeat("daily-backup", "error", str(e)[:500])
        return {"status": "error", "task": "daily_backup", "error": str(e)}


@shared_task(bind=True, name="core.tasks.run_daily_reconciliation_task")
def run_daily_reconciliation_task(self):
    """
    Daily reconciliation (3 AM) — compare product sales, daily sales, shift closings.
    Sends alerts to owner when mismatches found.
    """
    record_task_heartbeat("daily-reconciliation", "running", "بدء المطابقة")
    try:
        call_command("run_daily_reconciliation")
        record_task_heartbeat("daily-reconciliation", "ok", "لا فجوات")
        return {"status": "ok", "task": "daily_reconciliation"}
    except Exception as e:
        record_task_heartbeat("daily-reconciliation", "error", str(e)[:500])
        return {"status": "error", "task": "daily_reconciliation", "error": str(e)}


@shared_task(bind=True, name="core.tasks.daily_database_backup")
def daily_database_backup(self):
    """نسخ احتياطي يومي لقاعدة البيانات — نفس منطق daily_backup_task."""
    record_task_heartbeat("daily-backup", "running", "بدء النسخ الاحتياطي")
    try:
        call_command("backup", "--retention", "30")
        record_task_heartbeat("daily-backup", "ok", "تم بنجاح")
        return {"status": "ok", "task": "daily_database_backup"}
    except Exception as e:
        record_task_heartbeat("daily-backup", "error", str(e)[:500])
        return {"status": "error", "task": "daily_database_backup", "error": str(e)}


@shared_task(bind=True)
def generate_monthly_financial_report(self, tenant_slug: str, year: int, month: int):
    """
    Heavy report → PDF → email (placeholder for Phase 2).
    Phase 1: just logs; Phase 2: implement full report generation.
    """
    return {
        "status": "placeholder",
        "tenant_slug": tenant_slug,
        "year": year,
        "month": month,
        "message": "Full report generation in Phase 2",
    }
