"""
تشغيل محرك التنبيهات – يُستدعى عبر cron كل 5–10 دقائق.
Usage: python manage.py run_notification_rules [--dry-run]
"""
from django.core.management.base import BaseCommand

from notifications.engine import run_notification_rules


class Command(BaseCommand):
    help = "Run notification rules (shift not opened, etc.) and send via Push/Email/WhatsApp"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Evaluate only, do not send")

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        stats = run_notification_rules(dry_run=dry_run)
        self.stdout.write(
            self.style.SUCCESS(
                f"Evaluated: {stats['evaluated']}, Alerts: {stats['alerts']}, Sent: {stats['sent']}"
            )
        )
        if stats["errors"]:
            for e in stats["errors"]:
                self.stderr.write(self.style.ERROR(e))
