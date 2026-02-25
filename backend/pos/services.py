"""
POS Services - الربط بالمخزون والمحاسبة.
"""
from decimal import Decimal

from django.db import transaction

from inventory.depletion_services import _get_or_create_branch_stock_locked
from inventory.models import BranchStock, StockMovement, StockMovementType
from inventory.services import explode_recipe_requirements


def _process_modifier_depletion(branch_id: int, modifier_id: int, qty_per_item: int, ref_prefix: str) -> tuple[int, list]:
    """
    خصم مخزون المكوّن المرتبط بالمُعدّل (إضافة حليب، إلخ).
    Returns (movements_created, errors).
    """
    from pos.models import ProductModifier

    try:
        mod = ProductModifier.objects.select_related("ingredient").get(pk=modifier_id)
    except ProductModifier.DoesNotExist:
        return 0, []
    if not mod.ingredient_id:
        return 0, []

    qty_deplete = float(mod.qty_per_use or 1) * qty_per_item
    if qty_deplete <= 0:
        return 0, []

    ingredient_id = mod.ingredient_id
    stock = _get_or_create_branch_stock_locked(branch_id, ingredient_id)
    delta = -qty_deplete
    ref = f"{ref_prefix}mod_b{branch_id}_i{ingredient_id}"

    StockMovement.objects.create(
        branch_id=branch_id,
        ingredient_id=ingredient_id,
        movement_type=StockMovementType.DEPLETION,
        qty_delta=delta,
        reference=ref[:128],
    )
    new_on_hand = stock.on_hand + delta
    errors = []
    if new_on_hand < 0:
        errors.append(f"مخزون سالب: {mod.ingredient.name_en} (كان {stock.on_hand}، الخصم {qty_deplete})")
    stock.on_hand = new_on_hand
    stock.save(update_fields=["on_hand"])
    return 1, errors


def process_pos_depletion(
    branch_id: int,
    sku_to_qty: dict[str, int],
    items_with_modifiers: list | None = None,
) -> dict:
    """
    خصم المخزون لمعاملة POS.
    sku_to_qty: { foodics_product_id: qty }
    items_with_modifiers: [{ product_sku, qty, modifiers: [{ modifier_id }] }] - للخصم الإضافي
    Returns: { movements_created, errors }
    """
    errors = []
    movements_created = 0
    ref_prefix = "pos_sale_"

    if not sku_to_qty and not items_with_modifiers:
        return {"movements_created": 0, "errors": []}

    with transaction.atomic():
        if sku_to_qty:
            reqs = explode_recipe_requirements(sku_to_qty)
            for req in (reqs or []):
                qty_deplete = req.qty
                if qty_deplete <= 0:
                    continue
                stock = _get_or_create_branch_stock_locked(branch_id, req.ingredient_id)
                delta = -qty_deplete
                ref = f"{ref_prefix}b{branch_id}_i{req.ingredient_id}"
                StockMovement.objects.create(
                    branch_id=branch_id,
                    ingredient_id=req.ingredient_id,
                    movement_type=StockMovementType.DEPLETION,
                    qty_delta=delta,
                    reference=ref[:128],
                )
                movements_created += 1
                new_on_hand = stock.on_hand + delta
                if new_on_hand < 0:
                    err_msg = f"مخزون سالب: {req.ingredient_name} (كان {stock.on_hand}، الخصم {qty_deplete})"
                    errors.append(err_msg)
                stock.on_hand = new_on_hand
                stock.save(update_fields=["on_hand"])

        if items_with_modifiers:
            for it in items_with_modifiers:
                mods = it.get("modifiers") or []
                qty_per = int(float(it.get("qty") or 1))
                for m in mods:
                    mid = m.get("modifier_id") if isinstance(m, dict) else getattr(m, "id", None)
                    if not mid:
                        continue
                    mc, errs = _process_modifier_depletion(branch_id, int(mid), qty_per, ref_prefix)
                    movements_created += mc
                    errors.extend(errs)

    return {"movements_created": movements_created, "errors": errors}


def _debit_code_for_method(method: str) -> tuple[str, str]:
    cash_code, bank_code = "011011102", "011012"
    if method == "cash":
        return cash_code, "نقدية - الفروع"
    if method == "wallet":
        return "01301", "محفظة عملاء"
    return bank_code, "البنوك"


def create_pos_journal_entry(
    sale, branch, total_amount: Decimal, payment_method: str, split_payments: list | None = None,
):
    """
    إنشاء قيد محاسبي لمعاملة POS.
    عند split_payments: ينشئ سطر مدين لكل طريقة دفع.
    """
    from accounting.models import ChartAccount, JournalEntry, JournalEntryLine, JournalEntrySource

    revenue_code = "04101"
    credit_account = ChartAccount.objects.filter(code=revenue_code).first()
    if not credit_account:
        credit_account = ChartAccount.objects.filter(code__startswith="04").first()
    if not credit_account:
        return None

    je = JournalEntry.objects.create(
        entry_date=sale.created_at.date(),
        description=f"بيع POS {sale.sale_number}",
        source_type=JournalEntrySource.POS_SALE,
        branch=branch,
    )

    if split_payments:
        for sp in split_payments:
            amt = Decimal(str(sp.get("amount") or 0))
            if amt <= 0:
                continue
            method = sp.get("method") or "cash"
            debit_code, _ = _debit_code_for_method(method)
            debit_account = ChartAccount.objects.filter(code=debit_code).first()
            if not debit_account:
                debit_account = ChartAccount.objects.filter(code__startswith="011").first()
            if debit_account:
                JournalEntryLine.objects.create(
                    journal_entry=je,
                    account=debit_account,
                    account_code=debit_account.code,
                    account_name_ar=debit_account.name_ar,
                    debit_amount=amt,
                    credit_amount=Decimal("0"),
                )
    else:
        debit_code, _ = _debit_code_for_method(payment_method)
        debit_account = ChartAccount.objects.filter(code=debit_code).first()
        if not debit_account:
            debit_account = ChartAccount.objects.filter(code__startswith="011").first()
        if debit_account:
            JournalEntryLine.objects.create(
                journal_entry=je,
                account=debit_account,
                account_code=debit_account.code,
                account_name_ar=debit_account.name_ar,
                debit_amount=total_amount,
                credit_amount=Decimal("0"),
            )

    JournalEntryLine.objects.create(
        journal_entry=je,
        account=credit_account,
        account_code=credit_account.code,
        account_name_ar=credit_account.name_ar,
        debit_amount=Decimal("0"),
        credit_amount=total_amount,
    )
    return je
