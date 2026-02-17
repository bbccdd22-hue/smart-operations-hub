from django.conf import settings
from django.db import models
from django.utils.text import slugify

from config.constants import (
    SYSTEM_CODE_BRANCH,
    SYSTEM_CODE_BRAND,
    SYSTEM_CODE_CITY,
    SYSTEM_CODE_DISTRICT,
    SYSTEM_CODE_BRANCH_TYPE,
    SYSTEM_CODE_USER_PROFILE,
)


def _next_option_code(prefix: str, model_class, code_field: str = "option_code", digits: int = 3) -> str:
    """Generate next unique code e.g. CITY-01, CITY-02 or DIST-001, TYPE-001."""
    from django.db.models import Max
    pattern = f"{prefix}-"
    qs = model_class.objects.filter(**{f"{code_field}__startswith": pattern})
    max_num = qs.aggregate(m=Max(code_field))["m"]
    if not max_num or not str(max_num).replace(prefix, "").replace("-", "").isdigit():
        return f"{prefix}-{1:0{digits}d}"
    try:
        num = int(str(max_num).split("-")[-1]) + 1
        return f"{prefix}-{num:0{digits}d}"
    except (ValueError, IndexError):
        return f"{prefix}-{1:0{digits}d}"


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class City(TimestampedModel):
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_CITY, db_index=True,
        help_text="ERP hierarchy code",
    )
    option_code = models.CharField(
        max_length=16, unique=True, blank=True, db_index=True,
        help_text="Unique display code e.g. CITY-01",
    )
    name_en = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True, default="")
    code = models.SlugField(max_length=120, unique=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        import uuid
        if not self.code:
            raw = slugify(self.name_en)[:100] or f"city-{uuid.uuid4().hex[:6]}"
            base = raw
            self.code = base
            for _ in range(20):
                if not City.objects.filter(code=self.code).exclude(pk=self.pk).exists():
                    break
                self.code = f"{base}-{uuid.uuid4().hex[:6]}"[:120]
        if not self.option_code:
            self.option_code = _next_option_code("CITY", City, digits=2)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name_en


class District(TimestampedModel):
    """District/Area within a City. Option code: DIST-01."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_DISTRICT, db_index=True,
    )
    option_code = models.CharField(max_length=16, unique=True, blank=True, db_index=True)
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="districts")
    name_en = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.option_code:
            self.option_code = _next_option_code("DIST", District)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.city.name_en} - {self.name_en}"

    class Meta:
        unique_together = [("city", "name_en")]


class BranchType(TimestampedModel):
    """Branch type: Branch, Kiosk, etc. Option code: TYPE-01."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_BRANCH_TYPE, db_index=True,
    )
    option_code = models.CharField(max_length=16, unique=True, blank=True, db_index=True)
    name_en = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.option_code:
            self.option_code = _next_option_code("TYPE", BranchType)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name_en


class Brand(TimestampedModel):
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_BRAND, db_index=True,
        help_text="ERP hierarchy code",
    )
    name = models.CharField(max_length=120, unique=True)
    name_ar = models.CharField(max_length=120, blank=True, default="", help_text="Arabic display name for reports")
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    brand_code = models.CharField(
        max_length=16,
        unique=True,
        blank=True,
        default="",
        help_text="Code-based identifier (e.g. 001, HEMI_HQ). Shown in reports/filters as-is.",
    )
    chart_rev_prefix = models.CharField(
        max_length=16,
        blank=True,
        default="",
        db_index=True,
        help_text="Chart of accounts revenue prefix (e.g. 0410101). Used for report filtering.",
    )
    chart_exp_prefix = models.CharField(
        max_length=16,
        blank=True,
        default="",
        db_index=True,
        help_text="Chart of accounts expense prefix (e.g. 051010101). Used for report filtering.",
    )
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:120]
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Branch(TimestampedModel):
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_BRANCH, db_index=True,
        help_text="ERP hierarchy code",
    )
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="branches")
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="branches")
    district = models.ForeignKey(
        "District", on_delete=models.PROTECT, null=True, blank=True, related_name="branches"
    )
    branch_type = models.ForeignKey(
        "BranchType", on_delete=models.PROTECT, null=True, blank=True, related_name="branches"
    )

    name = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200, blank=True, default="", help_text="Arabic name for reports")
    code = models.SlugField(max_length=120)
    branch_code = models.CharField(
        max_length=32,
        blank=True,
        default="",
        db_index=True,
        help_text="Excel Branch Code (e.g. B30, B34). Mandatory for 8OZ. Used for strict data mapping.",
    )

    # Foodics linkage (API v5)
    foodics_branch_id = models.CharField(max_length=64, blank=True, default="")

    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["brand", "code"], name="uniq_branch_code_per_brand"),
        ]

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = slugify(self.name)[:120]
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.brand.name} - {self.name}"


class UserRole(models.TextChoices):
    OWNER = "owner", "Owner"
    GENERAL_MANAGER = "general_manager", "General Manager"
    BRAND_MANAGER = "brand_manager", "Brand Manager"
    BRANCH_SUPERVISOR = "branch_supervisor", "Branch Supervisor"
    EXTERNAL_ACCOUNTANT = "external_accountant", "External Accountant"


