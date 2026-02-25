"""
واجهات النظام – نبض المهام (Health Check) للمالك.
"""
from datetime import timedelta

from django.utils import timezone
from rest_framework import permissions, response, views

from core.heartbeat_services import get_all_heartbeats
from core.permissions import is_super_admin


class SystemHeartbeatView(views.APIView):
    """
    نبض المهام الخلفية – سيف فقط.
    يعرض آخر تشغيل لكل مهمة (المطابقة، التحويلات العالقة، إلخ).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_super_admin(request.user):
            return response.Response({"detail": "SAIF only"}, status=403)
        tasks = get_all_heartbeats()
        now = timezone.now()
        stale_threshold = now - timedelta(hours=24)
        out = []
        for t in tasks:
            last = t.get("last_run_at")
            is_stale = last is None or (last < stale_threshold if hasattr(last, "__lt__") else False)
            out.append({
                "task_name": t["task_name"],
                "last_run_at": last.isoformat() if last else None,
                "last_status": t["last_status"],
                "last_message": t["last_message"] or "",
                "is_stale": is_stale,
            })
        return response.Response({
            "tasks": out,
            "checked_at": now.isoformat(),
        })


class ModuleConfigView(views.APIView):
    """قائمة الوحدات المفعلة - للفرونت إند."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from core.module_config import ALL_MODULES, MODULE_LABELS, is_module_enabled
        brand_id = request.query_params.get("brand_id")
        bid = int(brand_id) if brand_id and brand_id.isdigit() else None
        modules = {}
        for key in ALL_MODULES:
            modules[key] = {
                "enabled": is_module_enabled(key, bid),
                "label": MODULE_LABELS.get(key, key),
            }
        return response.Response({"modules": modules})
