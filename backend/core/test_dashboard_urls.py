from django.urls import path
from core.test_dashboard_views import DashboardRunView, DashboardStatusView

urlpatterns = [
    path("status/", DashboardStatusView.as_view(), name="test_dashboard_status"),
    path("run/",    DashboardRunView.as_view(),    name="test_dashboard_run"),
]
