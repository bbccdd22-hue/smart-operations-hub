from django.urls import path

from shifts import views
from shifts import report_views

urlpatterns = [
    path("hub-executive-summary/", report_views.HubExecutiveSummaryView.as_view(), name="hub-executive-summary"),
    path("closing/auditor-list/", views.ShiftClosingListForAuditorView.as_view(), name="shift-closing-auditor-list"),
    path("closing/", views.ShiftClosingCreateView.as_view(), name="shift-closing-create"),
    path("closing/by-branch-date/", views.ShiftClosingByBranchDateView.as_view(), name="shift-closing-by-branch-date"),
    path("closing/<int:pk>/submit/", views.ShiftClosingSubmitView.as_view(), name="shift-closing-submit"),
    path("closing/<int:closing_pk>/attachments/", views.ShiftClosingAttachmentListCreateView.as_view(), name="shift-closing-attachments"),
    path("attachments/<int:pk>/", views.ShiftClosingAttachmentDestroyView.as_view(), name="shift-closing-attachment-delete"),
    path("closing/<int:pk>/", views.ShiftClosingDetailView.as_view(), name="shift-closing-detail"),
    path("financial-reports/", report_views.ShiftFinancialReportsView.as_view(), name="shift-financial-reports"),
    path("financial-reports/export/", report_views.ShiftFinancialReportExportView.as_view(), name="shift-financial-reports-export"),
]

