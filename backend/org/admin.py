from django.contrib import admin
from .models import EnterpriseAuditLog, ModuleConfig, Organization


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
