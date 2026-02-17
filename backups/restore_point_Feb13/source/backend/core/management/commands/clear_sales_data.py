"""Clear all Excel-imported sales data to prepare for fresh simplified file upload.
Deletes: ProductSale, DailySale, HourlySale, ExcelUpload (cascades).
Keeps: Brands, Branches, Users, ShiftClosings.
Usage: python manage.py clear_sales_data [--brand 8oz] [--confirm]"""
from django.core.management.base import BaseCommand
from imports.models import ExcelUpload, ProductSale, DailySale, HourlySale
from org.models import Brand


class Command(BaseCommand):
    help = "Clear all Excel-imported sales data for fresh upload (Net Sales simplified file)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--brand",
            type=str,
            default=None,
            help="Only clear for this brand slug (e.g. 8oz). Omit to clear all.",
        )
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Skip confirmation prompt",
        )

    def handle(self, *args, **options):
        brand_slug = options.get("brand")
        confirm = options.get("confirm")

        qs = ExcelUpload.objects.all().select_related("brand")
        if brand_slug:
            brand = Brand.objects.filter(slug=brand_slug.strip().lower()).first()
            if not brand:
                self.stderr.write(self.style.ERROR(f"Brand '{brand_slug}' not found."))
                return
            qs = qs.filter(brand=brand)
            scope = f"for {brand.name}"
        else:
            scope = "ALL"

        counts = {
            "product": ProductSale.objects.filter(upload__in=qs).count(),
            "daily": DailySale.objects.filter(upload__in=qs).count(),
            "hourly": HourlySale.objects.filter(upload__in=qs).count(),
            "uploads": qs.count(),
        }

        total = counts["product"] + counts["daily"] + counts["hourly"]
        if total == 0 and counts["uploads"] == 0:
            self.stdout.write(self.style.WARNING(f"No sales data {scope} to clear."))
            return

        self.stdout.write(
            f"Will delete {scope}:\n"
            f"  - {counts['uploads']} Excel upload(s)\n"
            f"  - {counts['product']} ProductSale rows\n"
            f"  - {counts['daily']} DailySale rows\n"
            f"  - {counts['hourly']} HourlySale rows\n"
        )
        if not confirm:
            reply = input("Proceed? [y/N]: ").strip().lower()
            if reply != "y" and reply != "yes":
                self.stdout.write("Aborted.")
                return

        # Delete uploads; CASCADE removes ProductSale, DailySale, HourlySale
        qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Cleared {scope}. Ready for your simplified Excel (Net Sales / صافي المبيعات)."
            )
        )
