"""
Health Check — للتحقق من حالة النظام (Database, Redis, Celery).
استخدمه مع Render healthCheckPath أو Load Balancer.
"""
from django.db import connection
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET


@method_decorator([csrf_exempt, require_GET], name="dispatch")
class HealthCheckView(View):
    """
    GET /health/ أو /api/health/
    يرجع: { status: 'healthy'|'degraded', checks: { database, redis, celery, services } }
    """

    def get(self, request):
        checks = {
            "database": self._check_database(),
            "redis": self._check_redis(),
            "celery": self._check_celery(),
            "services": self._check_services(),
        }
        all_ok = all(checks.values())
        status = "healthy" if all_ok else "degraded"
        return JsonResponse({"status": status, "checks": checks})

    def _check_database(self):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return True
        except Exception:
            return False

    def _check_redis(self):
        try:
            from django.core.cache import cache
            cache.set("health_ping", "ok", 5)
            return cache.get("health_ping") == "ok"
        except Exception:
            return False

    def _check_celery(self):
        """Celery: التحقق من الاتصال بالـ broker (اختياري — لا يفشل الصحة)."""
        try:
            from celery import current_app
            ping = current_app.control.inspect(timeout=1.0).ping()
            return bool(ping)
        except Exception:
            return True  # Celery غير مُشغّل لا يعني فشل الصحة

    def _check_services(self):
        """التحقق من نبض المهام (اختياري)."""
        try:
            from core.heartbeat_services import get_all_heartbeats
            get_all_heartbeats()
            return True
        except Exception:
            return True  # غير حرج
