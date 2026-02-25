"""
Procurement Hub - نظام المشتريات والموردين.
سلسلة: طلب شراء → أمر شراء → استلام بضاعة → فاتورة مورد.
الربط المحاسبي: استحقاق للمورد عند الاستلام، تحديث المخزون تلقائياً.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from config.constants import (
    SYSTEM_CODE_GOODS_RECEIPT,
    SYSTEM_CODE_PURCHASE_ORDER,
    SYSTEM_CODE_PURCHASE_REQUEST,
    SYSTEM_CODE_SUPPLIER,
    SYSTEM_CODE_SUPPLIER_INVOICE,
)
from org.models import Branch, Brand, TimestampedModel


class Supplier(TimestampedModel):
    """مورد - الموردين مع فترات الائتمان."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_SUPPLIER, db_index=True,
    )
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="suppliers", db_index=True)
    name = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200, blank=True, default="")
    tax_number = models.CharField(max_length=64, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=32, blank=True, default="")
    address = models.TextField(blank=True, default="")
    credit_days = models.PositiveIntegerField(
        default=0, help_text="أيام الائتمان (صفر = دفعة مقدمة)",
    )
    payment_terms = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)
    portal_api_key = models.CharField(
        max_length=64, blank=True, default="", db_index=True,
        help_text="مفتاح API للبوابة – للموردين تسجيل الفواتير آلياً",
    )

    class Meta:
        ordering = ["name"]
        unique_together = [["brand", "name"]]

    def __str__(self):
        return self.name


class PurchaseRequestStatus(models.TextChoices):
    DRAFT = "draft", "مسودة"
    SUBMITTED = "submitted", "مقدم"
    APPROVED = "approved", "معتمد"
    REJECTED = "rejected", "مرفوض"
    CONVERTED = "converted", "تحويل لأمر شراء"


class PurchaseRequest(TimestampedModel):
    """طلب شراء."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_PURCHASE_REQUEST, db_index=True,
    )
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="purchase_requests")
    request_number = models.CharField(max_length=32, unique=True, db_index=True)
    status = models.CharField(
        max_length=16, choices=PurchaseRequestStatus.choices, default=PurchaseRequestStatus.DRAFT, db_index=True,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="purchase_requests",
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-requested_at"]

    def __str__(self):
        return f"PR-{self.request_number}"


class PurchaseRequestLine(TimestampedModel):
    """سطر طلب الشراء."""
    request = models.ForeignKey(PurchaseRequest, on_delete=models.CASCADE, related_name="lines")
    # يمكن ربطه بـ Ingredient أو وصف حر
    ingredient = models.ForeignKey(
        "inventory.Ingredient", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_request_lines",
    )
    description = models.CharField(max_length=255, help_text="وصف الصنف إن لم يكن مربوطاً بمكوّن")
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit = models.ForeignKey("inventory.Unit", on_delete=models.PROTECT, related_name="purchase_request_lines")
    estimated_unit_price = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)

    def __str__(self):
        return f"{self.request}: {self.description or (self.ingredient.name_en if self.ingredient else '')} x{self.quantity}"


class PurchaseOrderStatus(models.TextChoices):
    DRAFT = "draft", "مسودة"
    SENT = "sent", "مرسل للمورد"
    PARTIALLY_RECEIVED = "partially_received", "استلام جزئي"
    RECEIVED = "received", "مستلم بالكامل"
    CANCELLED = "cancelled", "ملغي"


class PurchaseOrder(TimestampedModel):
    """أمر شراء."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_PURCHASE_ORDER, db_index=True,
    )
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="purchase_orders")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="purchase_orders")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchase_orders")
    purchase_request = models.ForeignKey(
        PurchaseRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name="purchase_orders",
    )

    order_number = models.CharField(max_length=32, unique=True, db_index=True)
    status = models.CharField(
        max_length=24, choices=PurchaseOrderStatus.choices, default=PurchaseOrderStatus.DRAFT, db_index=True,
    )
    order_date = models.DateField(db_index=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_purchase_orders",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-order_date", "-created_at"]

    def __str__(self):
        return f"PO-{self.order_number}"


