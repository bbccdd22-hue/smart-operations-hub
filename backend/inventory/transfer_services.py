"""
خدمة التحويل بين الفروع – مخزون قيد النقل (In-Transit).
- عند الإنشاء (Pending): خصم من المرسل، إضافة لحساب الوسيط (مخزون قيد النقل).
- عند التأكيد (Confirmed): خصم من الوسيط، إضافة للمستلم.
استخدام select_for_update لضمان عدم تضارب الكميات عند العمليات المتزامنة.
"""
from decimal import Decimal

from django.db import transaction
from django.db.utils import IntegrityError
from django.utils import timezone

from inventory.models import (
    BranchStock,
    StockMovement,
    StockMovementType,
    StockTransfer,
    StockTransferStatus,
)


def _get_in_transit_branch():
    """فرع وسيط: مخزون قيد النقل."""
    from org.models import Branch

    return Branch.objects.filter(branch_code="IN_TRANSIT").first()


def _get_or_create_branch_stock_locked(branch, ingredient):
    """الحصول على BranchStock بقفل الصف (select_for_update) لمنع Race Conditions."""
    try:
        return BranchStock.objects.select_for_update().get(
            branch=branch,
            ingredient=ingredient,
        )
    except BranchStock.DoesNotExist:
        try:
            return BranchStock.objects.create(
                branch=branch,
                ingredient=ingredient,
                on_hand=Decimal("0"),
            )
        except IntegrityError:
            return BranchStock.objects.select_for_update().get(
                branch=branch,
                ingredient=ingredient,
            )


def process_transfer_departure(transfer: StockTransfer) -> None:
    """
    عند إنشاء التحويل: خصم من الفرع المرسل، إضافة لمخزون قيد النقل.
    يُستدعى مباشرة بعد إنشاء StockTransfer والخطوط.
    """
    in_transit = _get_in_transit_branch()
    if not in_transit:
        raise ValueError("فرع مخزون قيد النقل غير موجود. شغّل migrations وأعد المحاولة.")

    with transaction.atomic():
        ref_base = f"transfer_{transfer.id}"
        for line in transfer.lines.select_related("ingredient").all():
            qty = line.qty
            if qty <= 0:
                continue

            # خصم من الفرع المرسل
            stock_from = _get_or_create_branch_stock_locked(transfer.from_branch, line.ingredient)
            StockMovement.objects.create(
                branch=transfer.from_branch,
                ingredient=line.ingredient,
                movement_type=StockMovementType.TRANSFER_OUT,
                qty_delta=-qty,
                reference=f"{ref_base}_depart",
            )
            stock_from.on_hand = stock_from.on_hand - qty
            stock_from.save(update_fields=["on_hand"])

            # إضافة لمخزون قيد النقل
            stock_transit = _get_or_create_branch_stock_locked(in_transit, line.ingredient)
            StockMovement.objects.create(
                branch=in_transit,
                ingredient=line.ingredient,
                movement_type=StockMovementType.TRANSFER_IN,
                qty_delta=qty,
                reference=f"{ref_base}_transit",
            )
            stock_transit.on_hand = stock_transit.on_hand + qty
            stock_transit.save(update_fields=["on_hand"])


def confirm_transfer(transfer: StockTransfer, *, confirmed_by) -> None:
    """
    تأكيد استلام التحويل: خصم من مخزون قيد النقل، إضافة للفرع المستلم.
    """
    if transfer.status == StockTransferStatus.CONFIRMED:
        return

    from django.utils import timezone

    in_transit = _get_in_transit_branch()
    if not in_transit:
        raise ValueError("فرع مخزون قيد النقل غير موجود.")

    with transaction.atomic():
        ref_base = f"transfer_{transfer.id}"
        for line in transfer.lines.select_related("ingredient").all():
            qty = line.qty
            if qty <= 0:
                continue

            # خصم من مخزون قيد النقل
            stock_transit = _get_or_create_branch_stock_locked(in_transit, line.ingredient)
            StockMovement.objects.create(
                branch=in_transit,
                ingredient=line.ingredient,
                movement_type=StockMovementType.TRANSFER_OUT,
                qty_delta=-qty,
                reference=f"{ref_base}_transit_out",
            )
            stock_transit.on_hand = stock_transit.on_hand - qty
            stock_transit.save(update_fields=["on_hand"])

            # إضافة للفرع المستلم
            stock_to = _get_or_create_branch_stock_locked(transfer.to_branch, line.ingredient)
            StockMovement.objects.create(
                branch=transfer.to_branch,
                ingredient=line.ingredient,
                movement_type=StockMovementType.TRANSFER_IN,
                qty_delta=qty,
                reference=f"{ref_base}_arrive",
            )
            stock_to.on_hand = stock_to.on_hand + qty
            stock_to.save(update_fields=["on_hand"])

        transfer.status = StockTransferStatus.CONFIRMED
        transfer.confirmed_by = confirmed_by
        transfer.confirmed_at = timezone.now()
        transfer.save(update_fields=["status", "confirmed_by", "confirmed_at"])


