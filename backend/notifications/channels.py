"""
قنوات الإرسال: Push (AdminNotification), Email, WhatsApp.
"""
from django.core.mail import send_mail
from django.conf import settings


def send_via_push(user_id: int, title: str, message: str, reference: str) -> bool:
    """إرسال تنبيه عبر Push – يُخزن في AdminNotification للعرض في الواجهة."""
    try:
        from org.models import AdminNotification
        AdminNotification.objects.create(
            user_id=user_id,
            event_type="notification_engine",
            title=title,
            message=message,
            reference=reference,
        )
        return True
    except Exception:
        return False


def send_via_email(to_email: str, title: str, message: str, reference: str) -> bool:
    """إرسال عبر SMTP. يتطلب إعداد EMAIL_* في settings."""
    try:
        from django.core.mail import get_connection
        conn = get_connection(fail_silently=True)
        if conn is None:
            return False
        send_mail(
            subject=title,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@smartops.local'),
            recipient_list=[to_email],
            fail_silently=True,
        )
        return True
    except Exception:
        return False


def send_via_whatsapp(phone: str, title: str, message: str, reference: str) -> bool:
    """
    WhatsApp Business API – placeholder.
    للتكامل: إعداد WHATSAPP_* وتفعيل الطلبات إلى API.
    """
    # TODO: تكامل WhatsApp Cloud API
    return False
