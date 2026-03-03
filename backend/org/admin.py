from django.contrib import admin
from .models import Branch, EnterpriseAuditLog, ModuleConfig, Organization, Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "plan", "is_active", "onboarding_complete", "admin_user", "created_at")
    list_filter = ("plan", "is_active", "onboarding_complete")
    search_fields = ("name", "slug", "admin_user__username")
    readonly_fields = ("uuid", "created_at", "updated_at", "trial_ends_at")
    fieldsets = (
        ("Identity", {"fields": ("uuid", "name", "name_ar", "slug")}),
        ("Organization", {"fields": ("organization", "admin_user")}),
        ("Subscription", {"fields": ("plan", "max_branches", "trial_ends_at", "subscription_ends_at")}),
        ("Status", {"fields": ("is_active", "onboarding_complete")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("name", "brand", "city", "pos_depletion_enabled", "is_active")
    list_filter = ("brand", "pos_depletion_enabled", "is_active")
    list_editable = ("pos_depletion_enabled",)
    search_fields = ("name", "branch_code")
    fieldsets = (
        (None, {
            "fields": ("brand", "city", "name", "name_ar", "branch_code", "is_active")
        }),
        ("POS / Inventory", {
            "fields": ("pos_depletion_enabled",),
            "description": (
                "تفعيل هذا الخيار يطلق خصم المخزون فوراً عند كل عملية بيع POS. "
                "يوقف الخصم عبر Excel تلقائياً لهذا الفرع لتجنب الازدواجية."
            ),
        }),
    )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "org_code", "is_active")
    search_fields = ("name", "org_code")


@admin.register(EnterpriseAuditLog)
class EnterpriseAuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "model_name", "object_id", "user", "ip_address", "created_at")
    list_filter = ("action", "model_name")
    search_fields = ("object_id", "model_name")
    readonly_fields = ("action", "model_name", "object_id", "object_repr", "changed_fields", "user", "ip_address", "created_at")

    def has_delete_permission(self, request, obj=None):
        return False  # منع الحذف من واجهة Admin أيضاً


@admin.register(ModuleConfig)
class ModuleConfigAdmin(admin.ModelAdmin):
    list_display = ("module_key", "brand", "is_enabled")
    list_filter = ("module_key", "is_enabled")
