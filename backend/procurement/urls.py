from django.urls import path

from procurement import views

urlpatterns = [
    path("purchase-suggestions/", views.PurchaseSuggestionsView.as_view()),
    path("manual-purchase-forecast/", views.ManualPurchaseForecastView.as_view(), name="manual-purchase-forecast"),
    path("supplier-portal/invoice/", views.SupplierPortalInvoiceSubmitView.as_view()),
]
