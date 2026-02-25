"""
Central Kitchen & MRP - أوامر الإنتاج، طلبات الفروع، مذكرات التسليم.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from config.constants import (
    SYSTEM_CODE_DELIVERY_NOTE,
    SYSTEM_CODE_INTERNAL_INDENT,
    SYSTEM_CODE_PRODUCTION_ORDER,
)
from org.models import Branch, Brand, TimestampedModel


class CentralKitchenBranch(TimestampedModel):
    """فرع مخصص كمطبخ مركزي (يصنع منتجات وسيطة)."""
    branch = models.OneToOneField(Branch, on_delete=models.PROTECT, related_name="central_kitchen")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return str(self.branch)


class ProductionOrderStatus(models.TextChoices):
    DRAFT = "draft", "مسودة"
    RELEASED = "released", "صادر"
    IN_PROGRESS = "in_progress", "قيد التنفيذ"
    COMPLETED = "completed", "مكتمل"


class ProductionOrder(TimestampedModel):
    """أمر إنتاج - تحويل مواد خام إلى منتج وسيط."""
    system_code = models.CharField(max_length=16, default=SYSTEM_CODE_PRODUCTION_ORDER, db_index=True)
    kitchen_branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="production_orders")
    order_number = models.CharField(max_length=32, unique=True, db_index=True)
    status = models.CharField(
        max_length=20, choices=ProductionOrderStatus.choices, default=ProductionOrderStatus.DRAFT, db_index=True,
    )
    product = models.ForeignKey(
        "inventory.FoodicsProduct", on_delete=models.PROTECT, related_name="production_orders",
        help_text="المنتج الوسيط المُنتَج",
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit = models.ForeignKey("inventory.Unit", on_delete=models.PROTECT, related_name="production_orders")
    total_cost = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text="تكلفة الإنتاج المحسوبة من المواد الخام",
    )
    planned_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="production_orders",
    )

    class Meta:
        ordering = ["-planned_date", "-created_at"]

    def __str__(self):
        return f"PO-{self.order_number}"


class ProductionOrderLine(TimestampedModel):
    """سطر أمر الإنتاج - مادة خام مطلوبة."""
    order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name="lines")
    ingredient = models.ForeignKey("inventory.Ingredient", on_delete=models.PROTECT, related_name="production_lines")
    quantity_required = models.DecimalField(max_digits=14, decimal_places=4)
    unit = models.ForeignKey("inventory.Unit", on_delete=models.PROTECT, related_name="production_line_units")

    def __str__(self):
        return f"{self.order.order_number}: {self.ingredient.name_en} x{self.quantity_required}"


class InternalIndentStatus(models.TextChoices):
    DRAFT = "draft", "مسودة"
    SUBMITTED = "submitted", "مقدم"
    APPROVED = "approved", "معتمد"
    DELIVERED = "delivered", "تم التسليم"


class InternalIndent(TimestampedModel):
    """طلب فرع من المطبخ المركزي (Internal Indent)."""
    system_code = models.CharField(max_length=16, default=SYSTEM_CODE_INTERNAL_INDENT, db_index=True)
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="internal_indents")
    from_branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="indents_out")
    to_branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="indents_in")
    indent_number = models.CharField(max_length=32, unique=True, db_index=True)
    status = models.CharField(
        max_length=20, choices=InternalIndentStatus.choices, default=InternalIndentStatus.DRAFT, db_index=True,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="requested_indents",
    )
    requested_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return f"IND-{self.indent_number}"


class InternalIndentLine(TimestampedModel):
    """سطر الطلب."""
    indent = models.ForeignKey(InternalIndent, on_delete=models.CASCADE, related_name="lines")
    ingredient = models.ForeignKey("inventory.Ingredient", on_delete=models.PROTECT, related_name="indent_lines")
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit = models.ForeignKey("inventory.Unit", on_delete=models.PROTECT, related_name="indent_line_units")

    def __str__(self):
        return f"{self.indent.indent_number}: {self.ingredient.name_en} x{self.quantity}"


class DeliveryNote(TimestampedModel):
    """مذكرة تسليم - تحويل طلب إلى مذكرة."""
    system_code = models.CharField(max_length=16, default=SYSTEM_CODE_DELIVERY_NOTE, db_index=True)
    indent = models.ForeignKey(InternalIndent, on_delete=models.PROTECT, related_name="delivery_notes")
    note_number = models.CharField(max_length=32, unique=True, db_index=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    delivered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="delivered_notes",
    )

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"DN-{self.note_number}"