def reject_transfer(transfer: StockTransfer, *, rejected_by) -> None:
    """
    رفض استلام التحويل: عكس الحركة من مخزون قيد النقل عودةً إلى الفرع المرسل.
    يُستدعى عند ضغط زر رفض الاستلام.
    """
    if transfer.status != StockTransferStatus.PENDING:
        raise ValueError("لا يمكن رفض تحويل غير معلّق")

    from django.utils import timezone

    in_transit = _get_in_transit_branch()
    if not in_transit:
        raise ValueError("فرع مخزون قيد النقل غير موجود.")

    with transaction.atomic():
        ref_base = f"transfer_{transfer.id}_reject"
        for line in transfer.lines.select_related("ingredient").all():
            qty = line.qty
            if qty <= 0:
                continue

            # خصم من مخزون قيد النقل
            stock_transit = _get_or_create_branch_stock_locked(in_transit, line.ingredient)
            StockMovement.objects.create(
                branch=in_transit,
                ingredient=line.ingredient,
                movement_type=StockMovementType.TRANSFER_OUT,
                qty_delta=-qty,
                reference=ref_base,
            )
            stock_transit.on_hand = stock_transit.on_hand - qty
            stock_transit.save(update_fields=["on_hand"])

            # إعادة للفرع المرسل
            stock_from = _get_or_create_branch_stock_locked(transfer.from_branch, line.ingredient)
            StockMovement.objects.create(
                branch=transfer.from_branch,
                ingredient=line.ingredient,
                movement_type=StockMovementType.TRANSFER_IN,
                qty_delta=qty,
                reference=ref_base,
            )
            stock_from.on_hand = stock_from.on_hand + qty
            stock_from.save(update_fields=["on_hand"])

        transfer.status = StockTransferStatus.REJECTED
        transfer.rejected_by = rejected_by
        transfer.rejected_at = timezone.now()
        transfer.save(update_fields=["status", "rejected_by", "rejected_at"])


def notify_stale_transfers_if_any() -> int:
    """
    تحقق من التحويلات المعلقة لأكثر من 24 ساعة وأرسل AdminNotification للمالك (سيف).
    returns: عدد التنبيهات المُنشأة.
    """
    from datetime import timedelta
    from django.contrib.auth import get_user_model

    threshold = timezone.now() - timedelta(hours=24)
    stale = StockTransfer.objects.filter(
        status=StockTransferStatus.PENDING,
        requested_at__lt=threshold,
    ).select_related("from_branch", "to_branch")[:20]

    saif = get_user_model().objects.filter(username="SAIF").first()
    if not saif:
        return 0

    from org.models import AdminNotification
    created = 0
    dedupe_threshold = timezone.now() - timedelta(hours=48)
    for t in stale:
        ref = f"stale_transfer_{t.id}"
        if AdminNotification.objects.filter(
            user=saif,
            event_type="stale_transfer",
            reference=ref,
            created_at__gte=dedupe_threshold,
        ).exists():
            continue
        AdminNotification.objects.create(
            user=saif,
            event_type="stale_transfer",
            title=f"تحويل عالق أكثر من 24 ساعة #{t.id}",
            message=f"من {t.from_branch.name} إلى {t.to_branch.name} – قيد الانتظار منذ {t.requested_at}",
            reference=ref,
        )
        created += 1
    return created
