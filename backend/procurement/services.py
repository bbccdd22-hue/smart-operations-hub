"""
Procurement Services - الربط المحاسبي والمخزني.
عند تأكيد الاستلام: استحقاق للمورد + تحديث المخزون.
"""
from decimal import Decimal

from django.conf import settings
from django.db import transaction

from accounting.models import ChartAccount, JournalEntry, JournalEntryLine
from accounting.models import JournalEntrySource
from inventory.models import BranchStock, StockMovement, StockMovementType


def confirm_goods_receipt(goods_receipt) -> JournalEntry:
    """
    تأكيد استلام البضاعة:
    1. قيد محاسبي: من ح/المخزون (مدين)، إلى ح/الموردين-استحقاق (دائن)
    2. تحديث BranchStock و StockMovement
    """
    with transaction.atomic():
        branch = goods_receipt.purchase_order.branch
        supplier = goods_receipt.purchase_order.supplier
        total_amount = Decimal("0.00")

        for line in goods_receipt.lines.select_related("order_line__ingredient", "order_line__unit"):
            qty = line.quantity_received
            price = line.order_line.unit_price
            line_total = qty * price
            total_amount += line_total

            # تحديث المخزون
            ingredient = line.order_line.ingredient
            stock, _ = BranchStock.objects.get_or_create(
                branch=branch,
                ingredient=ingredient,
                defaults={"on_hand": Decimal("0"), "reorder_level": Decimal("0")},
            )
            stock.on_hand += qty
            stock.save(update_fields=["on_hand"])

            # سجل حركة
            StockMovement.objects.create(
                branch=branch,
                ingredient=ingredient,
                movement_type=StockMovementType.PURCHASE,
                qty_delta=qty,
                reference=f"GR-{goods_receipt.receipt_number}",
            )

        # قيد محاسبي - استحقاق
        # نحتاج حسابات: المخزون (مدين)، الموردين (دائن)
        inv_account = ChartAccount.objects.filter(code__startswith="12").first()
        payables_account = ChartAccount.objects.filter(code__startswith="21").first()
        if not inv_account or not payables_account:
            raise ValueError("تأكد من وجود حسابات المخزون (12xx) وحساب الموردين (21xx) في دليل الحسابات")

        je = JournalEntry.objects.create(
            entry_date=goods_receipt.receipt_date,
            description=f"استلام بضاعة GR-{goods_receipt.receipt_number} من {supplier.name}",
            source_type=JournalEntrySource.GOODS_RECEIPT,
            branch=branch,
        )
        JournalEntryLine.objects.create(
            journal_entry=je,
            account=inv_account,
            account_code=inv_account.code,
            account_name_ar=inv_account.name_ar,
            debit_amount=total_amount,
            credit_amount=Decimal("0"),
        )
        JournalEntryLine.objects.create(
            journal_entry=je,
            account=payables_account,
            account_code=payables_account.code,
            account_name_ar=payables_account.name_ar,
            debit_amount=Decimal("0"),
            credit_amount=total_amount,
        )

        from procurement.models import GoodsReceiptStatus

        goods_receipt.journal_entry = je
        goods_receipt.status = GoodsReceiptStatus.CONFIRMED
        goods_receipt.save(update_fields=["journal_entry", "status"])

        return je
