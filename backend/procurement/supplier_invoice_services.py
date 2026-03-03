"""
بوابة الموردين – تسجيل الفواتير آلياً في الحسابات الدائنة.
- فاتورة مرتبطة بـ GR: تم الاستحقاق عند التأكيد، نكتفي بربط الفاتورة وتحديث الحالة.
- فاتورة قائمة بذاتها: قيد مدين مصروف/مخزون، دائن الموردين.
- أبعاد القيد: branch, brand, reference_type, reference_id (Step 1 multi-dimensional accounting).
"""
from decimal import Decimal

from django.db import transaction

from accounting.models import ChartAccount, JournalEntry, JournalEntryLine, JournalEntrySource
from procurement.models import SupplierInvoice, SupplierInvoiceStatus, SupplierInvoiceLine


def create_purchase_invoice(
    *,
    supplier_id: int,
    branch_id: int,
    invoice_number: str,
    invoice_date,
    notes: str = "",
    goods_receipt_id=None,
    lines: list,
) -> SupplierInvoice:
    """
    إنشاء فاتورة مورد مع سطورها في transaction واحدة.
    lines: list of dicts with keys: ingredient_id (optional), description, quantity, unit_id (optional),
           unit_price_excl_vat, vat_rate (default 0).
    يحسب لكل سطر: line_total_excl_vat, line_vat_amount, line_total_incl_vat
    ويجمع على الفاتورة: subtotal_excl_vat, total_vat_amount, total_amount_incl_vat, total_amount.
    """
    from org.models import Branch
    from procurement.models import Supplier, GoodsReceipt

    supplier = Supplier.objects.get(pk=supplier_id)
    branch = Branch.objects.get(pk=branch_id)
    goods_receipt = None
    if goods_receipt_id:
        goods_receipt = GoodsReceipt.objects.filter(
            pk=goods_receipt_id,
            purchase_order__supplier=supplier,
        ).first()

    subtotal_excl_vat = Decimal("0.00")
    total_vat_amount = Decimal("0.00")

    with transaction.atomic():
        inv = SupplierInvoice.objects.create(
            supplier=supplier,
            branch=branch,
            goods_receipt=goods_receipt,
            invoice_number=invoice_number.strip(),
            invoice_date=invoice_date,
            total_amount=Decimal("0.00"),  # updated below
            subtotal_excl_vat=Decimal("0.00"),
            total_vat_amount=Decimal("0.00"),
            total_amount_incl_vat=None,
            status=SupplierInvoiceStatus.DRAFT,
            notes=(notes or "").strip(),
        )

        for row in lines:
            qty = Decimal(str(row.get("quantity", 0)))
            unit_price = Decimal(str(row.get("unit_price_excl_vat", 0)))
            vat_rate = Decimal(str(row.get("vat_rate", 0)))
            line_excl = (qty * unit_price).quantize(Decimal("0.01"))
            line_vat = (line_excl * vat_rate / 100).quantize(Decimal("0.01"))
            line_incl = (line_excl + line_vat).quantize(Decimal("0.01"))

            subtotal_excl_vat += line_excl
            total_vat_amount += line_vat

            ingredient_id = row.get("ingredient_id")
            unit_id = row.get("unit_id")
            description = (row.get("description") or "").strip()

            SupplierInvoiceLine.objects.create(
                invoice=inv,
                ingredient_id=ingredient_id or None,
                description=description,
                quantity=qty,
                unit_id=unit_id or None,
                unit_price_excl_vat=unit_price,
                vat_rate=vat_rate,
                line_total_excl_vat=line_excl,
                line_vat_amount=line_vat,
                line_total_incl_vat=line_incl,
            )

        total_incl_vat = (subtotal_excl_vat + total_vat_amount).quantize(Decimal("0.01"))
        inv.subtotal_excl_vat = subtotal_excl_vat
        inv.total_vat_amount = total_vat_amount
        inv.total_amount_incl_vat = total_incl_vat
        inv.total_amount = total_incl_vat
        inv.save(update_fields=["subtotal_excl_vat", "total_vat_amount", "total_amount_incl_vat", "total_amount"])

    return inv


def _get_payables_account() -> ChartAccount:
    """حساب الموردين - 02101 (موردين تجاريين)."""
    acc = (
        ChartAccount.objects.filter(code="02101", is_active=True).first()
        or ChartAccount.objects.filter(code__startswith="02101", is_active=True).order_by("code").first()
        or ChartAccount.objects.filter(code__startswith="021", is_active=True).order_by("code").first()
    )
    if not acc:
        raise ValueError("لا يوجد حساب موردين (02101) في دليل الحسابات")
    return acc


def _get_expense_account() -> ChartAccount:
    """حساب مصروف افتراضي للفواتير غير المرتبطة باستلام."""
    for prefix in ("051", "05"):
        acc = ChartAccount.objects.filter(code__startswith=prefix, is_active=True).first()
        if acc:
            return acc
    raise ValueError("لا يوجد حساب مصروفات (05xxx) في دليل الحسابات")


def post_supplier_invoice(invoice: SupplierInvoice) -> JournalEntry:
    """
    ترحيل فاتورة المورد إلى الحسابات الدائنة.
    - إذا مرتبطة بـ GR: الربط تم عند الاستلام، نحدّث الحالة فقط (لا قيد جديد).
    - إذا قائمة بذاتها: قيد مدين مصروف، دائن الموردين.
    """
    if invoice.status == SupplierInvoiceStatus.POSTED and invoice.journal_entry_id:
        return invoice.journal_entry

    with transaction.atomic():
        if invoice.goods_receipt_id:
            # الاستحقاق تم في confirm_goods_receipt – نربط الفاتورة فقط
            invoice.status = SupplierInvoiceStatus.POSTED
            invoice.save(update_fields=["status"])
            return invoice.journal_entry or invoice.goods_receipt.journal_entry

        # فاتورة قائمة – قيد جديد مع أبعاد (branch, brand, reference)
        payables = _get_payables_account()
        expense = _get_expense_account()

        amount = invoice.total_amount_incl_vat if invoice.total_amount_incl_vat is not None else invoice.total_amount

        je = JournalEntry.objects.create(
            entry_date=invoice.invoice_date,
            description=f"فاتورة مورد {invoice.invoice_number} - {invoice.supplier.name}",
            source_type=JournalEntrySource.SUPPLIER_INVOICE,
            branch=invoice.branch,
        )
        # مدين مصروف/مخزون – مع أبعاد للتقارير
        JournalEntryLine.objects.create(
            journal_entry=je,
            account=expense,
            account_code=expense.code,
            account_name_ar=expense.name_ar,
            debit_amount=amount,
            credit_amount=Decimal("0"),
            branch=invoice.branch,
            brand=invoice.supplier.brand,
            reference_type="purchase_invoice",
            reference_id=invoice.invoice_number,
        )
        # دائن الموردين
        JournalEntryLine.objects.create(
            journal_entry=je,
            account=payables,
            account_code=payables.code,
            account_name_ar=payables.name_ar,
            debit_amount=Decimal("0"),
            credit_amount=amount,
            branch=invoice.branch,
            brand=invoice.supplier.brand,
            reference_type="purchase_invoice",
            reference_id=invoice.invoice_number,
        )

        invoice.journal_entry = je
        invoice.status = SupplierInvoiceStatus.POSTED
        invoice.save(update_fields=["journal_entry", "status"])

        return je
