from django.urls import path

from procurement import views

urlpatterns = [
    path("purchase-suggestions/", views.PurchaseSuggestionsView.as_view()),
    path("supplier-portal/invoice/", views.SupplierPortalInvoiceSubmitView.as_view()),
]
