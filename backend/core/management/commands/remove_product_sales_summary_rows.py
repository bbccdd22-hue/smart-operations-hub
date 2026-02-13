"""Remove ProductSale rows that are summary/total rows (Total, المجموع, etc.).
[Ref: 161033] Forces correct total 981,459.30 by deleting bad rows from DB.
Usage: python manage.py remove_product_sales_summary_rows 8oz [--date-from 2026-01-01] [--date-to 2026-01-31] [--dry-run]
After running, refresh dashboard - no re-upload needed."""
from datetime import datetime

from django.db.models import Q, Sum
from django.core.management.base import BaseCommand

from imports.models import ProductSale
from org.models import Brand

# Same patterns as analytics/views.py - rows to exclude from sum (incl. branch/brand)
SUMMARY_Q = (
    Q(product_name__icontains="total")
    | Q(product_name__icontains="المجموع")
    | Q(product_name__icontains="مجموع")
    | Q(product_name__icontains="subtotal")
    | Q(product_name__icontains="الإجمالي")
    | Q(product_name__icontains="إجمالي")
    | Q(product_name__icontains="اجمالي")
    | Q(product_sku__icontains="total")
    | Q(product_sku__icontains="المجموع")
    | Q(branch__name__icontains="total")
    | Q(branch__name__icontains="المجموع")
    | Q(branch__brand__name__icontains="total")
    | Q(branch__brand__name__icontains="المجموع")
)


class Command(BaseCommand):
    help = "Remove ProductSale summary rows (Total, المجموع) so dashboard shows 981,459.30"

    def add_arguments(self, parser):
        parser.add_argument("brand_slug", type=str, nargs="?", default="8oz", help="Brand slug")
        parser.add_argument("--date-from", type=str, help="Start date YYYY-MM-DD (optional)")
        parser.add_argument("--date-to", type=str, help="End date YYYY-MM-DD (optional)")
        parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted, do not delete")

    def handle(self, *args, **options):
        slug = (options["brand_slug"] or "8oz").strip().lower()
        brand = Brand.objects.filter(slug=slug).first()
        if not brand:
            self.stderr.write(self.style.ERROR(f"Brand '{slug}' not found."))
            return

        qs = ProductSale.objects.filter(branch__brand=brand)
        if options.get("date_from"):
            try:
                date_from = datetime.strptime(options["date_from"], "%Y-%m-%d").date()
                qs = qs.filter(date__gte=date_from)
            except ValueError:
                self.stderr.write(self.style.ERROR("Invalid --date-from"))
                return
        if options.get("date_to"):
            try:
                date_to = datetime.strptime(options["date_to"], "%Y-%m-%d").date()
                qs = qs.filter(date__lte=date_to)
            except ValueError:
                self.stderr.write(self.style.ERROR("Invalid --date-to"))
                return

        to_delete = qs.filter(SUMMARY_Q)
        count = to_delete.count()
        sum_before = to_delete.aggregate(s=Sum("total_sales"))["s"] or 0
        detail_sum = qs.exclude(SUMMARY_Q).aggregate(s=Sum("total_sales"))["s"] or 0

        if options.get("dry_run"):
            self.stdout.write(f"DRY RUN - would delete {count} summary rows (total_sales sum: {float(sum_before):,.2f} SAR)")
            for r in to_delete[:5]:
                self.stdout.write(f"  - {r.product_name!r} | {r.total_sales}")
            if count > 5:
                self.stdout.write(f"  ... and {count - 5} more")
            self.stdout.write(self.style.SUCCESS(f"Detail rows (kept) sum: {float(detail_sum):,.2f} SAR"))
            return

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No summary rows found. Data already clean."))
            self.stdout.write(f"Current detail sum: {float(detail_sum):,.2f} SAR")
            return

        to_delete.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {count} summary rows (removed {float(sum_before):,.2f} SAR). "
                f"Dashboard will now show ~{float(detail_sum):,.2f} SAR. Refresh the page."
            )
        )
