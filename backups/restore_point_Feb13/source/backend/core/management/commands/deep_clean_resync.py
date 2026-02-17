"""Deep Clean & Re-Sync: Purge Jan 2026 data and re-parse Daily Sales + Payments.
Usage: python manage.py deep_clean_resync [--confirm]"""
import os
from datetime import date
from pathlib import Path

from django.core.management.base import BaseCommand
from django.core.files import File
from django.db import transaction
from django.conf import settings

from accounting.models import FoodicsPaymentRecord
from imports.models import DailySale, ExcelReportType, ExcelUpload
from imports.parser import parse_excel_upload


class Command(BaseCommand):
    help = "Purge Jan 2026 data and re-parse Daily Sales + Payments with new logic"

    def add_arguments(self, parser):
        parser.add_argument("--confirm", action="store_true", help="Skip confirmation")

    def handle(self, *args, **options):
        if not options.get("confirm"):
            reply = input("Purge Jan 2026 and re-parse? [y/N]: ").strip().lower()
            if reply not in ("y", "yes"):
                self.stdout.write("Aborted.")
                return

        jan_start = date(2026, 1, 1)
        jan_end = date(2026, 1, 31)

        with transaction.atomic():
            # 1. Purge DailySale for Jan 2026
            ds_deleted, _ = DailySale.objects.filter(
                date__gte=jan_start, date__lte=jan_end
            ).delete()
            self.stdout.write(self.style.WARNING(f"Deleted {ds_deleted} DailySale rows for Jan 2026"))

            # 2. Purge FoodicsPaymentRecord for Jan 2026
            fp_deleted, _ = FoodicsPaymentRecord.objects.filter(
                report_date__gte=jan_start, report_date__lte=jan_end
            ).delete()
            self.stdout.write(self.style.WARNING(f"Deleted {fp_deleted} FoodicsPaymentRecord rows for Jan 2026"))

        # 3. Re-parse: find or create Daily Sales upload for Jan 2026
        media_root = Path(settings.MEDIA_ROOT)
        jan_file = media_root / "excel_uploads" / "8OZ_JAN_2026.xlsx"
        daily_parsed = False

        daily_uploads = list(
            ExcelUpload.objects.filter(report_type=ExcelReportType.DAILY_SALES)
            .order_by("-created_at")[:10]
        )
        for upload in daily_uploads:
            try:
                if upload.file and os.path.exists(upload.file.path):
                    meta = parse_excel_upload(upload, report_type=ExcelReportType.DAILY_SALES)
                    if meta.date_from and meta.date_to and meta.date_from <= jan_end and meta.date_to >= jan_start:
                        daily_parsed = True
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"Re-parsed Daily Sales: {upload.file.name} ({meta.date_from} to {meta.date_to})"
                            )
                        )
                        break
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Daily Sales parse failed ({getattr(upload.file, 'name', '?')}): {e}"))

        if not daily_parsed and jan_file.exists():
            try:
                with open(jan_file, "rb") as f:
                    upload = ExcelUpload(
                        report_type=ExcelReportType.DAILY_SALES,
                        file=File(f, name="excel_uploads/8OZ_JAN_2026.xlsx"),
                    )
                    upload.save()
                meta = parse_excel_upload(upload, report_type=ExcelReportType.DAILY_SALES)
                daily_parsed = True
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Parsed new Daily Sales: 8OZ_JAN_2026.xlsx ({meta.date_from} to {meta.date_to})"
                    )
                )
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Parse 8OZ_JAN_2026.xlsx failed: {e}"))

        # 4. Re-parse Payments
        for upload in ExcelUpload.objects.filter(report_type=ExcelReportType.PAYMENTS_REPORT).order_by("-created_at")[:5]:
            try:
                if upload.file and os.path.exists(upload.file.path):
                    meta = parse_excel_upload(upload, report_type=ExcelReportType.PAYMENTS_REPORT)
                    if meta.date_from and meta.date_to and meta.date_from <= jan_end and meta.date_to >= jan_start:
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"Re-parsed Payments: {upload.file.name} ({meta.date_from} to {meta.date_to})"
                            )
                        )
                        break
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Payments parse failed: {e}"))

        if not daily_parsed:
            self.stdout.write(
                self.style.WARNING(
                    "No Jan 2026 Daily Sales file found on disk. "
                    "Copy 8OZ_JAN_2026.xlsx to media/excel_uploads/ and create an upload, or re-upload."
                )
            )

        self.stdout.write(self.style.SUCCESS("Deep clean & re-sync complete. Refresh the dashboard."))
