import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify

from config.constants import (
    SYSTEM_CODE_BRANCH,
    SYSTEM_CODE_BRAND,
    SYSTEM_CODE_CITY,
    SYSTEM_CODE_DISTRICT,
    SYSTEM_CODE_BRANCH_TYPE,
    SYSTEM_CODE_ENTERPRISE_AUDIT,
    SYSTEM_CODE_ORGANIZATION,
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


class Organization(TimestampedModel):
    """
    النواة المركزية للتعدد المؤسسي (Multi-Tenancy).
    كل منصة تدير عدة شركات مستقلة - عزل كامل للبيانات.
    Organization → Brand → Branch
    """
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_ORGANIZATION, db_index=True,
        help_text="ERP hierarchy code",
    )
    name = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True, default="")
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    org_code = models.CharField(
        max_length=16,
        unique=True,
        blank=True,
        default="",
        db_index=True,
        help_text="كود المؤسسة (مثل ORG001)",
    )
    tax_number = models.CharField(max_length=64, blank=True, default="")
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:120]
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name

    class Meta:
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"


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
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="brands",
        null=True,
        blank=True,
        db_index=True,
        help_text="المؤسسة الأم – عزل البيانات حسب الـ Tenant",
    )
    name = models.CharField(max_length=120)
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
    default_currency = models.ForeignKey(
        "currencies.Currency",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="brands",
        help_text="Default currency for this brand (e.g. SAR).",
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

    # Geo-fencing للتحقق من الحضور (تسجيل الدخول داخل نطاق الفرع)
    geo_fence_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    geo_fence_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    geo_fence_radius_m = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="نصف قطر النطاق الجغرافي بالأمتار (مثلاً 100)",
    )

    is_central_kitchen = models.BooleanField(
        default=False, db_index=True,
        help_text="المطبخ المركزي – يستقبل طلبات التحويل من الفروع",
    )

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
        ("chart_account_missing", "Chart account missing - قيد يستخدم حساباً غير موجود"),
        ("negative_stock", "رصيد سالب - تنبيه حرج"),
        ("stale_transfer", "تحويل عالق أكثر من 24 ساعة"),
        ("daily_reconciliation_mismatch", "فجوة في المطابقة اليومية – مبيعات منتجات/يومية/إقفالات"),
        ("notification_engine", "تنبيه من محرك التنبيهات (وردية، مخزون، إلخ)"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="admin_notifications"
    )
    event_type = models.CharField(max_length=64, choices=EVENT_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default="")
    reference = models.CharField(max_length=128, blank=True, default="", db_index=True, help_text="للتفادي من التكرار، مثلاً stale_transfer_123")
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


class EnterpriseAuditLog(models.Model):
    """
    سجل تدقيق لا يُحذف - Enterprise Audit Trail.
    يسجل: من غيّر ماذا؟ متى؟ من أي IP؟
    يستخدم للإشراف والامتثال - لا يسمح بحذف السجلات.
    """
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_ENTERPRISE_AUDIT, db_index=True,
    )
    action = models.CharField(max_length=16, choices=[("create", "إنشاء"), ("update", "تعديل"), ("delete", "حذف")])
    model_name = models.CharField(max_length=128, db_index=True)
    object_id = models.CharField(max_length=64, db_index=True)
    object_repr = models.CharField(max_length=255, blank=True, default="")
    changed_fields = models.JSONField(default=dict, help_text="الحقول المتغيرة مع القيم القديمة/الجديدة")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="enterprise_audit_logs",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Enterprise Audit Log"
        verbose_name_plural = "سجل التدقيق المؤسسي"

    def __str__(self):
        return f"{self.action} {self.model_name}:{self.object_id} by {self.user_id} @ {self.created_at}"

    def delete(self, *args, **kwargs):
        raise NotImplementedError("EnterpriseAuditLog records cannot be deleted.")


