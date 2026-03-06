from django.urls import path

from analytics.executive_summary_views import ExecutiveSummaryView

urlpatterns = [
    path("executive-summary/", ExecutiveSummaryView.as_view(), name="reports-executive-summary"),
]
