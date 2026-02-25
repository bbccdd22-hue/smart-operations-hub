"""
التحقق من التحويلات المعلقة ومراقبة النبض.
يُنصح بتشغيله عبر cron كل ساعة مثلاً.

الاستخدام:
  python manage.py run_stale_transfer_check
"""
from django.core.management.base import BaseCommand

from core.heartbeat_services import record_task_heartbeat
from inventory.transfer_services import notify_stale_transfers_if_any


class Command(BaseCommand):
    help = "التحقق من التحويلات العالقة وإرسال تنبيهات وتسجيل النبض"

    def handle(self, *args, **options):
        try:
            created = notify_stale_transfers_if_any()
            if created:
                record_task_heartbeat("stale_transfer_check", "ok", f"أُرسل {created} تنبيه")
            else:
                record_task_heartbeat("stale_transfer_check", "ok", "لا تحويلات عالقة")
        except Exception as e:
            record_task_heartbeat("stale_transfer_check", "error", str(e)[:500])
            raise
