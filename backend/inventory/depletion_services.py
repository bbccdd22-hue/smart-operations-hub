"""
خصم المخزون التلقائي – عند رفع تقرير مبيعات المنتجات (ProductSale).
يربط المنتجات المباعة بالمكونات عبر الوصفات، وينشئ حركات مخزنية Depletion.
استخدام select_for_update لضمان عدم تضارب الكميات عند العمليات المتزامنة.
"""
from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.db.utils import IntegrityError

from inventory.models import BranchStock, StockMovement, StockMovementType
from inventory.services import explode_recipe_requirements


def _get_or_create_branch_stock_locked(branch_id: int, ingredient_id: int):
    """
    الحصول على BranchStock بقفل الصف (select_for_update) لمنع Race Conditions.
    """
    try:
        return BranchStock.objects.select_for_update().get(
            branch_id=branch_id,
            ingredient_id=ingredient_id,
        )
    except BranchStock.DoesNotExist:
        try:
            return BranchStock.objects.create(
                branch_id=branch_id,
                ingredient_id=ingredient_id,
                on_hand=Decimal("0"),
            )
        except IntegrityError:
            return BranchStock.objects.select_for_update().get(
                branch_id=branch_id,
                ingredient_id=ingredient_id,
            )


def process_product_sale_depletion(upload) -> dict:
    """
    بعد رفع Product Sales: يحسب المكونات المستهلكة من الوصفات،
    وينشئ StockMovement(depletion) ويحدّث BranchStock.on_hand.

    Returns: { movements_created: int, branches_processed: set, errors: list }
    """
    from imports.models import ProductSale
    from analytics.report_data_sources import PRODUCT_SALE_EXCLUDE_SUMMARY

    qs = ProductSale.objects.filter(upload=upload).exclude(PRODUCT_SALE_EXCLUDE_SUMMARY)
    if not qs.exists():
        return {"movements_created": 0, "branches_processed": set(), "errors": []}

    # تجميع: (branch_id) -> { product_sku -> sum(qty) }
    by_branch: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in qs.values("branch_id", "product_sku", "qty"):
        bid = r.get("branch_id")
        sku = (r.get("product_sku") or "").strip()
        if not bid or not sku:
            continue
        try:
            qty = int(float(r.get("qty") or 0))
        except (TypeError, ValueError):
            qty = 0
        if qty > 0:
            by_branch[bid][sku] += qty

    if not by_branch:
        return {"movements_created": 0, "branches_processed": set(), "errors": []}

    # عدم تكرار المعالجة لنفس الرفع
    ref_prefix = f"product_sale_upload_{upload.id}_"
    if StockMovement.objects.filter(
        movement_type=StockMovementType.DEPLETION,
        reference__startswith=ref_prefix,
    ).exists():
        return {"movements_created": 0, "branches_processed": set(), "errors": ["Already processed"]}

    errors = []
    movements_created = 0
    branches_processed = set()

    with transaction.atomic():
        for branch_id, sku_to_qty in by_branch.items():
            if not sku_to_qty:
                continue

            # ── Double-depletion guard ────────────────────────────────────────
            # If this branch already uses POS real-time depletion, skip Excel
            # depletion to avoid counting the same sales twice.
            try:
                from org.models import Branch as _Branch
                _branch_obj = _Branch.objects.filter(pk=branch_id).only("pos_depletion_enabled").first()
                if _branch_obj and getattr(_branch_obj, "pos_depletion_enabled", False):
                    errors.append(
                        f"Branch {branch_id}: Excel depletion skipped "
                        f"(POS real-time depletion is enabled for this branch)."
                    )
                    continue
            except Exception:  # noqa: BLE001
                pass

            reqs = explode_recipe_requirements(dict(sku_to_qty))
            if not reqs:
                continue

            branches_processed.add(branch_id)

            for req in reqs:
                qty_deplete = req.qty
                if qty_deplete <= 0:
                    continue

                stock = _get_or_create_branch_stock_locked(branch_id, req.ingredient_id)

                # الخصم: qty_delta سالب
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

                new_on_hand = stock.on_hand + delta  # delta سالب – نسمح بالسالب لاكتشاف العجز
                if new_on_hand < 0:
                    err_msg = (
                        f"مخزون سالب: {req.ingredient_name} بفرع {branch_id} "
                        f"(كان {stock.on_hand}، الخصم {qty_deplete})"
                    )
                    errors.append(err_msg)
                    try:
                        from core.error_logging import log_system_error
                        log_system_error(
                            "depletion_failed",
                            err_msg,
                            context={"branch_id": branch_id, "ingredient_id": req.ingredient_id, "on_hand_before": str(stock.on_hand), "qty_depleted": str(qty_deplete), "upload_id": getattr(upload, "id", None)},
                        )
                    except Exception:  # noqa: BLE001
                        pass
                    try:
                        from django.contrib.auth import get_user_model
                        from org.models import AdminNotification
                        saif = get_user_model().objects.filter(username="SAIF").first()
                        if saif:
                            AdminNotification.objects.create(
                                user=saif,
                                event_type="negative_stock",
                                title="تنبيه: رصيد سالب",
                                message=err_msg,
                            )
                    except Exception:  # noqa: BLE001
                        pass
                stock.on_hand = new_on_hand
                stock.save(update_fields=["on_hand"])

    return {
        "movements_created": movements_created,
        "branches_processed": branches_processed,
        "errors": errors,
    }


