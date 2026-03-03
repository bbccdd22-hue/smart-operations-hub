"""
Procurement serializers - Supplier, Purchase Order, Supplier Invoice, etc.
"""
from decimal import Decimal

from rest_framework import serializers

from procurement.models import (
    Supplier,
    SupplierInvoice,
    SupplierInvoiceLine,
    GoodsReceipt,
    GoodsReceiptLine,
    PurchaseOrder,
    PurchaseOrderLine,
)


class SupplierInvoiceLineSerializer(serializers.ModelSerializer):
    """سطر فاتورة المورد – للقراءة والكتابة."""

    class Meta:
        model = SupplierInvoiceLine
        fields = [
            "id",
            "ingredient",
            "description",
            "quantity",
            "unit",
            "unit_price_excl_vat",
            "vat_rate",
            "line_total_excl_vat",
            "line_vat_amount",
            "line_total_incl_vat",
        ]
        read_only_fields = ["line_total_excl_vat", "line_vat_amount", "line_total_incl_vat"]


class SupplierInvoiceLineCreateSerializer(serializers.Serializer):
    """لإنشاء سطر فاتورة – يقبل ingredient_id أو description، وكمية وسعر وضريبة."""
    ingredient_id = serializers.IntegerField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    quantity = serializers.DecimalField(max_digits=14, decimal_places=4)
    unit_id = serializers.IntegerField(required=False, allow_null=True)
    unit_price_excl_vat = serializers.DecimalField(max_digits=14, decimal_places=4)
    vat_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))


class SupplierSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    brand_slug = serializers.CharField(source="brand.slug", read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id",
            "brand",
            "brand_name",
            "brand_slug",
            "name",
            "name_ar",
            "tax_number",
            "contact_email",
            "contact_phone",
            "address",
            "credit_days",
            "payment_terms",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class SupplierInvoiceSerializer(serializers.ModelSerializer):
    """فاتورة المورد مع السطور – للقراءة."""
    lines = SupplierInvoiceLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = SupplierInvoice
        fields = [
            "id",
            "supplier",
            "supplier_name",
            "branch",
            "branch_name",
            "goods_receipt",
            "invoice_number",
            "invoice_date",
            "total_amount",
            "subtotal_excl_vat",
            "total_vat_amount",
            "total_amount_incl_vat",
            "status",
            "journal_entry",
            "notes",
            "lines",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class SupplierInvoiceCreateSerializer(serializers.Serializer):
    """إنشاء فاتورة مورد مع سطور."""
    supplier_id = serializers.IntegerField()
    branch_id = serializers.IntegerField()
    invoice_number = serializers.CharField(max_length=64)
    invoice_date = serializers.DateField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    goods_receipt_id = serializers.IntegerField(required=False, allow_null=True)
    lines = SupplierInvoiceLineCreateSerializer(many=True)


# ─── Goods Receipt (GRN) ───────────────────────────────────────────────────

class GoodsReceiptLineReadSerializer(serializers.ModelSerializer):
    """سطر استلام – للقراءة."""
    order_line_id = serializers.IntegerField(source="order_line_id", read_only=True)
    ingredient_id = serializers.IntegerField(source="order_line.ingredient_id", read_only=True)
    ingredient_name = serializers.CharField(source="order_line.ingredient.name_en", read_only=True)
    ingredient_name_ar = serializers.CharField(source="order_line.ingredient.name_ar", read_only=True)
    unit_code = serializers.CharField(source="order_line.unit.code", read_only=True)
    order_quantity = serializers.DecimalField(
        max_digits=14, decimal_places=4, source="order_line.quantity", read_only=True
    )
    unit_price = serializers.DecimalField(
        max_digits=14, decimal_places=4, source="order_line.unit_price", read_only=True
    )

    class Meta:
        model = GoodsReceiptLine
        fields = [
            "id",
            "order_line_id",
            "order_line",
            "ingredient_id",
            "ingredient_name",
            "ingredient_name_ar",
            "unit_code",
            "order_quantity",
            "quantity_received",
            "unit_price",
        ]


class GoodsReceiptSerializer(serializers.ModelSerializer):
    """استلام بضاعة – للقراءة مع السطور والربط بالفاتورة."""
    lines = GoodsReceiptLineReadSerializer(many=True, read_only=True)
    purchase_order_number = serializers.CharField(
        source="purchase_order.order_number", read_only=True
    )
    supplier_id = serializers.IntegerField(source="purchase_order.supplier_id", read_only=True)
    supplier_name = serializers.CharField(
        source="purchase_order.supplier.name", read_only=True
    )
    supplier_name_ar = serializers.CharField(
        source="purchase_order.supplier.name_ar", read_only=True, allow_blank=True
    )
    branch_id = serializers.IntegerField(source="purchase_order.branch_id", read_only=True)
    branch_name = serializers.CharField(
        source="purchase_order.branch.name", read_only=True
    )
    invoice_ids = serializers.SerializerMethodField()

    class Meta:
        model = GoodsReceipt
        fields = [
            "id",
            "purchase_order",
            "purchase_order_number",
            "supplier_id",
            "supplier_name",
            "supplier_name_ar",
            "branch_id",
            "branch_name",
            "receipt_number",
            "receipt_date",
            "status",
            "journal_entry",
            "notes",
            "lines",
            "invoice_ids",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["receipt_number", "status", "journal_entry", "created_at", "updated_at"]

    def get_invoice_ids(self, obj):
        return list(
            obj.invoices.values_list("id", flat=True)
        )


class GoodsReceiptLineCreateSerializer(serializers.Serializer):
    """سطر عند إنشاء استلام – order_line_id وكمية مستلمة."""
    order_line_id = serializers.IntegerField()
    quantity_received = serializers.DecimalField(max_digits=14, decimal_places=4, min_value=Decimal("0"))


class GoodsReceiptCreateSerializer(serializers.Serializer):
    """إنشاء استلام بضاعة من أمر شراء."""
    purchase_order_id = serializers.IntegerField()
    receipt_date = serializers.DateField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    lines = GoodsReceiptLineCreateSerializer(many=True)
