"""
Asset Management - إدارة الأصول والإهلاك التلقائي.
تتبع أصول الشركة (ماكينات، أجهزة، سيارات) مع إهلاك شهري وقيد محاسبي.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from config.constants import SYSTEM_CODE_ASSET, SYSTEM_CODE_ASSET_DEPRECIATION
from org.models import Branch, Brand, TimestampedModel


class AssetCategory(models.TextChoices):
    EQUIPMENT = "equipment", "معدات"
    VEHICLE = "vehicle", "سيارة"
    FURNITURE = "furniture", "أثاث"
    MACHINERY = "machinery", "آليات (ماكينات قهوة، إلخ)"
    OTHER = "other", "أخرى"


class Asset(TimestampedModel):
    """أصل - ماكينة قهوة، جهاز، سيارة، إلخ."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_ASSET, db_index=True,
    )
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="assets")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="assets")

    code = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200, blank=True, default="")
    category = models.CharField(max_length=24, choices=AssetCategory.choices, db_index=True)
    purchase_date = models.DateField(null=True, blank=True)
    purchase_cost = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    residual_value = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00"),
        help_text="القيمة المتبقية عند نهاية العمر الافتراضي",
    )
    useful_life_months = models.PositiveIntegerField(
        default=60,
        help_text="العمر الافتراضي بالأشهر (مثلاً 60 = 5 سنوات)",
    )
    depreciation_method = models.CharField(
        max_length=16,
        choices=[("straight_line", "الخط المستقيم")],
        default="straight_line",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def depreciable_value(self):
        return max(Decimal("0"), self.purchase_cost - self.residual_value)

    @property
    def monthly_depreciation(self):
        if self.useful_life_months <= 0:
            return Decimal("0")
        return self.depreciable_value / self.useful_life_months


class AssetDepreciation(TimestampedModel):
    """سجل إهلاك - قيد محاسبي شهري للإهلاك."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_ASSET_DEPRECIATION, db_index=True,
    )
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="depreciations")
    period_month = models.PositiveSmallIntegerField()
    period_year = models.PositiveSmallIntegerField()
    depreciation_amount = models.DecimalField(max_digits=14, decimal_places=2)
    journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="asset_depreciations",
        help_text="القيد المحاسبي للإهلاك",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="created_depreciations",
    )

    class Meta:
        ordering = ["-period_year", "-period_month"]
        unique_together = [["asset", "period_month", "period_year"]]
        verbose_name = "Asset Depreciation"
        verbose_name_plural = "Asset Depreciations"

    def __str__(self):
        return f"{self.asset.code} - {self.period_year}-{self.period_month:02d} = {self.depreciation_amount}"


class MaintenanceSchedule(models.Model):
    """جدولة الصيانة الوقائية - كل X وحدة أو كل X يوم."""
    TRIGGER_BY_USAGE = "by_usage"
    TRIGGER_BY_DAYS = "by_days"

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="maintenance_schedules")
    trigger_type = models.CharField(
        max_length=16, default=TRIGGER_BY_DAYS, db_index=True,
        help_text="by_usage: كل 1000 كوب | by_days: كل 30 يوم",
    )
    usage_interval = models.PositiveIntegerField(
        null=True, blank=True, help_text="مثلاً 1000 كوب",
    )
    days_interval = models.PositiveIntegerField(
        null=True, blank=True, help_text="مثلاً 30 يوم",
    )
    description = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["asset", "id"]

    def __str__(self):
        return f"{self.asset.code} - {self.description or self.trigger_type}"


class MaintenanceTask(models.Model):
    """مهمة صيانة منجزة أو مجدولة."""
    STATUS_PENDING = "pending"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_DONE = "done"

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="maintenance_tasks")
    schedule = models.ForeignKey(
        MaintenanceSchedule, on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks",
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="maintenance_tasks",
    )
    status = models.CharField(max_length=16, default=STATUS_PENDING, db_index=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_at", "-created_at"]

    def __str__(self):
        return f"{self.asset.code} - {self.status} @ {self.scheduled_at}"
