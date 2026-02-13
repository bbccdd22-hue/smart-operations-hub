from django.urls import path

from analytics.views import (
    DashboardChartView,
    DashboardInsightsView,
    ForecastView,
    OwnerDashboardSummaryView,
    PredictDateView,
    SystemHealthView,
)

urlpatterns = [
    path("summary/", OwnerDashboardSummaryView.as_view(), name="owner-dashboard-summary"),
    path("insights/", DashboardInsightsView.as_view(), name="dashboard-insights"),
    path("chart-data/", DashboardChartView.as_view(), name="dashboard-chart-data"),
    path("forecast/", ForecastView.as_view(), name="forecast"),
    path("predict-date/", PredictDateView.as_view(), name="predict-date"),
    path("system-health/", SystemHealthView.as_view(), name="system-health"),
]

