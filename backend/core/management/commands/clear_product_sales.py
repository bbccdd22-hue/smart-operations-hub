"""Clear Product Sales for a brand/date range so you can re-upload with corrected parser.
Usage: python manage.py clear_product_sales 8oz --date-from 2026-01-01 --date-to 2026-01-31
[Ref: 180508] After clearing, re-upload the Excel to get correct 981,459.30 from صافي المبيعات."""
from datetime import datetime

from django.core.management.base import BaseCommand

from imports.models import ProductSale
from org.models import Brand


class Command(BaseCommand):
    help = "Clear Product Sales for a brand and date range (for re-upload with fixed parser)"

    def add_arguments(self, parser):
        parser.add_argument("brand_slug", type=str, help="Brand slug, e.g. 8oz")
        parser.add_argument("--date-from", type=str, default="2026-01-01", help="Start date YYYY-MM-DD")
        parser.add_argument("--date-to", type=str, default="2026-01-31", help="End date YYYY-MM-DD")

    def handle(self, *args, **options):
        slug = (options["brand_slug"] or "").strip().lower()
        if not slug:
            self.stderr.write(self.style.ERROR("Brand slug required."))
            return
        try:
            date_from = datetime.strptime(options["date_from"], "%Y-%m-%d").date()
            date_to = datetime.strptime(options["date_to"], "%Y-%m-%d").date()
        except ValueError as e:
            self.stderr.write(self.style.ERROR(f"Invalid date: {e}"))
            return

        brand = Brand.objects.filter(slug=slug).first()
        if not brand:
            self.stderr.write(self.style.ERROR(f"Brand '{slug}' not found."))
            return

        qs = ProductSale.objects.filter(
            branch__brand=brand, date__gte=date_from, date__lte=date_to
        )
        count = qs.count()
        qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {count} ProductSale rows for {brand.name} ({date_from} to {date_to}). "
                "Re-upload the Excel to get correct صافي المبيعات total."
            )
        )
