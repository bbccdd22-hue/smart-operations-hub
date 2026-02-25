"""
تنظيف تلقائي لملفات الرفع الأقدم من 30 يوماً.
يمنع امتلاء القرص (Disk Bloat).

الاستخدام:
  python manage.py cleanup_old_uploads
  python manage.py cleanup_old_uploads --days 60
  python manage.py cleanup_old_uploads --dry-run  # معاينة فقط دون حذف
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from imports.models import ExcelUpload, ExcelUploadStatus


class Command(BaseCommand):
    help = "حذف ملفات رفع Excel/CSV الأقدم من 30 يوماً (مع الملف الفعلي من التخزين)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="حذف الرفوعات الأقدم من X يوم (افتراضي: 30)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="عرض ما سيُحذف دون تنفيذ",
        )

    def handle(self, *args, **options):
        days = options["days"]
        dry_run = options["dry_run"]
        cutoff = timezone.now() - timedelta(days=days)
        qs = ExcelUpload.objects.filter(created_at__lt=cutoff).order_by("created_at")
        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS(f"لا توجد رفوعات أقدم من {days} يوماً."))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING(f"[معاينة] سيُحذف {total} رفع:"))
            for u in qs[:20]:
                self.stdout.write(f"  - id={u.id} {u.report_type} {u.file.name} ({u.created_at.date()})")
            if total > 20:
                self.stdout.write(f"  ... و{total - 20} آخر")
            return

        deleted_count = 0
        for upload in qs:
            try:
                if upload.file:
                    upload.file.delete(save=False)
                upload.delete()
                deleted_count += 1
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"فشل حذف id={upload.id}: {e}")
                )
        self.stdout.write(
            self.style.SUCCESS(f"تم حذف {deleted_count} رفع وملفاتها من التخزين.")
        )
