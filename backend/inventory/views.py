from django.db.models import Q
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from decimal import Decimal

from rest_framework import permissions, response, status, views
from rest_framework.exceptions import PermissionDenied

from core.permissions import get_user_scope
from inventory.models import FoodicsProduct, Ingredient, Unit, WasteLog
from inventory.recipe_upload import parse_recipe_excel
from inventory.services import production_plan_requirements

from inventory.profit_services import get_profit_summary

from .product_catalog_parser import parse_product_catalog_excel


class ProductsWithRecipesView(views.APIView):
    """List products that have a BOM (for Production Planner dropdown)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        products = FoodicsProduct.objects.filter(is_active=True).filter(
            recipe__isnull=False
        ).values("id", "name", "foodics_product_id").distinct().order_by("name")
        out = [
            {**p, "product_sku": p["foodics_product_id"]}
            for p in products
        ]
        return response.Response(out)


@method_decorator(csrf_exempt, name="dispatch")
class ProductionPlanView(views.APIView):
    """What-if: given branch + list of product quantities, return exploded ingredients with stock."""
    # [TEMPORARY] AllowAny + csrf_exempt for remote access testing - restore for production
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
        # Skip branch scope check when AllowAny (anonymous) - allow any branch for testing
        if request.user.is_authenticated:
            scope = get_user_scope(request.user)
            if scope["branch_ids"] is not None and branch_id not in (scope["branch_ids"] or []):
                raise PermissionDenied("You can only view production plans for your assigned branch.")
        ingredients, products_without_recipe = production_plan_requirements(branch_id, items)
        return response.Response({
            "branch_id": branch_id,
            "items": items,
            "ingredients": ingredients,
            "total_ingredients": ingredients,
            "products_without_recipe": products_without_recipe,
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


class UnitsListView(views.APIView):
    """IU1002: List units for ingredient base unit dropdown (ml, g, pcs, kg, l)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        preferred = ["ml", "g", "l", "kg", "slice", "pcs"]
        units = Unit.objects.filter(code__in=preferred).order_by("code").values("id", "code", "name_en", "name_ar")
        if not units.exists():
            units = Unit.objects.all().order_by("code").values("id", "code", "name_en", "name_ar")[:20]
        return response.Response(list(units))


