"""Re-index Daily Sales Report to populate عدد الطلبات and متوسط الطلب.
Re-parses the most recent Daily Sales upload. Use after column mapping fixes.
Usage: python manage.py reindex_daily_sales [--confirm]"""
from django.core.management.base import BaseCommand

from imports.models import ExcelReportType, ExcelUpload
from imports.parser import parse_daily_sales, parse_excel_upload


class Command(BaseCommand):
    help = "Re-parse latest Daily Sales upload to fix order_count & average_order (عدد الطلبات، متوسط الطلب)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Skip confirmation prompt",
        )
        parser.add_argument(
            "--upload-id",
            type=int,
            default=None,
            help="Re-index a specific upload ID (e.g. Jan 2026 file)",
        )

    def handle(self, *args, **options):
        upload_id = options.get("upload_id")
        if upload_id:
            upload = ExcelUpload.objects.filter(
                id=upload_id,
                report_type=ExcelReportType.DAILY_SALES,
            ).first()
            if not upload:
                self.stdout.write(self.style.ERROR(f"Daily Sales upload {upload_id} not found."))
                return
        else:
            upload = (
                ExcelUpload.objects.filter(report_type=ExcelReportType.DAILY_SALES)
                .order_by("-created_at")
                .first()
            )
        if not upload or not upload.file:
            self.stdout.write(self.style.WARNING("No Daily Sales upload found. Upload a file first."))
            return

        self.stdout.write(f"Re-indexing: {upload.file.name}")
        self.stdout.write(f"  Report dates: {upload.report_date_from} to {upload.report_date_to}")

        if not options.get("confirm"):
            reply = input("Re-parse this file? [y/N]: ").strip().lower()
            if reply not in ("y", "yes"):
                self.stdout.write("Aborted.")
                return

        try:
            meta = parse_excel_upload(upload, report_type=ExcelReportType.DAILY_SALES)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Done. Dates: {meta.date_from} to {meta.date_to}. "
                    "Refresh dashboard to see عدد الطلبات and متوسط عدد الطلبات."
                )
            )
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Re-index failed: {e}"))
            raise
