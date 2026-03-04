from django.urls import path

from accounting import views

urlpatterns = [
    # ── Chart of Accounts ──────────────────────────────────────────
    path("chart/", views.ChartAccountListView.as_view()),
    path("chart/import-balances/", views.ChartAccountImportBalancesView.as_view()),
    path("chart/<int:pk>/", views.ChartAccountDetailView.as_view()),

    # ── Cost Audit & Manual Adjustments ───────────────────────────
    path("cost-audit/", views.CostAuditListView.as_view()),
    path("cost-audit/<int:pk>/exclude/", views.CostAuditExcludeView.as_view()),
    path("manual-adjustments/", views.ManualAdjustmentCreateView.as_view()),
    path("manual-adjustments/log/", views.ManualAdjustmentLogView.as_view()),

    # ── Daily Reconciliation ───────────────────────────────────────
    path("daily/", views.DailyReconciliationView.as_view()),
    path("cash-to-bank/", views.CashToBankView.as_view()),
    path("discrepancy-alerts/", views.DiscrepancyAlertsView.as_view()),
    path("export/", views.ExportReconciliationView.as_view()),
    path("daily-report/", views.DailyReportExportView.as_view()),
    path("submitted-branches/", views.SubmittedBranchesView.as_view()),
    path("pending/", views.PendingSubmissionsView.as_view()),
    path("finalize/", views.FinalizeDayView.as_view()),
    path("consolidated/", views.ConsolidatedBalanceSheetView.as_view()),

    # ── NEW: Trial Balance / Account Statement / Journal Entries ───
    path("trial-balance/", views.TrialBalanceView.as_view()),
    path("account-statement/", views.AccountStatementView.as_view()),
    path("journal-entries/", views.JournalEntryListCreateView.as_view()),
    path("journal-entries/schema/", views.JournalEntrySchemaView.as_view()),
    path("journal-entries/<int:pk>/", views.JournalEntryDetailView.as_view()),
    path("cost-centers/", views.CostCenterListView.as_view()),
]
