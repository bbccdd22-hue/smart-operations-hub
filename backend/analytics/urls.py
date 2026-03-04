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
from analytics.executive_summary_views import ExecutiveSummaryView
from analytics.food_cost_views import FoodCostDashboardView
from analytics.category_views import CategoryAnalyticsView
from analytics.sales_summary_views import SalesSummaryView

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
    path("executive-summary/", ExecutiveSummaryView.as_view(), name="dashboard-executive-summary"),
    path("food-cost/", FoodCostDashboardView.as_view(), name="food-cost-dashboard"),
    path("categories/", CategoryAnalyticsView.as_view(), name="category-analytics"),
    path("sales-summary/", SalesSummaryView.as_view(), name="sales-summary"),
]

