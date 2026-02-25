"""
محرك التنبيهات – تقييم القواعد وإرسال التنبيهات عبر القنوات.
"""
from django.contrib.auth import get_user_model

from notifications.models import NotificationRule, NotificationDelivery
from notifications.rules import evaluate_rule
from notifications.channels import send_via_push, send_via_email, send_via_whatsapp

User = get_user_model()


def _get_recipients(rule) -> list[dict]:
    """جارٍ استخراج قائمة المستلمين حسب recipient_type."""
    users = []
    if rule.recipient_type == "owner":
        u = User.objects.filter(username="SAIF").first()
        if u:
            users.append({"user_id": u.id, "email": getattr(u, "email", "") or "", "phone": ""})
    elif rule.recipient_type == "custom_users" and rule.recipient_user_ids:
        for uid in rule.recipient_user_ids:
            u = User.objects.filter(id=uid).first()
            if u:
                users.append({
                    "user_id": u.id,
                    "email": getattr(u, "email", "") or "",
                    "phone": getattr(u.profile, "phone", "") if hasattr(u, "profile") and u.profile else "",
                })
    return users


def _was_recently_sent(reference: str, minutes: int = 60) -> bool:
    """تجنب إعادة إرسال نفس التنبيه خلال X دقيقة."""
    from django.utils import timezone
    from datetime import timedelta
    cutoff = timezone.now() - timedelta(minutes=minutes)
    return NotificationDelivery.objects.filter(reference=reference, sent_at__gte=cutoff).exists()


def run_notification_rules(dry_run: bool = False) -> dict:
    """
    تشغيل كل القواعد النشطة. يُستدعى من management command أو cron.
    Returns: { "evaluated": N, "alerts": M, "sent": K, "errors": [...] }
    """
    stats = {"evaluated": 0, "alerts": 0, "sent": 0, "errors": []}
    rules = NotificationRule.objects.filter(is_active=True)

    for rule in rules:
        stats["evaluated"] += 1
        try:
            alerts = evaluate_rule(rule)
            if not alerts:
                continue
            stats["alerts"] += len(alerts)

            recipients = _get_recipients(rule)
            if not recipients:
                continue

            channels = rule.channels or ["push"]
            for alert in alerts:
                ref = f"notif_{rule.id}_{alert.get('branch_id', '') or alert.get('shift_id', '')}_{rule.rule_type}"
                if _was_recently_sent(ref, minutes=60):
                    continue

                title = alert.get("title", "تنبيه")
                message = alert.get("message", "")

                for rec in recipients:
                    for ch in channels:
                        if ch == "push":
                            if not dry_run:
                                ok = send_via_push(rec["user_id"], title, message, ref)
                                if ok:
                                    NotificationDelivery.objects.create(
                                        rule=rule, channel="push", recipient_id=rec["user_id"],
                                        title=title, message=message, reference=ref, success=ok
                                    )
                                    stats["sent"] += 1
                        elif ch == "email" and rec.get("email"):
                            if not dry_run:
                                ok = send_via_email(rec["email"], title, message, ref)
                                NotificationDelivery.objects.create(
                                    rule=rule, channel="email", recipient_email=rec["email"],
                                    title=title, message=message, reference=ref, success=ok
                                )
                                if ok:
                                    stats["sent"] += 1
                        elif ch == "whatsapp" and rec.get("phone"):
                            if not dry_run:
                                ok = send_via_whatsapp(rec["phone"], title, message, ref)
                                NotificationDelivery.objects.create(
                                    rule=rule, channel="whatsapp", recipient_phone=rec["phone"],
                                    title=title, message=message, reference=ref, success=ok
                                )
                                if ok:
                                    stats["sent"] += 1
        except Exception as e:
            stats["errors"].append(f"{rule.name}: {e}")
    return stats
