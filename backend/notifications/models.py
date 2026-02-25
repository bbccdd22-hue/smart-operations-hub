"""
Notification Engine – قواعد تنبيهات ذكية وقنوات متعددة.
NotificationRule: قاعدة مع نوع (shift_not_opened_10_min إلخ).
NotificationDelivery: سجل الإرسال.
"""
from django.conf import settings
from django.db import models


class NotificationRule(models.Model):
    """قاعدة تنبيه – تُقيّم دورياً عبر run_notification_rules."""
    RULE_TYPES = [
        ("shift_not_opened_within_minutes", "تنبيه: وردية لم تُفتح في موعدها (بعد X دقيقة)"),
        ("shift_not_closed_by_deadline", "تنبيه: وردية لم تُقفل في موعدها"),
        ("low_stock_alert", "تنبيه: مخزون منخفض"),
        ("variance_threshold", "تنبيه: فرق نقدي يتجاوز حداً معيناً"),
    ]
    CHANNEL_CHOICES = [
        ("push", "Push (نافذة/صفحة)"),
        ("email", "Email"),
        ("whatsapp", "WhatsApp"),
    ]
    RECIPIENT_TYPES = [
        ("owner", "المالك (SAIF)"),
        ("branch_supervisor", "مشرف الفرع"),
        ("brand_manager", "مدير العلامة"),
        ("custom_users", "مستخدمون محددون"),
    ]

    name = models.CharField(max_length=128, help_text="اسم وصفي للقاعدة")
    rule_type = models.CharField(max_length=64, choices=RULE_TYPES, db_index=True)
    params = models.JSONField(default=dict, blank=True)  # e.g. {"minutes": 10, "shift_type": "morning"}
    channels = models.JSONField(default=list)  # ["push", "email", "whatsapp"]
    recipient_type = models.CharField(max_length=32, choices=RECIPIENT_TYPES, default="owner")
    recipient_user_ids = models.JSONField(default=list, blank=True)  # for custom_users
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.rule_type})"


class NotificationDelivery(models.Model):
    """سجل إرسال تنبيه – لمنع التكرار وتتبع التسليم."""
    rule = models.ForeignKey(
        NotificationRule, on_delete=models.CASCADE, related_name="deliveries", null=True, blank=True
    )
    channel = models.CharField(max_length=32)  # push, email, whatsapp
    recipient_id = models.IntegerField(null=True, blank=True)  # user_id if applicable
    recipient_email = models.EmailField(blank=True, default="")
    recipient_phone = models.CharField(max_length=32, blank=True, default="")
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default="")
    reference = models.CharField(max_length=256, db_index=True, help_text="لتجنب إعادة الإرسال")
    sent_at = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=True)
    error_message = models.CharField(max_length=512, blank=True, default="")

    class Meta:
        ordering = ["-sent_at"]
        indexes = [models.Index(fields=["reference"])]
