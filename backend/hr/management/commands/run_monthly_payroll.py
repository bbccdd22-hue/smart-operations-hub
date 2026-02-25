"""
تشغيل رواتب نهاية الشهر: حساب + إصدار القيد المحاسبي.
استخدام: python manage.py run_monthly_payroll [--brand BRAND_ID] [--month MM] [--year YYYY]
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "حساب رواتب الشهر وإصدار قيد محاسبي"

    def add_arguments(self, parser):
        parser.add_argument("--brand", type=int, help="معرف العلامة (اختياري)")
        parser.add_argument("--month", type=int, help="الشهر 1-12 (افتراضي: الشهر الحالي)")
        parser.add_argument("--year", type=int, help="السنة (افتراضي: السنة الحالية)")

    def handle(self, *args, **options):
        from django.contrib.auth import get_user_model
        from hr.payroll_services import calculate_payroll_run, post_payroll_journal_entry

        now = timezone.now()
        month = options.get("month") or now.month
        year = options.get("year") or now.year
        brand_id = options.get("brand")

        if brand_id:
            brands = [brand_id]
        else:
            from org.models import Brand
            brands = list(Brand.objects.values_list("id", flat=True))

        user = get_user_model().objects.filter(is_superuser=True).first()

        for bid in brands:
            payroll = calculate_payroll_run(
                brand_id=bid,
                period_month=month,
                period_year=year,
                created_by=user,
            )
            if payroll and payroll.total_amount > 0:
                je = post_payroll_journal_entry(payroll, created_by=user)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Brand {bid}: Payroll {year}-{month:02d} = {payroll.total_amount}, JE={'OK' if je else 'SKIP'}"
                    )
                )
