from django.urls import path

from accounting import views

urlpatterns = [
    path("daily/", views.DailyReconciliationView.as_view()),
    path("cash-to-bank/", views.CashToBankView.as_view()),
    path("discrepancy-alerts/", views.DiscrepancyAlertsView.as_view()),
    path("export/", views.ExportReconciliationView.as_view()),
    path("daily-report/", views.DailyReportExportView.as_view()),
    path("submitted-branches/", views.SubmittedBranchesView.as_view()),
    path("pending/", views.PendingSubmissionsView.as_view()),
    path("finalize/", views.FinalizeDayView.as_view()),
]
