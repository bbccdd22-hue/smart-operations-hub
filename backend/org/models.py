from django.conf import settings
from django.db import models
from django.utils.text import slugify


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class City(TimestampedModel):
    name_en = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True, default="")
    code = models.SlugField(max_length=120, unique=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = slugify(self.name_en)[:120]
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name_en


class Brand(TimestampedModel):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    brand_code = models.CharField(
        max_length=16,
        unique=True,
        blank=True,
        default="",
        help_text="Code-based identifier (e.g. 001 for 8OZ). Required for data integrity.",
    )
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:120]
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Branch(TimestampedModel):
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="branches")
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="branches")

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
    BRAND_MANAGER = "brand_manager", "Brand Manager"
    BRANCH_SUPERVISOR = "branch_supervisor", "Branch Supervisor"


class UserProfile(TimestampedModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=32, choices=UserRole.choices, default=UserRole.BRANCH_SUPERVISOR)

    # Optional scoping (owners can leave these null)
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, null=True, blank=True, related_name="users")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True, related_name="users")

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
