"""
POS real-time inventory depletion signal.

Fires after each new SaleTransaction is saved. Only acts when:
  1. settings.POS_REALTIME_DEPLETION_ENABLED is True  (global feature flag)
  2. sale.branch.pos_depletion_enabled is True         (branch-level opt-in)

Errors from depletion are logged to the system error log; they never block
the sale from being saved (the signal does not raise).
"""
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="pos.SaleTransaction")
def handle_pos_sale_depletion(sender, instance, created: bool, **kwargs):
    """Trigger real-time depletion for new POS sales when flags are on."""
    if not created:
        return

    if not getattr(settings, "POS_REALTIME_DEPLETION_ENABLED", False):
        return

    branch = getattr(instance, "branch", None)
    if branch is None or not getattr(branch, "pos_depletion_enabled", False):
        return

    try:
        from inventory.depletion_services import deplete_from_pos_sale
        warnings = deplete_from_pos_sale(instance)
        if warnings:
            try:
                from core.error_logging import log_system_error
                log_system_error(
                    "pos_depletion_warning",
                    f"POS depletion warnings for sale {instance.id}: {'; '.join(warnings)}",
                    context={"sale_id": instance.id, "branch_id": branch.id},
                )
            except Exception:  # noqa: BLE001
                pass
    except Exception as exc:  # noqa: BLE001
        try:
            from core.error_logging import log_system_error
            log_system_error(
                "pos_depletion_error",
                f"POS depletion failed for sale {instance.id}: {exc}",
                context={"sale_id": instance.id, "branch_id": getattr(branch, "id", None)},
            )
        except Exception:  # noqa: BLE001
            pass
