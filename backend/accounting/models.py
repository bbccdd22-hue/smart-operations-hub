"""
Accounting & Reconciliation module.
- Source A: DailySale (Excel archive) — System Revenue
- Source B: ShiftClosing — Actual Cash/Card from staff
- Source C: FoodicsSettlement — Uploaded Receipts/Settlements
"""
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q

from config.constants import (
    SYSTEM_CODE_CHART_ACCOUNT,
    SYSTEM_CODE_COST_AUDIT,
    SYSTEM_CODE_DAILY_ACCOUNTING,
    SYSTEM_CODE_FOODICS_PAYMENT,
    SYSTEM_CODE_FOODICS_SETTLEMENT,
    SYSTEM_CODE_JOURNAL_ENTRY,
    SYSTEM_CODE_JOURNAL_LINE,
    SYSTEM_CODE_MANUAL_ADJUSTMENT,
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


class CostUpload(TimestampedModel):
    """
    سجل رفع تكاليف – كل دفعة رفع تُخزَّن مع اسم الملف.
    آخر رفع = المصدر الحالي لأرصدة الحسابات.
    """
    system_code = models.CharField(
        max_length=16, default="AC1005", db_index=True,
    )
    source_file = models.CharField(max_length=255, help_text="اسم ملف الإكسل المصدر")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cost_uploads",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Cost Upload"
        verbose_name_plural = "Cost Uploads"


class CostAuditEntry(TimestampedModel):
    """
    سجل تدقيق التكاليف – كل عملية تسجيل تكلفة بتفاصيلها.
    يربط التكلفة بالمصدر (الملف) ويسمح بالاستبعاد من الحساب.
    """
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_COST_AUDIT, db_index=True,
    )
    upload = models.ForeignKey(
        CostUpload,
        on_delete=models.CASCADE,
        related_name="entries",
        null=True,
        blank=True,
        help_text="رفع الإكسل الذي جاء منه هذا السطر",
    )
    account_code = models.CharField(max_length=32, db_index=True)
    account_name = models.CharField(max_length=255, blank=True, default="")
    description = models.CharField(max_length=500, blank=True, default="", help_text="الوصف من ملف الإكسل")
    amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    source_file = models.CharField(max_length=255, blank=True, default="", help_text="اسم ملف الإكسل المصدر")
    is_excluded = models.BooleanField(
        default=False,
        help_text="استبعاد من الحساب (رقم وهمي – آيبان، هاتف، إلخ)",
    )

    class Meta:
        ordering = ["-amount", "-created_at"]
        verbose_name = "Cost Audit Entry"
        verbose_name_plural = "Cost Audit Entries"
        indexes = [models.Index(fields=["account_code", "is_excluded"])]


class ManualAdjustment(TimestampedModel):
    """
    إجراء تسوية محاسبية يدوية – SAIF فقط.
    سجل لا يُحذف، يوضح التاريخ، المبلغ قبل/بعد، ومن قام بها.
    """
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_MANUAL_ADJUSTMENT, db_index=True,
    )
    account = models.ForeignKey(
        ChartAccount,
        on_delete=models.PROTECT,
        related_name="manual_adjustments",
        db_index=True,
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    entry_type = models.CharField(
        max_length=8,
        choices=[("debit", "مدين"), ("credit", "دائن")],
        db_index=True,
    )
    reason = models.TextField(help_text="سبب التسوية")
    balance_before = models.DecimalField(max_digits=18, decimal_places=2)
    balance_after = models.DecimalField(max_digits=18, decimal_places=2)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="manual_adjustments",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Manual Adjustment"
        verbose_name_plural = "Manual Adjustments"


class JournalEntrySource(models.TextChoices):
    """مصدر القيد المحاسبي"""
    SHIFT_CLOSING = "shift_closing", "إقفال وردية"
    MANUAL = "manual", "يدوي"
    GOODS_RECEIPT = "goods_receipt", "استلام بضاعة"
    SUPPLIER_INVOICE = "supplier_invoice", "فاتورة مورد"
    PAYROLL = "payroll", "رواتب"
    DEPRECIATION = "depreciation", "إهلاك أصول"
    POS_SALE = "pos_sale", "بيع نقاط البيع"


class JournalEntry(TimestampedModel):
    """
    القيد المحاسبي – رأس القيد (Double-Entry Bookkeeping).
    يُنشأ تلقائياً عند إقفال الوردية أو يدوياً.
    """
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_JOURNAL_ENTRY, db_index=True,
    )
    entry_date = models.DateField(db_index=True)
    description = models.CharField(max_length=500)
    source_type = models.CharField(
        max_length=24, choices=JournalEntrySource.choices, db_index=True,
    )
    shift_closing = models.ForeignKey(
        "shifts.ShiftClosing",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="journal_entries",
        db_index=True,
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="journal_entries",
        db_index=True,
        help_text="الفرع – للتقارير الموحدة",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="created_journal_entries",
    )

    class Meta:
        ordering = ["-entry_date", "-created_at"]
        verbose_name = "Journal Entry"
        verbose_name_plural = "Journal Entries"
        constraints = [
            models.UniqueConstraint(
                fields=["shift_closing"],
                condition=Q(shift_closing__isnull=False),
                name="unique_journal_per_shift_closing",
            ),
        ]


class JournalEntryLine(TimestampedModel):
    """
    سطر القيد (Transaction) – مبدأ القيد المزدوج.
    كل قيد: مجموع المدين = مجموع الدائن.
    """
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_JOURNAL_LINE, db_index=True,
    )
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    account = models.ForeignKey(
        ChartAccount,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="journal_lines",
    )
    account_code = models.CharField(max_length=32, db_index=True, help_text="كود الحساب إذا لم يُربط بـ ChartAccount")
    account_name_ar = models.CharField(max_length=200, blank=True, default="")
    debit_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    credit_amount = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["id"]
        verbose_name = "Journal Entry Line"
        verbose_name_plural = "Journal Entry Lines"
