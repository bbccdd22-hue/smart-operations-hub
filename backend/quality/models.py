"""
Quality & Auditing - قوائم الفحص، زيارات الفروع، IoT.
"""
from django.conf import settings
from django.db import models

from config.constants import SYSTEM_CODE_AUDIT_CHECKLIST, SYSTEM_CODE_IOT_ALERT
from org.models import Branch, Brand, TimestampedModel


class AuditChecklist(models.Model):
    """قائمة فحص - نموذج للزيارات."""
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="audit_checklists")
    name = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class AuditChecklistItem(models.Model):
    """بند فحص (نظافة، التزام بالزي، إلخ)."""
    checklist = models.ForeignKey(AuditChecklist, on_delete=models.CASCADE, related_name="items")
    label = models.CharField(max_length=255)
    label_ar = models.CharField(max_length=255, blank=True, default="")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]


class BranchVisit(models.Model):
    """زيارة فرع - مدير المنطقة يسجل النتائج ويرفع صوراً."""
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="audit_visits")
    checklist = models.ForeignKey(AuditChecklist, on_delete=models.PROTECT, related_name="visits")
    visited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="branch_visits",
    )
    visit_date = models.DateField(db_index=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-visit_date"]


class BranchVisitItem(models.Model):
    """نتيجة بند الفحص في الزيارة."""
    visit = models.ForeignKey(BranchVisit, on_delete=models.CASCADE, related_name="items")
    checklist_item = models.ForeignKey(AuditChecklistItem, on_delete=models.PROTECT, related_name="visit_results")
    passed = models.BooleanField()
    comment = models.CharField(max_length=500, blank=True, default="")
    photo = models.ImageField(upload_to="quality/visits/", null=True, blank=True)


class IoTDevice(models.Model):
    """جهاز IoT - حساس درجة حرارة."""
    DEVICE_TYPE_TEMP = "temperature"

    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="iot_devices")
    device_id = models.CharField(max_length=64, unique=True, db_index=True)
    device_type = models.CharField(max_length=24, default=DEVICE_TYPE_TEMP)
    name = models.CharField(max_length=120, blank=True, default="")
    location = models.CharField(max_length=255, blank=True, default="")
    min_temp = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    max_temp = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["branch", "device_id"]

    def __str__(self):
        return f"{self.device_id} ({self.branch.name})"


class IoTReading(models.Model):
    """قراءة من حساس."""
    device = models.ForeignKey(IoTDevice, on_delete=models.CASCADE, related_name="readings")
    value = models.DecimalField(max_digits=8, decimal_places=2)
    unit = models.CharField(max_length=16, default="celsius")
    read_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-read_at"]


class BranchQualityScore(models.Model):
    """درجة جودة شهرية للفرع - تؤثر على حوافز الموظفين."""
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="quality_scores")
    period_month = models.PositiveSmallIntegerField()
    period_year = models.PositiveSmallIntegerField()
    score = models.DecimalField(max_digits=5, decimal_places=2, help_text="0-100")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-period_year", "-period_month"]
        unique_together = [["branch", "period_month", "period_year"]]

    def __str__(self):
        return f"{self.branch.name} {self.period_year}-{self.period_month:02d}: {self.score}"


class IoTAlert(models.Model):
    """تنبيه استغاثة - عند تعطل ثلاجة أو تجاوز حد."""
    ALERT_TYPE_CRITICAL = "critical"
    ALERT_TYPE_WARNING = "warning"

    device = models.ForeignKey(IoTDevice, on_delete=models.CASCADE, related_name="alerts")
    alert_type = models.CharField(max_length=16, default=ALERT_TYPE_CRITICAL, db_index=True)
    message = models.CharField(max_length=500)
    value_recorded = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="iot_acknowledged",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
