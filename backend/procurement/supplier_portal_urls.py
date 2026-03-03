from django.urls import path
from .supplier_portal_views import SupplierPortalAuthView, SupplierPortalDashboardView
from .views import SupplierPortalInvoiceSubmitView

urlpatterns = [
    path("auth/", SupplierPortalAuthView.as_view(), name="supplier-portal-auth"),
    path("dashboard/", SupplierPortalDashboardView.as_view(), name="supplier-portal-dashboard"),
    path("invoice/", SupplierPortalInvoiceSubmitView.as_view(), name="supplier-portal-invoice"),
]
