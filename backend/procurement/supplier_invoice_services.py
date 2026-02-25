"""
بوابة الموردين – تسجيل الفواتير آلياً في الحسابات الدائنة.
- فاتورة مرتبطة بـ GR: تم الاستحقاق عند التأكيد، نكتفي بربط الفاتورة وتحديث الحالة.
- فاتورة قائمة بذاتها: قيد مدين مصروف/مخزون، دائن الموردين.
"""
from decimal import Decimal

from django.db import transaction

from accounting.models import ChartAccount, JournalEntry, JournalEntryLine, JournalEntrySource
from procurement.models import SupplierInvoice, SupplierInvoiceStatus


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

        # فاتورة قائمة – قيد جديد
        payables = _get_payables_account()
        expense = _get_expense_account()

        je = JournalEntry.objects.create(
            entry_date=invoice.invoice_date,
            description=f"فاتورة مورد {invoice.invoice_number} - {invoice.supplier.name}",
            source_type=JournalEntrySource.SUPPLIER_INVOICE,
            branch=invoice.branch,
        )
        JournalEntryLine.objects.create(
            journal_entry=je,
            account=expense,
            account_code=expense.code,
            account_name_ar=expense.name_ar,
            debit_amount=invoice.total_amount,
            credit_amount=Decimal("0"),
        )
        JournalEntryLine.objects.create(
            journal_entry=je,
            account=payables,
            account_code=payables.code,
            account_name_ar=payables.name_ar,
            debit_amount=Decimal("0"),
            credit_amount=invoice.total_amount,
        )

        invoice.journal_entry = je
        invoice.status = SupplierInvoiceStatus.POSTED
        invoice.save(update_fields=["journal_entry", "status"])

        return je
