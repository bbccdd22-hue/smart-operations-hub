"""
API لإدارة قواعد التنبيهات – SAIF فقط.
"""
from rest_framework import permissions, response, status, views
from drf_spectacular.utils import extend_schema

from notifications.models import NotificationRule, NotificationDelivery


def _is_saif(request):
    return request.user and request.user.is_authenticated and (request.user.username or "") == "SAIF"


@extend_schema(tags=["notifications"])
class NotificationRuleListCreateView(views.APIView):
    """قائمة القواعد وإنشاء قاعدة جديدة."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_saif(request):
            return response.Response({"detail": "SAIF only"}, status=403)
        rules = NotificationRule.objects.all().order_by("-created_at")
        return response.Response([{
            "id": r.id,
            "name": r.name,
            "rule_type": r.rule_type,
            "params": r.params,
            "channels": r.channels,
            "recipient_type": r.recipient_type,
            "recipient_user_ids": r.recipient_user_ids,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat(),
        } for r in rules])

    def post(self, request):
        if not _is_saif(request):
            return response.Response({"detail": "SAIF only"}, status=403)
        data = request.data or {}
        name = (data.get("name") or "").strip()
        rule_type = data.get("rule_type") or "shift_not_opened_within_minutes"
        if not name:
            return response.Response({"detail": "name required"}, status=400)
        rule = NotificationRule.objects.create(
            name=name,
            rule_type=rule_type,
            params=data.get("params") or {"minutes": 10, "shift_type": "morning"},
            channels=data.get("channels") or ["push"],
            recipient_type=data.get("recipient_type") or "owner",
            recipient_user_ids=data.get("recipient_user_ids") or [],
            is_active=data.get("is_active", True),
        )
        return response.Response({
            "id": rule.id,
            "name": rule.name,
            "rule_type": rule.rule_type,
            "params": rule.params,
            "channels": rule.channels,
            "recipient_type": rule.recipient_type,
            "recipient_user_ids": rule.recipient_user_ids,
            "is_active": rule.is_active,
            "created_at": rule.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


@extend_schema(tags=["notifications"])
class NotificationRuleDetailView(views.APIView):
    """تعديل/حذف قاعدة."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not _is_saif(request):
            return response.Response({"detail": "SAIF only"}, status=403)
        try:
            rule = NotificationRule.objects.get(pk=pk)
        except NotificationRule.DoesNotExist:
            return response.Response({"detail": "Not found"}, status=404)
        data = request.data or {}
        if "name" in data:
            rule.name = (data["name"] or "").strip() or rule.name
        if "params" in data:
            rule.params = data["params"] if isinstance(data["params"], dict) else rule.params
        if "channels" in data:
            rule.channels = data["channels"] if isinstance(data["channels"], list) else rule.channels
        if "recipient_type" in data:
            rule.recipient_type = data["recipient_type"] or rule.recipient_type
        if "recipient_user_ids" in data:
            rule.recipient_user_ids = data["recipient_user_ids"] if isinstance(data["recipient_user_ids"], list) else rule.recipient_user_ids
        if "is_active" in data:
            rule.is_active = bool(data["is_active"])
        rule.save()
        return response.Response({
            "id": rule.id,
            "name": rule.name,
            "rule_type": rule.rule_type,
            "params": rule.params,
            "channels": rule.channels,
            "recipient_type": rule.recipient_type,
            "recipient_user_ids": rule.recipient_user_ids,
            "is_active": rule.is_active,
        })

    def delete(self, request, pk):
        if not _is_saif(request):
            return response.Response({"detail": "SAIF only"}, status=403)
        try:
            rule = NotificationRule.objects.get(pk=pk)
            rule.delete()
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        except NotificationRule.DoesNotExist:
            return response.Response({"detail": "Not found"}, status=404)


@extend_schema(tags=["notifications"])
class NotificationRuleTriggerView(views.APIView):
    """تشغيل يدوي للقواعد (للتجربة)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _is_saif(request):
            return response.Response({"detail": "SAIF only"}, status=403)
        from notifications.engine import run_notification_rules
        dry_run = (request.data or {}).get("dry_run", False)
        stats = run_notification_rules(dry_run=dry_run)
        return response.Response(stats)
