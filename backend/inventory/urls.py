from django.urls import path

from inventory import views
from inventory.views import RecipeCostView

urlpatterns = [
    path("central-kitchen/transfers/", views.CentralKitchenTransfersView.as_view()),
    path("products-with-recipes/", views.ProductsWithRecipesView.as_view(), name="products-with-recipes"),
    path("production-plan/", views.ProductionPlanView.as_view(), name="production-plan"),
    path("recipe-bulk-upload/", views.RecipeBulkUploadView.as_view(), name="recipe-bulk-upload"),
    path("product-catalog-upload/", views.ProductCatalogUploadView.as_view(), name="product-catalog-upload"),
    path("units/", views.UnitsListView.as_view(), name="units-list"),
    path("ingredients/", views.IngredientListView.as_view(), name="ingredient-list"),
    path("ingredients/<int:pk>/", views.IngredientDetailView.as_view(), name="ingredient-detail"),
    path("ingredients/<int:ingredient_id>/packages/", views.IngredientPackageListCreateView.as_view(), name="ingredient-packages"),
    path("ingredients/<int:ingredient_id>/packages/<int:pk>/", views.IngredientPackageDetailView.as_view(), name="ingredient-package-detail"),
    path("profit-summary/", views.ProfitSummaryView.as_view(), name="profit-summary"),
    path("waste-report/", views.WasteReportView.as_view(), name="waste-report"),
    path("transfers/", views.StockTransferListCreateView.as_view(), name="stock-transfers"),
    path("transfers/<uuid:uuid>/confirm/", views.StockTransferConfirmView.as_view(), name="stock-transfer-confirm"),
    path("transfers/<uuid:uuid>/reject/", views.StockTransferRejectView.as_view(), name="stock-transfer-reject"),
    path("products/search/", views.FoodicsProductSearchView.as_view(), name="product-search"),
    path("products/", views.ProductListView.as_view(), name="product-list"),
    path("products/<int:pk>/", views.ProductDetailView.as_view(), name="product-detail"),
    path("products/<int:pk>/recipe/lines/", views.ProductRecipeLinesView.as_view(), name="product-recipe-lines"),
    path("products/<int:pk>/recipe/lines/<int:line_id>/", views.ProductRecipeLineDetailView.as_view(), name="product-recipe-line-detail"),
    path("ingredients/<int:pk>/cost/", views.IngredientCostUpdateView.as_view(), name="ingredient-cost-update"),
    # تقارير المخزون
    path("stock-balance/", views.StockBalanceReportView.as_view(), name="stock-balance"),
    path("stock-movements/", views.StockMovementsReportView.as_view(), name="stock-movements"),
    # Recipe Costing
    path("recipes/<int:product_pk>/cost/", RecipeCostView.as_view(), name="recipe-cost"),
]