class ModuleConfig(models.Model):
    """
    تفعيل/إطفاء الأنظمة المعيارية (Modular).
    crm_loyalty | central_kitchen | hrms | procurement | quality | bi
    """
    module_key = models.CharField(max_length=64, db_index=True)
    brand = models.ForeignKey(
        Brand, on_delete=models.CASCADE, null=True, blank=True, related_name="module_configs",
    )
    is_enabled = models.BooleanField(default=True)
    settings = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["module_key"]
        unique_together = [["module_key", "brand"]]

    def __str__(self):
        return f"{self.module_key}: {'ON' if self.is_enabled else 'OFF'}"


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
# صلاحيات مجهرية: view_cost_price, cancel_invoice, view_customer_phone
ROLE_PERMISSION_DEFAULTS = {
    "owner": {
        "view_financial_reports": True, "upload_files": True, "view_activity_log": False, "edit_chart_of_accounts": False,
        "perm_shift_closing": True, "perm_financial_reports": True, "perm_management_reports": True,
        "perm_full_system_access": True, "perm_order_forecasting": True, "perm_financial_auditor": True,
        "view_cost_price": True, "cancel_invoice": True, "view_customer_phone": True,
    },
    "general_manager": {
        "view_financial_reports": True, "upload_files": True, "view_activity_log": False, "edit_chart_of_accounts": False,
        "perm_shift_closing": True, "perm_financial_reports": True, "perm_management_reports": True,
        "perm_full_system_access": True, "perm_order_forecasting": True, "perm_financial_auditor": False,
        "view_cost_price": True, "cancel_invoice": True, "view_customer_phone": False,
    },
    "brand_manager": {
        "view_financial_reports": True, "upload_files": True, "view_activity_log": False, "edit_chart_of_accounts": False,
        "perm_shift_closing": True, "perm_financial_reports": True, "perm_management_reports": True,
        "perm_full_system_access": True, "perm_order_forecasting": True, "perm_financial_auditor": False,
        "view_cost_price": True, "cancel_invoice": False, "view_customer_phone": False,
    },
    "branch_supervisor": {
        "view_financial_reports": True, "upload_files": True, "view_activity_log": False, "edit_chart_of_accounts": False,
        "perm_shift_closing": True, "perm_financial_reports": False, "perm_management_reports": True,
        "perm_full_system_access": False, "perm_order_forecasting": True, "perm_financial_auditor": False,
        "view_cost_price": False, "cancel_invoice": False, "view_customer_phone": False,
    },
    "external_accountant": {
        "view_financial_reports": True, "upload_files": False, "view_activity_log": False, "edit_chart_of_accounts": False,
        "perm_shift_closing": False, "perm_financial_reports": True, "perm_management_reports": False,
        "perm_full_system_access": False, "perm_order_forecasting": False, "perm_financial_auditor": False,
        "view_cost_price": True, "cancel_invoice": False, "view_customer_phone": False,
    },
}


class SystemErrorLog(models.Model):
    """
    سجل أخطاء النظام – للمالك (سيف) لمراجعة الأعطال والخصم الفاشل.
    """
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    ERROR_TYPES = [
        ("depletion_failed", "فشل خصم المخزون"),
        ("upload_failed", "فشل رفع ملف"),
        ("transfer_failed", "فشل التحويل"),
        ("other", "أخرى"),
    ]
    created_at = models.DateTimeField(auto_now_add=True)
    error_type = models.CharField(max_length=32, choices=ERROR_TYPES, default="other", db_index=True)
    message = models.TextField()
    traceback = models.TextField(blank=True, default="")
    context = models.JSONField(default=dict, blank=True, help_text="مثل upload_id، branch_id، إلخ")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="system_error_logs",
    )
    resolved = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "System Error Log"
        verbose_name_plural = "سجل أخطاء النظام"

    def __str__(self):
        return f"{self.error_type} @ {self.created_at}"


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


class SystemTaskHeartbeat(models.Model):
    """نبض المهام الخلفية – للمالك التأكد أن المراقب الآلي يعمل."""
    task_name = models.CharField(max_length=64, unique=True, db_index=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(
        max_length=16,
        choices=[("ok", "OK"), ("error", "Error"), ("warning", "Warning"), ("unknown", "Unknown")],
        default="unknown",
    )
    last_message = models.CharField(max_length=500, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "System Task Heartbeat"
        verbose_name_plural = "نبض المهام الخلفية"

    def __str__(self) -> str:
        return f"{self.task_name}: {self.last_status} @ {self.last_run_at}"
