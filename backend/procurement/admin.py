from django.contrib import admin
from .models import Supplier, PurchaseRequest, PurchaseOrder, GoodsReceipt, SupplierInvoice


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "brand", "is_active")
    list_filter = ("brand", "is_active")


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ("request_number", "branch", "status", "requested_at")
    list_filter = ("status", "branch__brand")


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "supplier", "branch", "status", "order_date")
    list_filter = ("status", "branch__brand")


@admin.register(GoodsReceipt)
class GoodsReceiptAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "purchase_order", "receipt_date", "status")
    list_filter = ("status",)


@admin.register(SupplierInvoice)
class SupplierInvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "supplier", "branch", "total_amount", "status")
    list_filter = ("status",)
