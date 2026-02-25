from django.urls import path

from analytics.views import (
    DashboardChartView,
    DashboardInsightsView,
    ForecastView,
    HeartbeatView,
    OwnerDashboardSummaryView,
    PredictDateView,
    SystemHealthView,
)
from analytics.command_center_views import OwnerCommandCenterView
from analytics.executive_dashboard_views import ExecutiveDashboardView

urlpatterns = [
    path("summary/", OwnerDashboardSummaryView.as_view(), name="owner-dashboard-summary"),
    path("heartbeat/", HeartbeatView.as_view(), name="dashboard-heartbeat"),
    path("insights/", DashboardInsightsView.as_view(), name="dashboard-insights"),
    path("chart-data/", DashboardChartView.as_view(), name="dashboard-chart-data"),
    path("forecast/", ForecastView.as_view(), name="forecast"),
    path("predict-date/", PredictDateView.as_view(), name="predict-date"),
    path("system-health/", SystemHealthView.as_view(), name="system-health"),
    path("command-center/", OwnerCommandCenterView.as_view(), name="owner-command-center"),
    path("executive-dashboard/", ExecutiveDashboardView.as_view(), name="executive-dashboard"),
]

