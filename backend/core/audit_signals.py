"""
Enterprise Audit Trail - إشارات لتسجيل تغييرات النماذج.
من غيّر ماذا؟ متى؟ من أي IP؟
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

from org.models import EnterpriseAuditLog


def get_request():
    """استخراج الطلب الحالي إن وُجد (من thread-local)."""
    try:
        from core.tenant_middleware import get_current_request
        return get_current_request()
    except Exception:
        return None


def _get_client_ip(request):
    if not request:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _get_user_agent(request):
    if not request:
        return ""
    return (request.META.get("HTTP_USER_AGENT") or "")[:512]


def log_model_change(instance, action: str, changed_fields: dict = None):
    """تسجيل تغيير في EnterpriseAuditLog."""
    try:
        request = get_request()
        user = getattr(request, "user", None) if request else None
        if not user or not user.is_authenticated:
            user = None

        EnterpriseAuditLog.objects.create(
            action=action,
            model_name=f"{instance.__class__.__module__}.{instance.__class__.__name__}",
            object_id=str(instance.pk),
            object_repr=str(instance)[:255],
            changed_fields=changed_fields or {},
            user=user,
            ip_address=_get_client_ip(request) if request else None,
            user_agent=_get_user_agent(request) if request else "",
        )
    except Exception:
        pass  # لا نريد أن يفشل التطبيق بسبب التدقيق


# التفعيل يتم يدوياً - استيراد في AppConfig.ready أو في urls
# لتجنب التسجيل المزدوج، نضيف الإشارات فقط للنماذج الحساسة:
AUDITED_MODELS = (
    "accounting.ChartAccount",
    "accounting.JournalEntry",
    "accounting.ManualAdjustment",
    "org.UserProfile",
    "procurement.PurchaseOrder",
    "procurement.GoodsReceipt",
    "procurement.SupplierInvoice",
    "hr.Employee",
    "hr.PayrollRun",
    "assets.Asset",
)


def setup_audit_signals():
    """ربط إشارات التدقيق بالنماذج المعرّفة."""
    from django.apps import apps

    for model_path in AUDITED_MODELS:
        try:
            model = apps.get_model(*model_path.split(".", 1))
            _connect_model(model)
        except (LookupError, ValueError):
            pass


def _connect_model(model):
    @receiver(post_save, sender=model)
    def _on_save(sender, instance, created, **kwargs):
        action = "create" if created else "update"
        changed = {}
        if not created and hasattr(instance, "_audit_changed_fields"):
            changed = getattr(instance, "_audit_changed_fields", {})
        log_model_change(instance, action, changed)

    @receiver(post_delete, sender=model)
    def _on_delete(sender, instance, **kwargs):
        log_model_change(instance, "delete")
