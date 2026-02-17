from rest_framework import permissions, response, status, views

from inventory.models import FoodicsProduct
from inventory.recipe_upload import parse_recipe_excel
from inventory.services import production_plan_requirements

from .product_catalog_parser import parse_product_catalog_excel


class ProductsWithRecipesView(views.APIView):
    """List products that have a BOM (for Production Planner dropdown)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        products = FoodicsProduct.objects.filter(is_active=True).filter(
            recipe__isnull=False
        ).values("id", "name", "foodics_product_id").distinct().order_by("name")
        return response.Response(list(products))


class ProductionPlanView(views.APIView):
    """What-if: given branch + list of product quantities, return exploded ingredients with stock."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        branch_id = request.data.get("branch_id")
        items = request.data.get("items") or []
        if not branch_id:
            return response.Response(
                {"detail": "branch_id is required"},
                status=400,
            )
        try:
            branch_id = int(branch_id)
        except (TypeError, ValueError):
            return response.Response(
                {"detail": "branch_id must be an integer"},
                status=400,
            )
        ingredients = production_plan_requirements(branch_id, items)
        return response.Response({
            "branch_id": branch_id,
            "items": items,
            "ingredients": ingredients,
        })


class RecipeBulkUploadView(views.APIView):
    """Bulk upload recipes via Excel. Columns: Product, Ingredient, Qty, Unit."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return response.Response(
                {"detail": "file is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = parse_recipe_excel(file)
            return response.Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            return response.Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ProductCatalogUploadView(views.APIView):
    """
    Upload Product Catalog (Saif format) [Ref: 132745].
    Headers: المنتج, الوحدة, كود تعريف المنتج, السعر غير شامل الضريبة.
    Creates/updates Products (final items sold). Ingredients uploaded separately.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return response.Response(
                {"detail": "file is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = parse_product_catalog_excel(file)
            return response.Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            return response.Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
