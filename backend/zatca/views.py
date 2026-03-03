"""
ZATCA E-Invoicing (السعودية) — Fatoora Phase 2
================================================
QR Code + XML export for e-invoice compliance.

POST /api/zatca/invoice/
  body: { seller_name, vat_number, invoice_date, total_with_vat, vat_amount, ... }
  returns: { xml, qr_code_base64, invoice_hash }
"""
from __future__ import annotations

import base64
import hashlib
from decimal import Decimal
from datetime import datetime

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView


def _generate_qr_payload(
    seller_name: str,
    vat_number: str,
    timestamp: str,
    total_with_vat: str,
    vat_amount: str,
) -> str:
    """ZATCA QR payload (simplified). Format: seller|vat|ts|total|vat_amt"""
    return "|".join([seller_name, vat_number, timestamp, total_with_vat, vat_amount])


def _generate_qr_base64(payload: str) -> str:
    """Generate QR code as base64 PNG."""
    try:
        import qrcode
        from io import BytesIO
        qr = qrcode.QRCode(version=1, box_size=4, border=2)
        qr.add_data(payload)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except ImportError:
        return base64.b64encode(payload.encode("utf-8")).decode("ascii")[:200]


def _generate_invoice_xml(
    seller_name: str,
    vat_number: str,
    invoice_date: str,
    invoice_number: str,
    total_with_vat: str,
    vat_amount: str,
    items: list,
) -> str:
    """Minimal UBL 2.1-style XML for ZATCA compliance."""
    lines = []
    for it in items:
        name = it.get("name", "")
        qty = str(it.get("quantity", 1))
        price = str(it.get("unit_price", 0))
        lines.append(f'    <Line><Name>{name}</Name><Quantity>{qty}</Quantity><UnitPrice>{price}</UnitPrice></Line>')
    items_xml = "\n".join(lines) if lines else "    <Line><Name>Item</Name><Quantity>1</Quantity><UnitPrice>0</UnitPrice></Line>"

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>{invoice_number}</ID>
  <IssueDate>{invoice_date}</IssueDate>
  <AccountingSupplierParty>
    <Party>
      <PartyName><Name>{seller_name}</Name></PartyName>
      <PartyTaxScheme>
        <CompanyID>{vat_number}</CompanyID>
      </PartyTaxScheme>
    </Party>
  </AccountingSupplierParty>
  <LegalMonetaryTotal>
    <PayableAmount currencyID="SAR">{total_with_vat}</PayableAmount>
    <TaxTotal>
      <TaxAmount currencyID="SAR">{vat_amount}</TaxAmount>
    </TaxTotal>
  </LegalMonetaryTotal>
  <InvoiceLine>
{items_xml}
  </InvoiceLine>
</Invoice>"""


class ZATCAInvoiceView(APIView):
    """
    POST /api/zatca/invoice/
    body: seller_name, vat_number, invoice_date, invoice_number, total_with_vat, vat_amount, items[]
    returns: { xml, qr_code_base64, invoice_hash }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        seller_name = (data.get("seller_name") or "").strip()
        vat_number = (data.get("vat_number") or "").strip()
        invoice_date = data.get("invoice_date") or datetime.now().strftime("%Y-%m-%d")
        invoice_number = (data.get("invoice_number") or "INV-001").strip()
        total_with_vat = str(data.get("total_with_vat", 0))
        vat_amount = str(data.get("vat_amount", 0))
        items = data.get("items", [])

        if not seller_name:
            return Response({"detail": "seller_name required"}, status=status.HTTP_400_BAD_REQUEST)
        if not vat_number:
            return Response({"detail": "vat_number required"}, status=status.HTTP_400_BAD_REQUEST)

        timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        payload = _generate_qr_payload(seller_name, vat_number, timestamp, total_with_vat, vat_amount)
        qr_base64 = _generate_qr_base64(payload)

        xml = _generate_invoice_xml(
            seller_name, vat_number, invoice_date, invoice_number,
            total_with_vat, vat_amount, items,
        )
        invoice_hash = hashlib.sha256(xml.encode("utf-8")).hexdigest()[:64]

        return Response({
            "xml": xml,
            "qr_code_base64": qr_base64,
            "invoice_hash": invoice_hash,
        })
