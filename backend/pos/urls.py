from django.urls import path
from . import views

urlpatterns = [
    path("products/", views.POSProductsView.as_view()),
    path("categories/", views.POSCategoriesView.as_view()),
    path("modifiers/", views.POSModifiersView.as_view()),
    path("sale/", views.POSCreateSaleView.as_view()),
    path("sync-offline/", views.POSSyncOfflineView.as_view()),
    path("kitchen-orders/", views.POSKitchenOrdersView.as_view()),
]
