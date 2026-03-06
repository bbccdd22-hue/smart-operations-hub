from django.urls import path
from . import views
from .table_views import (
    TableListCreateView,
    TableDetailView,
    TableStatusView,
    TableMergeView,
    TableTransferView,
)
from .kds_views import KDSOrderListView, KDSOrderStatusView, KDSStatsView

urlpatterns = [
    path("products/", views.POSProductsView.as_view()),
    path("categories/", views.POSCategoriesView.as_view()),
    path("modifiers/", views.POSModifiersView.as_view()),
    path("sale/", views.POSCreateSaleView.as_view()),
    path("sync-offline/", views.POSSyncOfflineView.as_view()),
    path("kitchen-orders/", views.POSKitchenOrdersView.as_view()),

    # Table Management
    path("tables/", TableListCreateView.as_view(), name="pos-tables"),
    path("tables/<int:pk>/", TableDetailView.as_view(), name="pos-table-detail"),
    path("tables/<int:pk>/status/", TableStatusView.as_view(), name="pos-table-status"),
    path("tables/merge/", TableMergeView.as_view(), name="pos-table-merge"),
    path("tables/<int:pk>/transfer/", TableTransferView.as_view(), name="pos-table-transfer"),

    # KDS (Kitchen Display System)
    path("kds/", KDSOrderListView.as_view(), name="pos-kds-list"),
    path("kds/stats/", KDSStatsView.as_view(), name="pos-kds-stats"),
    path("kds/<int:pk>/advance/", KDSOrderStatusView.as_view(), name="pos-kds-advance"),
    path("kds/<int:pk>/status/", KDSOrderStatusView.as_view(), name="pos-kds-status"),
]
