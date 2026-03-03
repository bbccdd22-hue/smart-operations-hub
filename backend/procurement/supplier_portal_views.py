"""
Supplier Portal API — للموردين
===============================
Public login (API key) + Dashboard (PO status, GR pending, Invoice upload)

POST /api/supplier-portal/auth/  → { api_key } → { supplier_id, supplier_name, brand_name }
GET  /api/supplier-portal/dashboard/  → Auth: X-Supplier-API-Key → { pos, grs_pending, invoices }
POST /api/procurement/supplier-portal/invoice/  → (existing) auto JournalEntry
"""
from __future__ import annotations

from decimal import Decimal
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Supplier, PurchaseOrder, GoodsReceipt, SupplierInvoice
from .services import get_supplier_by_api_key


def _get_supplier_from_request(request) -> Supplier | None:
    api_key = (
        request.headers.get("X-Supplier-API-Key")
        or (request.headers.get("Authorization") or "").replace("Bearer ", "").strip()
    )
    if not api_key:
        return None
    return get_supplier_by_api_key(api_key)


class SupplierPortalAuthView(APIView):
    """
    POST /api/supplier-portal/auth/
    body: { "api_key": "..." }
    returns: { supplier_id, supplier_name, brand_name } or 401
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    def post(self, request):
        api_key = (request.data or {}).get("api_key", "").strip()
        if not api_key:
            return Response({"detail": "api_key required"}, status=status.HTTP_400_BAD_REQUEST)
        supplier = get_supplier_by_api_key(api_key)
        if not supplier:
            return Response({"detail": "Invalid API key"}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({
            "supplier_id": supplier.pk,
            "supplier_name": supplier.name,
            "brand_name": supplier.brand.name,
        })


class SupplierPortalDashboardView(APIView):
    """
    GET /api/supplier-portal/dashboard/
    Auth: X-Supplier-API-Key or Authorization: Bearer <api_key>
    Returns: pos (purchase orders for this supplier), grs_pending, recent_invoices
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        supplier = _get_supplier_from_request(request)
        if not supplier:
            return Response(
                {"detail": "Invalid or missing API key. Use X-Supplier-API-Key header."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        pos = PurchaseOrder.objects.filter(supplier=supplier, status__in=["draft", "sent", "partially_received"]).order_by("-order_date")[:20]
        po_list = [{"id": p.pk, "order_number": p.order_number, "status": p.status, "order_date": str(p.order_date), "total": None} for p in pos]

        grs = GoodsReceipt.objects.filter(purchase_order__supplier=supplier, status="draft").select_related("purchase_order").order_by("-receipt_date")[:20]
        gr_list = [{"id": g.pk, "receipt_number": g.receipt_number, "po_number": g.purchase_order.order_number, "status": g.status, "receipt_date": str(g.receipt_date)} for g in grs]

        invoices = SupplierInvoice.objects.filter(supplier=supplier).order_by("-invoice_date")[:15]
        inv_list = [{"id": i.pk, "invoice_number": i.invoice_number, "invoice_date": str(i.invoice_date), "total_amount": str(i.total_amount), "status": getattr(i, "status", "posted")} for i in invoices]

        return Response({
            "supplier_id": supplier.pk,
            "supplier_name": supplier.name,
            "brand_name": supplier.brand.name,
            "purchase_orders": po_list,
            "goods_receipts_pending": gr_list,
            "recent_invoices": inv_list,
        })
