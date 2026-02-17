from django.urls import path

from inventory import views

urlpatterns = [
    path("products-with-recipes/", views.ProductsWithRecipesView.as_view(), name="products-with-recipes"),
    path("production-plan/", views.ProductionPlanView.as_view(), name="production-plan"),
    path("recipe-bulk-upload/", views.RecipeBulkUploadView.as_view(), name="recipe-bulk-upload"),
    path("product-catalog-upload/", views.ProductCatalogUploadView.as_view(), name="product-catalog-upload"),
    path("units/", views.UnitsListView.as_view(), name="units-list"),
    path("ingredients/", views.IngredientListView.as_view(), name="ingredient-list"),
    path("ingredients/<int:pk>/", views.IngredientDetailView.as_view(), name="ingredient-detail"),
    path("profit-summary/", views.ProfitSummaryView.as_view(), name="profit-summary"),
    path("waste-report/", views.WasteReportView.as_view(), name="waste-report"),
]