class IngredientListView(views.APIView):
    """IU1003: List/create ingredients for Manage Ingredients (PR1002 context)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        system_group = request.query_params.get("system_group", "").strip()
        qs = Ingredient.objects.filter(is_active=True).select_related("base_unit").order_by("name_en")
        if system_group and system_group in ("raw_materials", "packaging", "other"):
            qs = qs.filter(system_group=system_group)
        out = []
        for ing in qs:
            bu = ing.base_unit
            out.append({
                "id": ing.id,
                "serial_code": ing.serial_code or "",
                "name_en": ing.name_en,
                "name_ar": ing.name_ar or "",
                "system_code": ing.system_code or "IU1003",
                "system_group": ing.system_group or "raw_materials",
                "base_unit_id": bu.id if bu else None,
                "base_unit_code": bu.code if bu else "",
                "base_unit_name_en": bu.name_en if bu else "",
                "base_unit_name_ar": bu.name_ar if bu else "",
                "package_conversion_factor": str(ing.package_conversion_factor) if ing.package_conversion_factor else None,
                "package_name_en": ing.package_name_en or "",
                "package_name_ar": ing.package_name_ar or "",
                "unit_cost": str(ing.unit_cost) if ing.unit_cost is not None else None,
            })
        return response.Response(out)

    def post(self, request):
        data = request.data
        name_en = (data.get("name_en") or "").strip()
        name_ar = (data.get("name_ar") or "").strip()
        if not name_en:
            return response.Response({"detail": "name_en is required"}, status=400)
        base_unit_id = data.get("base_unit_id")
        if not base_unit_id:
            return response.Response({"detail": "base_unit_id is required"}, status=400)
        base_unit = Unit.objects.filter(id=base_unit_id).first()
        if not base_unit:
            return response.Response({"detail": "Invalid base_unit_id"}, status=400)
        serial_code = (data.get("serial_code") or "").strip()
        system_group = data.get("system_group") or "raw_materials"
        pkg_factor = data.get("package_conversion_factor")
        pkg_name_en = (data.get("package_name_en") or "").strip()
        pkg_name_ar = (data.get("package_name_ar") or "").strip()
        ing = Ingredient.objects.create(
            name_en=name_en,
            name_ar=name_ar,
            base_unit=base_unit,
            serial_code=serial_code,
            system_group=system_group,
            package_conversion_factor=Decimal(str(pkg_factor)) if pkg_factor else None,
            package_name_en=pkg_name_en or "",
            package_name_ar=pkg_name_ar or "",
        )
        return response.Response({
            "id": ing.id,
            "serial_code": ing.serial_code,
            "name_en": ing.name_en,
            "name_ar": ing.name_ar,
            "system_code": ing.system_code,
            "base_unit_code": ing.base_unit.code,
        }, status=status.HTTP_201_CREATED)


class IngredientDetailView(views.APIView):
    """IU1003: Get/update/delete a single ingredient."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        ing = Ingredient.objects.filter(id=pk).select_related("base_unit").first()
        if not ing:
            return response.Response({"detail": "Not found"}, status=404)
        bu = ing.base_unit
        return response.Response({
            "id": ing.id,
            "serial_code": ing.serial_code or "",
            "name_en": ing.name_en,
            "name_ar": ing.name_ar or "",
            "system_code": ing.system_code,
            "system_group": ing.system_group or "raw_materials",
            "base_unit_id": bu.id if bu else None,
            "base_unit_code": bu.code if bu else "",
            "package_conversion_factor": str(ing.package_conversion_factor) if ing.package_conversion_factor else None,
            "package_name_en": ing.package_name_en or "",
            "package_name_ar": ing.package_name_ar or "",
            "unit_cost": str(ing.unit_cost) if ing.unit_cost is not None else None,
        })

    def patch(self, request, pk):
        ing = Ingredient.objects.filter(id=pk).first()
        if not ing:
            return response.Response({"detail": "Not found"}, status=404)
        data = request.data
        if "name_en" in data and data["name_en"]:
            ing.name_en = str(data["name_en"]).strip()
        if "name_ar" in data:
            ing.name_ar = str(data.get("name_ar") or "").strip()
        if "base_unit_id" in data and data["base_unit_id"]:
            bu = Unit.objects.filter(id=data["base_unit_id"]).first()
            if bu:
                ing.base_unit = bu
        if "serial_code" in data:
            ing.serial_code = str(data.get("serial_code") or "").strip()
        if "system_group" in data:
            ing.system_group = data["system_group"] or "raw_materials"
        if "package_conversion_factor" in data:
            val = data["package_conversion_factor"]
            ing.package_conversion_factor = Decimal(str(val)) if val else None
        if "package_name_en" in data:
            ing.package_name_en = str(data.get("package_name_en") or "").strip()
        if "package_name_ar" in data:
            ing.package_name_ar = str(data.get("package_name_ar") or "").strip()
        if "unit_cost" in data:
            val = data.get("unit_cost")
            ing.unit_cost = Decimal(str(val)) if val is not None and str(val).strip() else None
        ing.save()
        bu = ing.base_unit
        return response.Response({
            "id": ing.id,
            "name_en": ing.name_en,
            "name_ar": ing.name_ar,
            "base_unit_code": bu.code if bu else "",
            "package_conversion_factor": str(ing.package_conversion_factor) if ing.package_conversion_factor else None,
        })

    def delete(self, request, pk):
        ing = Ingredient.objects.filter(id=pk).first()
        if not ing:
            return response.Response({"detail": "Not found"}, status=404)
        ing.is_active = False
        ing.save()
        return response.Response(status=status.HTTP_204_NO_CONTENT)


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


