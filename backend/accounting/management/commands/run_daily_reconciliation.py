"""
تشغيل تقرير المطابقة اليومي.
يُقارن: إجمالي مبيعات المنتجات، إجمالي المبيعات اليومية، إقفالات الورديات.
عند أي فرق > 0.01 ر.س يُرسل تنبيه لسيف.

الاستخدام:
  python manage.py run_daily_reconciliation                    # اليوم
  python manage.py run_daily_reconciliation --date 2026-02-19
  python manage.py run_daily_reconciliation --brand 8oz --date 2026-02-19
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand

from accounting.reconciliation_report import run_daily_reconciliation_check


class Command(BaseCommand):
    help = "تشغيل تقرير المطابقة اليومي ومقارنة مصادر المبيعات وإرسال تنبيه للمالك عند الفجوات"

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            default=None,
            help="التاريخ (YYYY-MM-DD). إن لم يُحدد يُستخدم اليوم.",
        )
        parser.add_argument(
            "--brand",
            type=str,
            default=None,
            help="فلترة بالعلامة التجارية (slug)",
        )
        parser.add_argument(
            "--branch",
            type=int,
            action="append",
            dest="branch_ids",
            default=None,
            help="فلترة بمعرف فرع (يمكن تكراره)",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=1,
            help="عدد الأيام للمراجعة (من تاريخ البداية). افتراضي: 1",
        )

    def handle(self, *args, **options):
        date_str = options.get("date")
        brand_slug = options.get("brand")
        branch_ids = options.get("branch_ids")
        days = options.get("days")

        if date_str:
            try:
                start = date.fromisoformat(date_str)
            except ValueError:
                self.stdout.write(self.style.ERROR(f"Invalid date: {date_str}"))
                return
        else:
            start = date.today()

        total_mismatches = 0
        for i in range(days):
            d = start + timedelta(days=i)
            mismatches = run_daily_reconciliation_check(
                target_date=d,
                brand_slug=brand_slug,
                branch_ids=branch_ids,
            )
            for m in mismatches:
                total_mismatches += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"{m['date']} {m['brand_name']} – {m['branch_name']}: "
                        f"منتج={m['product_sales_total']:.2f}، يومي={m['daily_sales_total']:.2f}، "
                        f"إقفال={m['shift_closing_total']:.2f} | {'؛ '.join(m['gaps'])}"
                    )
                )
        if total_mismatches:
            self.stdout.write(
                self.style.WARNING(f"تم إرسال {total_mismatches} تنبيه(ات) للمالك (سيف).")
            )
            from core.heartbeat_services import record_task_heartbeat
            record_task_heartbeat("daily_reconciliation", "warning", f"{total_mismatches} فجوات")
        else:
            self.stdout.write(self.style.SUCCESS("لا توجد فجوات في المطابقة."))
            from core.heartbeat_services import record_task_heartbeat
            record_task_heartbeat("daily_reconciliation", "ok", "لا فجوات")