class PurchaseOrderLine(TimestampedModel):
    """سطر أمر الشراء."""
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    ingredient = models.ForeignKey(
        "inventory.Ingredient", on_delete=models.PROTECT, related_name="purchase_order_lines",
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit = models.ForeignKey("inventory.Unit", on_delete=models.PROTECT, related_name="purchase_order_lines")
    unit_price = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0.00"))

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.order.order_number}: {self.ingredient.name_en} x{self.quantity} @ {self.unit_price}"


class GoodsReceiptStatus(models.TextChoices):
    DRAFT = "draft", "مسودة"
    CONFIRMED = "confirmed", "مؤكد - تم تحديث المخزون والاستحقاق"


class GoodsReceipt(TimestampedModel):
    """استلام بضاعة - عند التأكيد: تحديث المخزون + قيد استحقاق للمورد."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_GOODS_RECEIPT, db_index=True,
    )
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="goods_receipts")
    receipt_number = models.CharField(max_length=32, unique=True, db_index=True)
    receipt_date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=16, choices=GoodsReceiptStatus.choices, default=GoodsReceiptStatus.DRAFT, db_index=True,
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="goods_receipts",
    )
    journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="goods_receipts",
        help_text="القيد المحاسبي للاستحقاق - يُنشأ عند التأكيد",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-receipt_date", "-created_at"]

    def __str__(self):
        return f"GR-{self.receipt_number}"

    @property
    def branch(self):
        return self.purchase_order.branch

    @property
    def supplier(self):
        return self.purchase_order.supplier


class GoodsReceiptLine(TimestampedModel):
    """سطر استلام - يحدد الكمية المستلمة من كل صنف."""
    goods_receipt = models.ForeignKey(GoodsReceipt, on_delete=models.CASCADE, related_name="lines")
    order_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.PROTECT, related_name="receipt_lines")
    quantity_received = models.DecimalField(max_digits=14, decimal_places=4)

    def __str__(self):
        return f"{self.goods_receipt.receipt_number}: {self.order_line.ingredient} qty={self.quantity_received}"


class SupplierInvoiceStatus(models.TextChoices):
    DRAFT = "draft", "مسودة"
    POSTED = "posted", "مرحّل - تم الخصم من الاستحقاق"


class SupplierInvoice(TimestampedModel):
    """فاتورة المورد - عند الترحيل: خصم من حساب المورد."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_SUPPLIER_INVOICE, db_index=True,
    )
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="invoices")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="supplier_invoices")
    goods_receipt = models.ForeignKey(
        GoodsReceipt, on_delete=models.SET_NULL, null=True, blank=True, related_name="invoices",
    )

    invoice_number = models.CharField(max_length=64, db_index=True)
    invoice_date = models.DateField(db_index=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(
        max_length=16, choices=SupplierInvoiceStatus.choices, default=SupplierInvoiceStatus.DRAFT, db_index=True,
    )
    journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="supplier_invoices",
        help_text="قيد الخصم من الاستحقاق والدفع",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-invoice_date"]
        unique_together = [["supplier", "invoice_number"]]

    def __str__(self):
        return f"INV-{self.invoice_number}"


class SupplierPortalUser(models.Model):
    """حساب بوابة المورد - للموردين لرفع الفواتير ومتابعة المستحقات."""
    supplier = models.OneToOneField(Supplier, on_delete=models.CASCADE, related_name="portal_user")
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="supplier_portal",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class AutoReorderRule(models.Model):
    """قاعدة إعادة الطلب - نقطة ثابتة أو استهلاك (معدل الاستهلاك)."""
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="auto_reorder_rules")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="auto_reorder_rules")
    ingredient = models.ForeignKey(
        "inventory.Ingredient", on_delete=models.PROTECT, related_name="auto_reorder_rules",
    )
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, null=True, blank=True, related_name="reorder_rules")
    reorder_level = models.DecimalField(max_digits=14, decimal_places=4, help_text="عند الوصول لهذا المستوى")
    reorder_quantity = models.DecimalField(max_digits=14, decimal_places=4, help_text="الكمية المطلوبة")
    use_consumption = models.BooleanField(
        default=False,
        help_text="استخدام معدل الاستهلاك للتنبؤ بدل النقطة الثابتة",
    )
    lookback_days = models.PositiveIntegerField(
        default=30, help_text="أيام الرجوع لحساب معدل الاستهلاك",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [["branch", "ingredient"]]