class ProfitSummaryView(views.APIView):
    """
    Profit summary: Total Sales, COGS, Gross Profit.
    Query params: branch_id or branch_ids, date_from, date_to. Optional: brands.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from datetime import datetime
        from org.models import Branch

        branch_id = request.query_params.get("branch_id")
        branch_ids_param = request.query_params.get("branch_ids")
        brands_param = request.query_params.get("brands")
        date_from_s = request.query_params.get("date_from")
        date_to_s = request.query_params.get("date_to")

        branch_ids = None
        brand_ids = None

        if branch_ids_param:
            try:
                branch_ids = [int(x.strip()) for x in branch_ids_param.split(",") if x.strip()]
            except (TypeError, ValueError):
                pass
        elif branch_id:
            try:
                branch_ids = [int(branch_id)]
            except (TypeError, ValueError):
                pass

        if brands_param:
            from org.models import Brand
            slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
            if slugs:
                brand_ids = list(Brand.objects.filter(slug__in=slugs).values_list("id", flat=True))

        if not branch_ids and not brand_ids:
            branch_ids = list(Branch.objects.filter(is_active=True).values_list("id", flat=True)[:50])

        today = datetime.now().date()
        try:
            date_from = datetime.strptime(date_from_s or "", "%Y-%m-%d").date() if date_from_s else today
        except ValueError:
            date_from = today
        try:
            date_to = datetime.strptime(date_to_s or "", "%Y-%m-%d").date() if date_to_s else today
        except ValueError:
            date_to = today

        result = get_profit_summary(
            branch_ids=branch_ids,
            date_from=date_from,
            date_to=date_to,
            brand_ids=brand_ids if not branch_ids else None,
        )
        return response.Response(result)


class WasteReportView(views.APIView):
    """
    Waste log: GET list by date (optional branch_id for theoretical from Prep List).
    POST to save. Query params: date, branch_id.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from collections import defaultdict
        from datetime import datetime
        from imports.models import ProductSale

        date_s = request.query_params.get("date")
        branch_id = request.query_params.get("branch_id")

        try:
            log_date = datetime.strptime(date_s or "", "%Y-%m-%d").date() if date_s else datetime.now().date()
        except ValueError:
            log_date = datetime.now().date()

        # If branch_id: compute theoretical from ProductSale (Prep List source) for that date
        theoretical_by_ingredient = {}
        if branch_id:
            try:
                bid = int(branch_id)
                qs = ProductSale.objects.filter(
                    branch_id=bid,
                    date=log_date,
                ).exclude(
                    Q(product_name__icontains="total")
                    | Q(product_name__icontains="المجموع")
                    | Q(product_sku__icontains="total")
                )
                sku_to_qty = defaultdict(int)
                for r in qs.values("product_sku", "qty"):
                    sku = (r.get("product_sku") or "").strip()
                    if sku:
                        sku_to_qty[sku] += int(float(r.get("qty") or 0))
                from inventory.services import explode_recipe_requirements
                reqs = explode_recipe_requirements(dict(sku_to_qty))
                for r in reqs:
                    theoretical_by_ingredient[r.ingredient_id] = theoretical_by_ingredient.get(
                        r.ingredient_id, Decimal("0")
                    ) + r.qty
            except (ValueError, TypeError):
                pass

        qs = WasteLog.objects.filter(date=log_date).select_related("ingredient", "ingredient__base_unit")
        seen_ids = set()
        out = []
        for wl in qs:
            seen_ids.add(wl.ingredient_id)
            theo = theoretical_by_ingredient.get(wl.ingredient_id, wl.theoretical_usage)
            out.append({
                "id": wl.id,
                "ingredient_id": wl.ingredient_id,
                "ingredient_name": wl.ingredient.name_en,
                "ingredient_name_ar": wl.ingredient.name_ar or "",
                "serial_code": wl.ingredient.serial_code or "",
                "date": wl.date.isoformat(),
                "theoretical_usage": str(theo),
                "actual_usage": str(wl.actual_usage),
                "variance": str(wl.variance) if wl.variance is not None else None,
            })

        # Include ingredients from theoretical that have no WasteLog yet
        for ing_id, theo in theoretical_by_ingredient.items():
            if ing_id in seen_ids:
                continue
            ing = Ingredient.objects.filter(id=ing_id).select_related("base_unit").first()
            if ing:
                out.append({
                    "id": None,
                    "ingredient_id": ing_id,
                    "ingredient_name": ing.name_en,
                    "ingredient_name_ar": ing.name_ar or "",
                    "serial_code": ing.serial_code or "",
                    "date": log_date.isoformat(),
                    "theoretical_usage": str(theo),
                    "actual_usage": "0",
                    "variance": None,
                })

        out.sort(key=lambda x: (x["ingredient_name"], x["ingredient_id"]))
        return response.Response({"entries": out, "date": log_date.isoformat()})

    def post(self, request):
        from datetime import datetime

        data = request.data
        date_s = data.get("date")
        entries = data.get("entries") or []

        try:
            log_date = datetime.strptime(date_s or "", "%Y-%m-%d").date() if date_s else datetime.now().date()
        except ValueError:
            log_date = datetime.now().date()

        saved = 0
        for e in entries:
            ing_id = e.get("ingredient_id")
            theoretical = Decimal(str(e.get("theoretical_usage") or 0))
            actual = Decimal(str(e.get("actual_usage") or 0))

            if not ing_id or not Ingredient.objects.filter(id=ing_id).exists():
                continue

            if theoretical > 0:
                var_pct = float((actual - theoretical) / theoretical * 100)
            else:
                var_pct = 0.0 if actual == 0 else 100.0

            WasteLog.objects.update_or_create(
                ingredient_id=ing_id,
                date=log_date,
                defaults={
                    "theoretical_usage": theoretical,
                    "actual_usage": actual,
                    "variance": round(Decimal(str(var_pct)), 2),
                },
            )
            saved += 1

        return response.Response({"saved": saved, "date": log_date.isoformat()}, status=status.HTTP_201_CREATED)
