"""
Procurement Services - الربط المحاسبي والمخزني.
عند تأكيد الاستلام: استحقاق للمورد + تحديث المخزون.
"""
import hashlib
from decimal import Decimal
from datetime import date

from django.conf import settings
from django.db import transaction
from django.db.models import Max

from accounting.models import ChartAccount, JournalEntry, JournalEntryLine
from accounting.models import JournalEntrySource
from inventory.models import BranchStock, StockMovement, StockMovementType


def generate_next_receipt_number() -> str:
    """Generate next unique GR receipt number: GR-YYYY-NNNN."""
    from .models import GoodsReceipt
    prefix = f"GR-{date.today().year}-"
    qs = GoodsReceipt.objects.filter(receipt_number__startswith=prefix)
    max_num = qs.aggregate(m=Max("receipt_number"))["m"]
    if not max_num or not max_num.replace(prefix, "").isdigit():
        return f"{prefix}0001"
    try:
        num = int(max_num.replace(prefix, "")) + 1
        return f"{prefix}{num:04d}"
    except (ValueError, TypeError):
        return f"{prefix}0001"


def get_supplier_by_api_key(raw_key: str):
    """
    Lookup a Supplier by hashed API key.

    1. Computes SHA-256 of the incoming raw key.
    2. Fetches the Supplier whose api_key_hash matches (indexed lookup — O(1)).
    3. Falls back to the old plaintext portal_api_key for backward-compatibility
       until all suppliers have been migrated to the new key format.

    Returns the Supplier instance (with brand select_related) or None.
    """
    from .models import Supplier  # local import to avoid circular

    if not raw_key:
        return None

    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    # Try new hashed lookup first
    supplier = Supplier.objects.filter(
        api_key_hash=key_hash,
        is_active=True,
        api_key_revoked=False,
    ).select_related("brand").first()

    if supplier:
        return supplier

    # Backward-compat: check old plaintext field (legacy suppliers not yet rotated)
    return Supplier.objects.filter(
        portal_api_key=raw_key,
        is_active=True,
    ).select_related("brand").first()


def confirm_goods_receipt(goods_receipt) -> JournalEntry:
    """
    تأكيد استلام البضاعة:
    1. قيد محاسبي: من ح/المخزون (مدين)، إلى ح/الموردين-استحقاق (دائن)
    2. تحديث BranchStock و StockMovement (PURCHASE)
    3. أبعاد القيد: branch, brand, reference_type, reference_id (مثل الفواتير)
    """
    with transaction.atomic():
        branch = goods_receipt.purchase_order.branch
        supplier = goods_receipt.purchase_order.supplier
        brand = branch.brand
        ref_id = goods_receipt.receipt_number
        total_amount = Decimal("0.00")

        for line in goods_receipt.lines.select_related("order_line__ingredient", "order_line__unit"):
            qty = line.quantity_received
            if qty <= 0:
                continue
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

            # سجل حركة (PURCHASE)
            StockMovement.objects.create(
                branch=branch,
                ingredient=ingredient,
                movement_type=StockMovementType.PURCHASE,
                qty_delta=qty,
                reference=f"GR-{ref_id}",
            )

        # قيد محاسبي - استحقاق مع أبعاد (Branch, Brand, Reference)
        inv_account = ChartAccount.objects.filter(code__startswith="12").first()
        payables_account = ChartAccount.objects.filter(code__startswith="21").first()
        if not inv_account or not payables_account:
            raise ValueError("تأكد من وجود حسابات المخزون (12xx) وحساب الموردين (21xx) في دليل الحسابات")

        je = JournalEntry.objects.create(
            entry_date=goods_receipt.receipt_date,
            description=f"استلام بضاعة GR-{ref_id} من {supplier.name}",
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
            branch=branch,
            brand=brand,
            reference_type="goods_receipt",
            reference_id=ref_id,
        )
        JournalEntryLine.objects.create(
            journal_entry=je,
            account=payables_account,
            account_code=payables_account.code,
            account_name_ar=payables_account.name_ar,
            debit_amount=Decimal("0"),
            credit_amount=total_amount,
            branch=branch,
            brand=brand,
            reference_type="goods_receipt",
            reference_id=ref_id,
        )

        from procurement.models import GoodsReceiptStatus

        goods_receipt.journal_entry = je
        goods_receipt.status = GoodsReceiptStatus.CONFIRMED
        goods_receipt.save(update_fields=["journal_entry", "status"])

        return je
