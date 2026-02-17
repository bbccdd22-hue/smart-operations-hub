"""
Accounting & Reconciliation module.
- Source A: DailySale (Excel archive) — System Revenue
- Source B: ShiftClosing — Actual Cash/Card from staff
- Source C: FoodicsSettlement — Uploaded Receipts/Settlements
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from config.constants import (
    SYSTEM_CODE_CHART_ACCOUNT,
    SYSTEM_CODE_DAILY_ACCOUNTING,
    SYSTEM_CODE_FOODICS_PAYMENT,
    SYSTEM_CODE_FOODICS_SETTLEMENT,
)
from org.models import Branch, TimestampedModel


class FoodicsSettlement(TimestampedModel):
    """
    Source C: Uploaded Receipts/Settlements reports from Foodics.
    """
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_FOODICS_SETTLEMENT, db_index=True,
        help_text="ERP hierarchy code",
    )
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="settlements")
    report_date = models.DateField(db_index=True)
    file = models.FileField(upload_to="accounting/settlements/")
    total_deposited = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00"),
        help_text="Amount reportedly deposited to bank"
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-report_date"]
        unique_together = [["branch", "report_date"]]


class FoodicsPaymentCategory(models.TextChoices):
    """Payment method categories from Foodics. REFERENCE ONLY - does not override employee entries."""
    CASH = "cash", "Cash / كاش"
    SPAN = "span", "Span / سبان"
    DELIVERY_APPS = "delivery_apps", "Delivery Apps / تطبيقات التوصيل"


class FoodicsPaymentRecord(TimestampedModel):
    """
    [Ref: image_86561c] Foodics Payments Report - REFERENCE for reconciliation only.
    Does NOT override Actual Cash from Shift Closing. Used to show variances.
    Headers: يوم (date), الفرع (branch), طريقة الدفع (payment method), المبلغ الصافي (net amount).
    """
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_FOODICS_PAYMENT, db_index=True,
        help_text="ERP hierarchy code",
    )
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="foodics_payment_records")
    report_date = models.DateField(db_index=True)
    category = models.CharField(max_length=32, choices=FoodicsPaymentCategory.choices, db_index=True)
    raw_method = models.CharField(max_length=128, blank=True, default="", help_text="Original طريقة الدفع value")
    net_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["-report_date", "branch"]
        indexes = [
            models.Index(fields=["branch", "report_date", "category"]),
        ]


class DailyAccountingStatus(TimestampedModel):
    """
    Owner finalizes the day's accounts after reviewing variances.
    """
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_DAILY_ACCOUNTING, db_index=True,
        help_text="ERP hierarchy code",
    )
    report_date = models.DateField(unique=True, db_index=True)
    finalized_at = models.DateTimeField(auto_now_add=True)
    finalized_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="finalized_daily_accounts",
    )

    class Meta:
        verbose_name_plural = "Daily Accounting Status"


class ChartAccount(TimestampedModel):
    """
    نظام سيف المالي - محرك الشجرة المحاسبية الرسمية.
    دليل الحسابات من المستوى 1 إلى 5.
    """
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_CHART_ACCOUNT, db_index=True,
    )
    code = models.CharField(max_length=32, unique=True, db_index=True, help_text="رقم الحساب مثل 01, 01101")
    name_ar = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    level = models.PositiveSmallIntegerField(default=1, help_text="المستوى 1-5")
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children",
    )
    account_type = models.CharField(
        max_length=24,
        choices=[
            ("رئيسي", "رئيسي"),
            ("تحليلي", "تحليلي"),
        ],
        default="تحليلي",
    )
    statement = models.CharField(
        max_length=64,
        choices=[
            ("المركز المالي", "المركز المالي"),
            ("قائمة الدخل", "قائمة الدخل"),
        ],
        default="المركز المالي",
    )
    is_active = models.BooleanField(default=True)
    balance = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="رصيد الحساب – يُحدَّث من رفع الإكسل أو القيود",
    )

    class Meta:
        ordering = ["code"]
        verbose_name = "Chart Account"
        verbose_name_plural = "Chart of Accounts"

    def __str__(self):
        return f"{self.code} - {self.name_ar}"
