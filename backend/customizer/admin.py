from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from .models import CustomFieldValue, DynamicFieldDefinition, EntityTemplate


@admin.register(EntityTemplate)
class EntityTemplateAdmin(admin.ModelAdmin):
    list_display = ("slug", "app_label", "model_name", "template_type", "name_en", "updated_at")
    list_filter = ("template_type", "app_label")
    search_fields = ("slug", "name_en", "name_ar", "model_name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(DynamicFieldDefinition)
class DynamicFieldDefinitionAdmin(admin.ModelAdmin):
    list_display = ("field_key", "template", "field_type", "order", "visible", "is_system", "updated_at")
    list_filter = ("template", "field_type", "is_system")
    search_fields = ("field_key", "label_en", "label_ar")
    readonly_fields = ("created_at", "updated_at")


@admin.register(CustomFieldValue)
class CustomFieldValueAdmin(admin.ModelAdmin):
    list_display = ("field_definition", "content_type", "object_id", "value_preview", "get_value_display")
    list_filter = ("field_definition__template", "content_type")
    search_fields = ("value_text",)

    def value_preview(self, obj):
        if obj.value_text:
            return (obj.value_text[:50] + "…") if len(obj.value_text) > 50 else obj.value_text
        if obj.value_number is not None:
            return str(obj.value_number)
        if obj.value_date:
            return str(obj.value_date)
        return "—"
    value_preview.short_description = _("Value")

    def get_value_display(self, obj):
        return obj.get_value()
    get_value_display.short_description = _("Value (resolved)")
