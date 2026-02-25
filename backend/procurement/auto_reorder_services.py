"""
Auto-Reordering - إعادة الطلب الذكي.
عند وصول مخزون صنف لنقطة معينة، أو عند معدل استهلاك، يُنشأ مسودة طلب شراء.
"""
from decimal import Decimal
from datetime import timedelta

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from core.error_logging import log_system_error
from inventory.models import BranchStock, StockMovement, StockMovementType
from procurement.models import AutoReorderRule, PurchaseRequest, PurchaseRequestLine


def _consumption_rate(branch_id: int, ingredient_id: int, lookback_days: int) -> Decimal:
    """متوسط الاستهلاك اليومي من حركات depletion."""
    since = timezone.now().date() - timedelta(days=lookback_days)
    agg = StockMovement.objects.filter(
        branch_id=branch_id,
        ingredient_id=ingredient_id,
        movement_type=StockMovementType.DEPLETION,
        created_at__date__gte=since,
    ).aggregate(total=Sum("qty_delta"))
    total = abs(float(agg.get("total") or 0))
    return Decimal(str(total / lookback_days)) if lookback_days > 0 else Decimal("0")


def run_auto_reorder(brand_id: int | None = None) -> dict:
    """
    فحص قواعد إعادة الطلب وإنشاء طلبات شراء مسودة.
    Returns: { created: int, errors: list }
    """
    qs = AutoReorderRule.objects.filter(is_active=True).select_related(
        "branch", "ingredient", "supplier", "ingredient__base_unit"
    )
    if brand_id:
        qs = qs.filter(brand_id=brand_id)

    created = 0
    errors = []

    for rule in qs:
        try:
            stock = BranchStock.objects.filter(
                branch=rule.branch, ingredient=rule.ingredient
            ).first()
            on_hand = stock.on_hand if stock else Decimal("0")

            should_reorder = False
            qty_to_order = rule.reorder_quantity

            if rule.use_consumption and rule.lookback_days:
                rate = _consumption_rate(rule.branch_id, rule.ingredient_id, rule.lookback_days)
                if rate > 0:
                    days_of_stock = float(on_hand) / float(rate) if rate else 999
                    if days_of_stock < 7:  # أقل من أسبوع
                        should_reorder = True
                        qty_to_order = max(rule.reorder_quantity, rate * 14)  # أسبوعين كحد أدنى
            else:
                if on_hand < rule.reorder_level:
                    should_reorder = True

            if not should_reorder:
                continue

            with transaction.atomic():
                from django.contrib.auth import get_user_model
                system_user = get_user_model().objects.filter(is_superuser=True).first()
                if not system_user:
                    system_user = get_user_model().objects.first()
                if not system_user:
                    errors.append("No user found for auto-reorder")
                    continue
                pr = PurchaseRequest.objects.create(
                    branch=rule.branch,
                    request_number=_next_pr_number(rule.branch_id),
                    status="draft",
                    requested_by=system_user,
                )
                unit = rule.ingredient.base_unit
                if not unit:
                    from inventory.models import Unit
                    unit = Unit.objects.filter(code="pcs").first() or Unit.objects.first()
                if not unit:
                    errors.append(f"No unit for {rule.ingredient.name_en}")
                    continue
                PurchaseRequestLine.objects.create(
                    request=pr,
                    ingredient=rule.ingredient,
                    description=rule.ingredient.name_en,
                    quantity=qty_to_order,
                    unit=unit,
                )
                created += 1
        except Exception as e:
            err = f"Auto-reorder failed for {rule.ingredient.name_en}: {e}"
            errors.append(err)
            log_system_error("auto_reorder_failed", err, exc=e)

    return {"created": created, "errors": errors}


def _next_pr_number(branch_id: int) -> str:
    from django.utils import timezone
    prefix = timezone.now().strftime("%Y%m%d")
    qs = PurchaseRequest.objects.filter(request_number__startswith=f"PR-{prefix}")
    from django.db.models import Max
    max_num = qs.aggregate(m=Max("request_number"))["m"]
    if not max_num:
        return f"PR-{prefix}-0001"
    try:
        num = int(max_num.split("-")[-1]) + 1
        return f"PR-{prefix}-{num:04d}"
    except (ValueError, IndexError):
        return f"PR-{prefix}-0001"
