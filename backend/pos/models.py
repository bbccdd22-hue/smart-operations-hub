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


# ─── Table Management ─────────────────────────────────────────────────────────

class TableStatus(models.TextChoices):
    AVAILABLE  = "available",  "فارغة"
    OCCUPIED   = "occupied",   "محتلة"
    RESERVED   = "reserved",   "محجوزة"
    PAID       = "paid",       "مدفوعة"
    CLEANING   = "cleaning",   "قيد التنظيف"


class RestaurantTable(models.Model):
    """
    طاولة مطعم — Floor Plan Unit.

    كل طاولة مرتبطة بفرع، لها رقم، سعة، وحالة حالية.
    تتحكم في الـ KDS (Kitchen Display) عبر ربطها بالطلبات.
    """
    branch = models.ForeignKey(
        "org.Branch", on_delete=models.CASCADE, related_name="tables",
        help_text="الفرع الذي تنتمي إليه الطاولة",
    )
    number = models.CharField(max_length=16, help_text="رقم الطاولة أو اسمها (مثل: T1، VIP-3)")
    capacity = models.PositiveSmallIntegerField(default=4)
    status = models.CharField(
        max_length=16, choices=TableStatus.choices, default=TableStatus.AVAILABLE, db_index=True,
    )
    # Current sale linked to this table (cleared when paid/available)
    current_sale = models.OneToOneField(
        SaleTransaction,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="table",
    )
    # Floor plan position (for drag-and-drop UI)
    pos_x = models.SmallIntegerField(default=0, help_text="X position in floor plan grid")
    pos_y = models.SmallIntegerField(default=0, help_text="Y position in floor plan grid")
    section = models.CharField(
        max_length=64, blank=True, default="",
        help_text="اسم القسم (مثل: داخلي، خارجي، VIP)",
    )
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        unique_together = [("branch", "number")]
        ordering = ["branch", "section", "number"]

    def __str__(self):
        return f"Table {self.number} @ {self.branch.name} [{self.status}]"

    def open_for_sale(self, sale: "SaleTransaction") -> None:
        """Assign a sale to this table and mark it occupied."""
        self.current_sale = sale
        self.status = TableStatus.OCCUPIED
        self.save(update_fields=["current_sale", "status"])

    def mark_paid(self) -> None:
        """Mark table as paid (still shows bill until cleared)."""
        self.status = TableStatus.PAID
        self.save(update_fields=["status"])

    def clear(self) -> None:
        """Reset table to available after cleaning."""
        self.current_sale = None
        self.status = TableStatus.AVAILABLE
        self.save(update_fields=["current_sale", "status"])


class TableMerge(models.Model):
    """
    دمج طاولتين أو أكثر في فاتورة واحدة.
    """
    primary_table = models.ForeignKey(
        RestaurantTable, on_delete=models.CASCADE,
        related_name="merged_primaries",
    )
    secondary_table = models.ForeignKey(
        RestaurantTable, on_delete=models.CASCADE,
        related_name="merged_secondaries",
    )
    merged_sale = models.ForeignKey(
        SaleTransaction, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="merged_tables",
    )
    merged_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-merged_at"]


# ─── Kitchen Display System (KDS) ─────────────────────────────────────────────

class KDSOrderStatus(models.TextChoices):
    PENDING   = "pending",   "انتظار"
    COOKING   = "cooking",   "قيد التحضير"
    READY     = "ready",     "جاهز"
    DELIVERED = "delivered", "تم التسليم"
    CANCELLED = "cancelled", "ملغي"


class KDSOrder(TimestampedModel):
    """
    Kitchen Display Order — tracks each order through the kitchen queue.
    Linked 1:1 with a SaleTransaction (or created standalone for dine-in).
    pending → cooking → ready → delivered
    """
    sale = models.OneToOneField(
        "SaleTransaction",
        on_delete=models.CASCADE,
        related_name="kds_order",
        null=True, blank=True,
    )
    branch = models.ForeignKey(
        "org.Branch", on_delete=models.CASCADE, related_name="kds_orders",
    )
    order_number = models.CharField(max_length=32, db_index=True)
    table_number = models.CharField(max_length=16, blank=True, default="")
    items = models.JSONField(
        default=list,
        help_text="[{name, qty, notes, modifiers}]",
    )
    kds_status = models.CharField(
        max_length=16,
        choices=KDSOrderStatus.choices,
        default=KDSOrderStatus.PENDING,
        db_index=True,
    )
    cooking_started_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    priority = models.PositiveSmallIntegerField(
        default=0, db_index=True,
        help_text="أولوية المطبخ (0=عادي، 1=أولوية، 2=عاجل)",
    )
    notes = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["priority", "created_at"]

    def __str__(self):
        return f"KDS #{self.order_number} [{self.kds_status}]"

    def advance_status(self) -> str:
        """Move to next status in sequence and record timestamps."""
        from django.utils import timezone
        now = timezone.now()
        if self.kds_status == KDSOrderStatus.PENDING:
            self.kds_status = KDSOrderStatus.COOKING
            self.cooking_started_at = now
        elif self.kds_status == KDSOrderStatus.COOKING:
            self.kds_status = KDSOrderStatus.READY
            self.ready_at = now
        elif self.kds_status == KDSOrderStatus.READY:
            self.kds_status = KDSOrderStatus.DELIVERED
            self.delivered_at = now
        self.save()
        return self.kds_status
