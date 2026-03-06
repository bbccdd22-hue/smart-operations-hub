"""
Procurement Hub - نظام المشتريات والموردين.
سلسلة: طلب شراء → أمر شراء → استلام بضاعة → فاتورة مورد.
الربط المحاسبي: استحقاق للمورد عند الاستلام، تحديث المخزون تلقائياً.
"""
import hashlib
import secrets
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from config.constants import (
    SYSTEM_CODE_GOODS_RECEIPT,
    SYSTEM_CODE_PURCHASE_ORDER,
    SYSTEM_CODE_PURCHASE_REQUEST,
    SYSTEM_CODE_SUPPLIER,
    SYSTEM_CODE_SUPPLIER_INVOICE,
    SYSTEM_CODE_SUPPLIER_INVOICE_LINE,
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

    # ── Legacy plain-text key (kept for backward-compatibility; do NOT use for new keys) ──
    portal_api_key = models.CharField(
        max_length=64, blank=True, default="", db_index=True,
        help_text="مفتاح API القديم — نص صريح. استخدم api_key_hash للمفاتيح الجديدة.",
    )

    # ── Hashed API key (new, secure) ───────────────────────────────────────────
    api_key_hash = models.CharField(
        max_length=64, blank=True, default="", db_index=True,
        help_text="SHA-256 hash of the supplier portal API key. Never store the raw key.",
    )
    api_key_created_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the current hashed key was generated.",
    )
    api_key_revoked = models.BooleanField(
        default=False,
        help_text="Set True to immediately invalidate the supplier's portal access.",
    )

    class Meta:
        ordering = ["name"]
        unique_together = [["brand", "name"]]

    def __str__(self):
        return self.name

    # ── API key helpers ────────────────────────────────────────────────────────

    def generate_new_api_key(self) -> str:
        """
        Generates a secure random API key, stores only its SHA-256 hash,
        and returns the raw key so it can be shown to the supplier exactly once.

        Usage:
            raw_key = supplier.generate_new_api_key()
            # send raw_key to supplier securely — it is never stored again
        """
        raw_key = secrets.token_urlsafe(32)
        self.api_key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        self.api_key_created_at = timezone.now()
        self.api_key_revoked = False
        self.save(update_fields=["api_key_hash", "api_key_created_at", "api_key_revoked"])
        return raw_key

    def check_api_key(self, raw_key: str) -> bool:
        """
        Constant-time comparison of the incoming raw key against the stored hash.
        Returns False immediately if the key is revoked or no hash is stored.
        """
        if not raw_key or self.api_key_revoked or not self.api_key_hash:
            return False
        candidate_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        return secrets.compare_digest(candidate_hash, self.api_key_hash)

    def generate_api_key(self) -> str:
        """Alias for generate_new_api_key — yields raw key shown once only."""
        return self.generate_new_api_key()

    def verify_api_key(self, raw_key: str) -> bool:
        """Alias for check_api_key — timing-safe verification."""
        return self.check_api_key(raw_key)


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
    """فاتورة المورد - عند الترحيل: خصم من حساب المورد. تدعم سطور تفصيلية وضريبة."""
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
    total_amount = models.DecimalField(
        max_digits=14, decimal_places=2,
        help_text="إجمالي الفاتورة (معادل total_amount_incl_vat إن وُجد)",
    )
    # VAT and itemized totals (optional; when lines exist these are computed)
    subtotal_excl_vat = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True, default=Decimal("0.00"),
    )
    total_vat_amount = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True, default=Decimal("0.00"),
    )
    total_amount_incl_vat = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text="subtotal_excl_vat + total_vat_amount",
    )
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


class SupplierInvoiceLine(TimestampedModel):
    """سطر فاتورة المورد – صنف، كمية، وحدة، سعر، ضريبة."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_SUPPLIER_INVOICE_LINE, db_index=True,
    )
    invoice = models.ForeignKey(
        SupplierInvoice, on_delete=models.CASCADE, related_name="lines",
    )
    ingredient = models.ForeignKey(
        "inventory.Ingredient",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="supplier_invoice_lines",
    )
    description = models.CharField(max_length=255, blank=True, default="")
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit = models.ForeignKey(
        "inventory.Unit",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="supplier_invoice_lines",
    )
    unit_price_excl_vat = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0.00"))
    vat_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0.00"),
        help_text="نسبة الضريبة % (مثل 15)",
    )
    line_total_excl_vat = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    line_vat_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    line_total_incl_vat = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0.00"),
        help_text="line_total_excl_vat + line_vat_amount",
    )

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.invoice.invoice_number}: {self.description or (self.ingredient.name_en if self.ingredient else '')} x{self.quantity}"


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