def deplete_from_pos_sale(sale) -> list[str]:
    """
    Deplete inventory for a single POS SaleTransaction.

    Called automatically via post_save signal when:
      - settings.POS_REALTIME_DEPLETION_ENABLED is True
      - sale.branch.pos_depletion_enabled is True

    Returns a list of warning/error messages (empty means clean run).
    Reuses the same locked BranchStock path as Excel depletion for consistency.

    items format: [{product_sku, qty, ...}, ...]
    """
    from django.conf import settings

    warnings: list[str] = []

    # Guard: branch-level flag
    branch = getattr(sale, "branch", None)
    if branch is None or not getattr(branch, "pos_depletion_enabled", False):
        return []

    # Guard: global feature flag
    if not getattr(settings, "POS_REALTIME_DEPLETION_ENABLED", False):
        return []

    items = getattr(sale, "items", None) or []
    if not items:
        return []

    # Build {sku: total_qty} map from the sale items list
    sku_to_qty: dict[str, int] = defaultdict(int)
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            warnings.append(f"Sale {sale.id}: item[{idx}] is not a dict, skipped.")
            continue
        sku = (item.get("product_sku") or "").strip()
        if not sku:
            warnings.append(f"Sale {sale.id}: item[{idx}] has no product_sku, skipped.")
            continue
        try:
            qty = int(float(item.get("qty", 0)))
        except (TypeError, ValueError):
            warnings.append(f"Sale {sale.id}: item[{idx}] invalid qty, skipped.")
            continue
        if qty > 0:
            sku_to_qty[sku] += qty

    if not sku_to_qty:
        return warnings

    # Idempotency: skip if already processed for this sale
    ref_prefix = f"pos_sale_{sale.id}_"
    if StockMovement.objects.filter(reference__startswith=ref_prefix).exists():
        warnings.append(f"Sale {sale.id}: already depleted, skipped.")
        return warnings

    # Explode recipes to ingredient requirements
    reqs = explode_recipe_requirements(dict(sku_to_qty))
    if not reqs:
        # No matching recipes — log and return (not necessarily an error)
        warnings.append(
            f"Sale {sale.id}: no recipe lines found for SKUs {list(sku_to_qty.keys())}."
        )
        return warnings

    branch_id = branch.id

    with transaction.atomic():
        for req in reqs:
            qty_deplete = req.qty
            if qty_deplete <= 0:
                continue

            stock = _get_or_create_branch_stock_locked(branch_id, req.ingredient_id)
            delta = -qty_deplete
            ref = f"{ref_prefix}i{req.ingredient_id}"

            StockMovement.objects.create(
                branch_id=branch_id,
                ingredient_id=req.ingredient_id,
                movement_type=StockMovementType.DEPLETION,
                qty_delta=delta,
                reference=ref[:128],
            )

            new_on_hand = stock.on_hand + delta
            if new_on_hand < 0:
                warnings.append(
                    f"Sale {sale.id}: negative stock for ingredient {req.ingredient_name} "
                    f"at branch {branch_id} "
                    f"(on_hand={stock.on_hand}, depleted={qty_deplete})."
                )
            stock.on_hand = new_on_hand
            stock.save(update_fields=["on_hand"])

    return warnings
