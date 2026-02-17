from django.urls import path

from financials import views

urlpatterns = [
    path("summary/", views.FinancialSummaryView.as_view(), name="financial-summary"),
]
