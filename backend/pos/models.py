"""
POS - شاشة الكاشير.
معاملات البيع، ربط المخزون والمحاسبة.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from org.models import Branch, TimestampedModel


class SaleStatus(models.TextChoices):
    COMPLETED = "completed", "مكتملة"
    PENDING_SYNC = "pending_sync", "انتظار المزامنة (Offline)"


class PaymentMethod(models.TextChoices):
    CASH = "cash", "كاش"
    CARD = "card", "بطاقة / شبكة"
    WALLET = "wallet", "محفظة إلكترونية"
    DELIVERY_APP = "delivery_app", "تطبيق توصيل"


class SaleTransaction(TimestampedModel):
    """
    معاملة بيع واحدة - من الكاشير.
    items: [{ product_sku, product_name, qty, unit_price, modifiers: [], discount_amount }]
    """
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="pos_sales")
    sale_number = models.CharField(max_length=32, unique=True, db_index=True)
    items = models.JSONField(
        default=list,
        help_text="[{product_sku, product_name, qty, unit_price, modifiers, discount_amount}]",
    )
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    payment_method = models.CharField(
        max_length=24, choices=PaymentMethod.choices, default=PaymentMethod.CASH, db_index=True,
    )
    status = models.CharField(
        max_length=20, choices=SaleStatus.choices, default=SaleStatus.COMPLETED, db_index=True,
    )
    cashier = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="pos_sales",
    )
    journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="pos_sales",
    )
    customer = models.ForeignKey(
        "crm.Customer", on_delete=models.SET_NULL, null=True, blank=True, related_name="sales",
    )
    notes = models.CharField(max_length=500, blank=True, default="")
    terminal_reference = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Sale {self.sale_number}"


class ProductModifier(models.Model):
    """
    خيار تعديل المنتج - ربط بخصم مخزني وتكلفة إضافية.
    (إضافة حليب، درجة حرارة، نوع البن)
    """
    MODIFIER_TYPE_ADDON = "addon"
    MODIFIER_TYPE_TEMP = "temperature"
    MODIFIER_TYPE_MILK = "milk_type"

    name = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True, default="")
    price_add = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    modifier_type = models.CharField(max_length=24, default=MODIFIER_TYPE_ADDON, db_index=True)
    ingredient = models.ForeignKey(
        "inventory.Ingredient", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="pos_modifiers", help_text="للخصم من المخزون عند الاختيار",
    )
    qty_per_use = models.DecimalField(
        max_digits=10, decimal_places=4, default=Decimal("1"),
        help_text="كمية المكوّن المُخصمة لكل استخدام (بالوحدة الأساسية)",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SplitPayment(models.Model):
    """تقسيم الفاتورة - دفعات متعددة (كاش، شبكة، محفظة)."""
    sale = models.ForeignKey(SaleTransaction, on_delete=models.CASCADE, related_name="split_payments")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=24, choices=PaymentMethod.choices)
    terminal_reference = models.CharField(max_length=128, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]


class ProductModifierGroup(models.Model):
    """مجموعة تعديلات - مرتبطة بمنتج أو تصنيف."""
    name = models.CharField(max_length=120)
    modifiers = models.ManyToManyField(ProductModifier, blank=True, related_name="groups")

    def __str__(self):
        return self.name