class UserProfile(TimestampedModel):
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_USER_PROFILE, db_index=True,
        help_text="ERP hierarchy code",
    )
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=32, choices=UserRole.choices, default=UserRole.BRANCH_SUPERVISOR)

    # Optional scoping (owners can leave these null)
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, null=True, blank=True, related_name="users")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True, related_name="users")
    all_brands = models.BooleanField(default=False, help_text="General Manager: access to all brands [Ref: 2026-02-13].")
    brand_ids = models.JSONField(default=list, blank=True, help_text="Brands Supervisor: list of brand IDs when >1 brand [Ref: 2026-02-13].")

    # Extended profile fields
    phone = models.CharField(max_length=32, blank=True, default="")
    employee_id = models.CharField(max_length=64, blank=True, default="")
    preferred_language = models.CharField(max_length=8, blank=True, default="en")  # ar, en
    login_code = models.CharField(max_length=64, blank=True, default="")

    def __str__(self) -> str:
        return f"{self.user_id} ({self.role})"


class NotificationPreference(models.Model):
    """SAIF/Owner notification preferences. One row per user per type."""
    NOTIFICATION_TYPES = [
        ("user_profile_changes", "User Profile / Email Changes"),
        ("account_freeze_activate", "Account Freeze/Activate Actions"),
        ("excel_sales_uploads", "Excel Sales Uploads (8OZ/Blanca)"),
        ("shift_closing_updates", "Shift Closing Updates"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preferences"
    )
    notification_type = models.CharField(max_length=64, choices=NOTIFICATION_TYPES)
    enabled = models.BooleanField(default=True)

    class Meta:
        unique_together = [("user", "notification_type")]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.notification_type}: {self.enabled}"


class AdminNotification(models.Model):
    """Live notifications for SAIF (owner). Shown as toast/badge."""
    EVENT_TYPES = [
        ("user_profile_updated", "User profile/email updated"),
        ("user_frozen", "User account frozen"),
        ("user_activated", "User account activated"),
        ("user_created", "New user added to branch"),
        ("excel_uploaded", "Excel sales uploaded"),
        ("shift_closed", "Shift closing submitted"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="admin_notifications"
    )
    event_type = models.CharField(max_length=64, choices=EVENT_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.created_at})"


class ActivityLog(models.Model):
    """سجل الرقابة – كل حركة يقوم بها أي مستخدم (فقط سيف يرى هذه الصفحة)."""
    ACTION_TYPES = [
        ("login", "تسجيل دخول"),
        ("page_view", "عرض صفحة"),
        ("file_upload", "رفع ملف"),
        ("create", "إنشاء"),
        ("update", "تعديل"),
        ("delete", "حذف"),
        ("export", "تصدير"),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="activity_logs"
    )
    action_type = models.CharField(max_length=32, choices=ACTION_TYPES)
    description = models.CharField(max_length=500, blank=True, default="")
    page_path = models.CharField(max_length=256, blank=True, default="")
    file_name = models.CharField(max_length=255, blank=True, default="")
    target_model = models.CharField(max_length=64, blank=True, default="")
    target_id = models.CharField(max_length=64, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Activity Log"
        verbose_name_plural = "سجل الرقابة"

    def __str__(self):
        return f"{self.user_id} {self.action_type} @ {self.created_at}"


class RolePermissionConfig(models.Model):
    """صلاحيات الأدوار – قابلة للتعديل من سيف فقط. تُطبق فوراً على المستخدمين."""
    role = models.CharField(max_length=32, unique=True, db_index=True)  # owner, general_manager, brand_manager, branch_supervisor, external_accountant
    permissions = models.JSONField(
        default=dict,
        help_text='{"view_financial_reports": true, "upload_files": true, "view_activity_log": false, "edit_chart_of_accounts": false}',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Role Permission Config"
        verbose_name_plural = "Role Permission Configs"

    def __str__(self):
        return f"{self.role}: {self.permissions}"


# صلاحيات افتراضية لكل دور (تُستخدم عند عدم وجود سجل)
# تطابق السلوك الحالي: owner/GM/brand_manager يرفعون، external_accountant لا، branch_supervisor محدود
ROLE_PERMISSION_DEFAULTS = {
    "owner": {"view_financial_reports": True, "upload_files": True, "view_activity_log": False, "edit_chart_of_accounts": False},
    "general_manager": {"view_financial_reports": True, "upload_files": True, "view_activity_log": False, "edit_chart_of_accounts": False},
    "brand_manager": {"view_financial_reports": True, "upload_files": True, "view_activity_log": False, "edit_chart_of_accounts": False},
    "branch_supervisor": {"view_financial_reports": True, "upload_files": True, "view_activity_log": False, "edit_chart_of_accounts": False},
    "external_accountant": {"view_financial_reports": True, "upload_files": False, "view_activity_log": False, "edit_chart_of_accounts": False},
}


class SavedView(models.Model):
    """SAIF's saved filter views. One-click dashboard state."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_views"
    )
    name = models.CharField(max_length=120)
    brand_slug = models.CharField(max_length=64, blank=True, default="")
    branch_ids = models.JSONField(default=list)  # [1, 2, 3]
    report_type = models.CharField(max_length=32, blank=True, default="daily_sales")
    date_range_days = models.IntegerField(default=1, help_text="1=today, 7=last 7 days, etc.")
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_default", "name"]

    def __str__(self) -> str:
        return f"{self.user.username}: {self.name}"
