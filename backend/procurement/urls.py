from django.urls import path, include
from rest_framework.routers import DefaultRouter

from procurement import views

router = DefaultRouter()
router.register(r"invoices", views.SupplierInvoiceViewSet, basename="supplierinvoice")

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
    # فواتير الشراء (ViewSet: list, create, retrieve, update, partial_update, post action)
    path("", include(router.urls)),
    path("orders/", views.PurchaseOrderListView.as_view()),
    path("orders/<int:pk>/", views.PurchaseOrderDetailView.as_view()),
    path("goods-receipts/", views.GoodsReceiptListCreateView.as_view()),
    path("goods-receipts/<int:pk>/", views.GoodsReceiptDetailView.as_view()),
    path("goods-receipts/<int:pk>/confirm/", views.GoodsReceiptConfirmView.as_view()),
    path("requests/", views.PurchaseRequestListView.as_view()),
    # تقارير المشتريات
    path("reports/daily-movements/", views.ProcurementDailyMovementsView.as_view()),
    path("reports/review-movements/", views.ProcurementReviewMovementsView.as_view()),
]
