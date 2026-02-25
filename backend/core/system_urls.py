from django.urls import path

from core.system_views import ModuleConfigView, SystemHeartbeatView

urlpatterns = [
    path("heartbeat/", SystemHeartbeatView.as_view(), name="system-heartbeat"),
    path("modules/", ModuleConfigView.as_view(), name="module-config"),
]
