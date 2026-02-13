from django.urls import path

from inventory import views

urlpatterns = [
    path("products-with-recipes/", views.ProductsWithRecipesView.as_view(), name="products-with-recipes"),
    path("production-plan/", views.ProductionPlanView.as_view(), name="production-plan"),
    path("recipe-bulk-upload/", views.RecipeBulkUploadView.as_view(), name="recipe-bulk-upload"),
    path("product-catalog-upload/", views.ProductCatalogUploadView.as_view(), name="product-catalog-upload"),
]
