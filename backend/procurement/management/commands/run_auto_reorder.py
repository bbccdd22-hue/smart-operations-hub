"""Run auto-reorder. Usage: python manage.py run_auto_reorder [--brand BRAND_ID]"""
from django.core.management.base import BaseCommand

from procurement.auto_reorder_services import run_auto_reorder


class Command(BaseCommand):
    help = "فحص قواعد إعادة الطلب وإنشاء طلبات شراء مسودة"

    def add_arguments(self, parser):
        parser.add_argument("--brand", type=int, default=None, help="Brand ID to limit scope")

    def handle(self, *args, **options):
        result = run_auto_reorder(brand_id=options.get("brand"))
        self.stdout.write(f"Created {result['created']} purchase requests")
        for err in result.get("errors", []):
            self.stdout.write(self.style.ERROR(err))
