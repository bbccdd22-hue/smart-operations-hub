"""
Celery configuration for Smart Operations Hub.
Usage:
  celery -A config worker -l info
  celery -A config beat -l info
  celery -A config worker --beat -l info  # worker + beat together
"""
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("smartops")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# Beat schedule
app.conf.beat_schedule = {
    "daily-backup": {
        "task": "core.tasks.daily_database_backup",
        "schedule": crontab(hour=2, minute=0),
    },
    "run-daily-reconciliation": {
        "task": "core.tasks.run_daily_reconciliation_task",
        "schedule": crontab(hour=3, minute=0),
    },
    "monthly-reports": {
        "task": "accounting.tasks.generate_monthly_financial_reports",
        "schedule": crontab(day_of_month=1, hour=3, minute=0),
    },
    "reorder-alerts": {
        "task": "inventory.tasks.check_reorder_levels",
        "schedule": crontab(hour=8, minute=0),
    },
}


@app.task(bind=True)
def debug_task(self):
    """Test task: celery -A config inspect ping"""
    print(f"Request: {self.request!r}")
