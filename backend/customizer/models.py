"""
System Customizer – Dynamic UI/UX Engine.
Stores template and field definitions; custom field values are stored in CustomFieldValue.
See docs/SYSTEM_CUSTOMIZER_ARCHITECTURE.md.
"""
from decimal import Decimal

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class EntityTemplate(models.Model):
    """
    Identifies a form/table in the system (e.g. Journal Entry, Sales, Inventory).
    """
    class TemplateType(models.TextChoices):
        FORM = "form", "Form / نموذج"
        LINE_ITEM = "line_item", "Line Item / سطر تفصيلي"
        LIST = "list", "List / قائمة"

    app_label = models.CharField(max_length=64, db_index=True)
    model_name = models.CharField(max_length=64, db_index=True)
    slug = models.SlugField(max_length=80, unique=True, db_index=True)
    template_type = models.CharField(
        max_length=16,
        choices=TemplateType.choices,
        default=TemplateType.FORM,
        db_index=True,
    )
    name_ar = models.CharField(max_length=200)
    name_en = models.CharField(max_length=200)
    parent_template = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="child_templates",
        help_text="For line_item: the parent form template",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["app_label", "model_name"]
        verbose_name = "Entity Template"
        verbose_name_plural = "Entity Templates"

    def __str__(self):
        return f"{self.slug} ({self.name_en})"


class DynamicFieldDefinition(models.Model):
    """
    One field in a template: system (existing column) or custom (value in CustomFieldValue).
    """
    class FieldType(models.TextChoices):
        TEXT = "text", "Text"
        NUMBER = "number", "Number"
        DATE = "date", "Date"
        DATETIME = "datetime", "DateTime"
        BOOLEAN = "boolean", "Boolean"
        SELECT = "select", "Select"
        CURRENCY = "currency", "Currency"
        FOREIGN_KEY = "foreign_key", "Foreign Key"

    template = models.ForeignKey(
        EntityTemplate,
        on_delete=models.CASCADE,
        related_name="field_definitions",
    )
    field_key = models.CharField(max_length=80, db_index=True)
    label_ar = models.CharField(max_length=200, blank=True, default="")
    label_en = models.CharField(max_length=200, blank=True, default="")
    field_type = models.CharField(
        max_length=24,
        choices=FieldType.choices,
        default=FieldType.TEXT,
        db_index=True,
    )
    required = models.BooleanField(default=False)
    visible = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)
    section = models.CharField(max_length=64, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    is_system = models.BooleanField(
        default=True,
        help_text="True = existing model field (order/visibility only). False = custom field (value in CustomFieldValue).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["template", "order", "field_key"]
        unique_together = [["template", "field_key"]]
        verbose_name = "Dynamic Field Definition"
        verbose_name_plural = "Dynamic Field Definitions"

    def __str__(self):
        return f"{self.template.slug}.{self.field_key}"


class CustomFieldValue(models.Model):
    """
    Stores values for custom fields (DynamicFieldDefinition.is_system=False).
    Generic relation to any model instance.
    """
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name="+",
    )
    object_id = models.PositiveIntegerField(db_index=True)
    content_object = GenericForeignKey("content_type", "object_id")

    field_definition = models.ForeignKey(
        DynamicFieldDefinition,
        on_delete=models.CASCADE,
        related_name="values",
    )

    value_text = models.TextField(blank=True, default="", db_index=True)
    value_number = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
        db_index=True,
    )
    value_date = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        unique_together = [["content_type", "object_id", "field_definition"]]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["field_definition", "value_text"]),
        ]
        verbose_name = "Custom Field Value"
        verbose_name_plural = "Custom Field Values"

    def set_value(self, value):
        if value is None:
            self.value_text = ""
            self.value_number = None
            self.value_date = None
            return
        ft = self.field_definition.field_type
        if ft in ("number", "currency"):
            self.value_number = Decimal(str(value)) if value != "" else None
            self.value_text = ""
            self.value_date = None
        elif ft in ("date", "datetime"):
            self.value_date = value
            self.value_text = ""
            self.value_number = None
        else:
            self.value_text = str(value) if value is not None else ""
            self.value_number = None
            self.value_date = None

    def get_value(self):
        if self.value_number is not None:
            return self.value_number
        if self.value_date is not None:
            return self.value_date
        return self.value_text or None
