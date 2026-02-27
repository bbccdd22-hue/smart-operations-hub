from django.urls import path

from procurement import views

urlpatterns = [
    path("purchase-suggestions/", views.PurchaseSuggestionsView.as_view()),
    path("manual-purchase-forecast/", views.ManualPurchaseForecastView.as_view(), name="manual-purchase-forecast"),
    path("supplier-portal/invoice/", views.SupplierPortalInvoiceSubmitView.as_view()),
    # نظام الموردين
    path("suppliers/", views.SupplierListView.as_view()),
    path("suppliers/balances/", views.SupplierBalancesView.as_view()),
    path("suppliers/debt-aging/", views.SupplierDebtAgingView.as_view()),
    path("suppliers/<int:pk>/", views.SupplierDetailView.as_view()),
    path("suppliers/<int:supplier_id>/statement/", views.SupplierStatementView.as_view()),
]
