from django.db.models import Q
from decimal import Decimal

from rest_framework import permissions, response, status, views
from rest_framework.exceptions import PermissionDenied

from core.pagination import paginate_queryset
from core.permissions import can_view_cost_price, get_user_scope
from analytics.views import _apply_branch_scope
from org.models import Branch
from inventory.models import (
    BranchStock,
    FoodicsProduct,
    Ingredient,
    IngredientPackage,
    Recipe,
    RecipeLine,
    StockMovement,
    StockTransfer,
    StockTransferLine,
    StockTransferStatus,
    Unit,
    WasteLog,
)
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


class ProductionPlanView(views.APIView):
    """What-if: given branch + list of product quantities, return exploded ingredients with stock."""
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

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
        qs = (
            Ingredient.objects.filter(is_active=True)
            .select_related("base_unit")
            .prefetch_related("packages")
            .order_by("name_en")
        )
        if system_group and system_group in ("raw_materials", "packaging", "other"):
            qs = qs.filter(system_group=system_group)
        ing_ids_with_movements = set(
            StockMovement.objects.values_list("ingredient_id", flat=True).distinct()
        )
        ing_ids_with_transfers = set(
            StockTransferLine.objects.values_list("ingredient_id", flat=True).distinct()
        )
        all_with_transactions = ing_ids_with_movements | ing_ids_with_transfers
        out = []
        for ing in qs:
            bu = ing.base_unit
            pkgs = list(ing.packages.all())
            packages_data = [{
                "id": p.id,
                "name_en": p.name_en,
                "name_ar": p.name_ar,
                "conversion_factor": str(p.conversion_factor),
                "is_active": p.is_active,
                "is_default": p.is_default,
                "sort_order": p.sort_order,
            } for p in pkgs]
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
                "package_is_active": getattr(ing, "package_is_active", True),
                "default_display_unit": getattr(ing, "default_display_unit", "base"),
                "has_transactions": ing.id in all_with_transactions,
                "unit_cost": str(ing.unit_cost) if ing.unit_cost is not None else None,
                "packages": packages_data,
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
        default_display_unit = data.get("default_display_unit", "base")
        if default_display_unit not in ("base", "package"):
            default_display_unit = "base"
        raw_unit_cost = data.get("unit_cost")
        unit_cost_val = Decimal(str(raw_unit_cost)) if raw_unit_cost is not None and str(raw_unit_cost).strip() else None
        ing = Ingredient.objects.create(
            name_en=name_en,
            name_ar=name_ar,
            base_unit=base_unit,
            serial_code=serial_code,
            system_group=system_group,
            package_conversion_factor=Decimal(str(pkg_factor)) if pkg_factor else None,
            package_name_en=pkg_name_en or "",
            package_name_ar=pkg_name_ar or "",
            default_display_unit=default_display_unit,
            unit_cost=unit_cost_val,
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
        has_transactions = (
            StockMovement.objects.filter(ingredient=ing).exists()
            or StockTransferLine.objects.filter(ingredient=ing).exists()
        )
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
            "package_is_active": getattr(ing, "package_is_active", True),
            "default_display_unit": getattr(ing, "default_display_unit", "base"),
            "has_transactions": has_transactions,
            "unit_cost": str(ing.unit_cost) if ing.unit_cost is not None else None,
            "packages": [{
                "id": p.id,
                "name_en": p.name_en,
                "name_ar": p.name_ar,
                "conversion_factor": str(p.conversion_factor),
                "is_active": p.is_active,
                "is_default": p.is_default,
                "sort_order": p.sort_order,
            } for p in ing.packages.order_by("sort_order", "id")],
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
            new_factor = Decimal(str(val)) if val else None
            if new_factor is None and (ing.package_conversion_factor or ing.package_name_en or ing.package_name_ar):
                has_trans = (
                    StockMovement.objects.filter(ingredient=ing).exists()
                    or StockTransferLine.objects.filter(ingredient=ing).exists()
                )
                if has_trans:
                    return response.Response(
                        {"detail": "has_transactions", "message": "لا يمكن حذف العبوة لوجود حركات مخزنية. يمكن إيقافها فقط."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            ing.package_conversion_factor = new_factor
            if new_factor is None:
                ing.package_name_en = ""
                ing.package_name_ar = ""
        if "package_name_en" in data:
            ing.package_name_en = str(data.get("package_name_en") or "").strip()
        if "package_name_ar" in data:
            ing.package_name_ar = str(data.get("package_name_ar") or "").strip()
        if "package_is_active" in data:
            ing.package_is_active = bool(data.get("package_is_active", True))
        if "default_display_unit" in data:
            v = data.get("default_display_unit")
            if v is not None:
                vs = str(v).strip().lower()
                if vs in ("base", "package"):
                    ing.default_display_unit = vs
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
            "default_display_unit": getattr(ing, "default_display_unit", "base"),
        })

    def delete(self, request, pk):
        ing = Ingredient.objects.filter(id=pk).first()
        if not ing:
            return response.Response({"detail": "Not found"}, status=404)
        ing.is_active = False
        ing.save()
        return response.Response(status=status.HTTP_204_NO_CONTENT)


class IngredientPackageListCreateView(views.APIView):
    """قائمة وإنشاء عبوات لصنف معين — يدعم عبوات متعددة."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, ingredient_id):
        ing = Ingredient.objects.filter(id=ingredient_id).first()
        if not ing:
            return response.Response({"detail": "Ingredient not found"}, status=404)
        pkgs = ing.packages.order_by("sort_order", "id")
        return response.Response([{
            "id": p.id,
            "name_en": p.name_en,
            "name_ar": p.name_ar,
            "conversion_factor": str(p.conversion_factor),
            "is_active": p.is_active,
            "is_default": p.is_default,
            "sort_order": p.sort_order,
        } for p in pkgs])

    def post(self, request, ingredient_id):
        ing = Ingredient.objects.filter(id=ingredient_id).first()
        if not ing:
            return response.Response({"detail": "Ingredient not found"}, status=404)
        data = request.data
        name_en = (data.get("name_en") or "").strip()
        name_ar = (data.get("name_ar") or "").strip()
        factor = data.get("conversion_factor")
        if not name_en or not factor:
            return response.Response(
                {"detail": "name_en and conversion_factor are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            factor_val = Decimal(str(factor))
            if factor_val <= 0:
                raise ValueError
        except (Exception,):
            return response.Response({"detail": "conversion_factor must be a positive number"}, status=400)
        is_default = bool(data.get("is_default", False))
        if is_default:
            ing.packages.update(is_default=False)
        pkg = IngredientPackage.objects.create(
            ingredient=ing,
            name_en=name_en,
            name_ar=name_ar,
            conversion_factor=factor_val,
            is_active=data.get("is_active", True),
            is_default=is_default,
            sort_order=data.get("sort_order", 0),
        )
        return response.Response({
            "id": pkg.id,
            "name_en": pkg.name_en,
            "name_ar": pkg.name_ar,
            "conversion_factor": str(pkg.conversion_factor),
            "is_active": pkg.is_active,
            "is_default": pkg.is_default,
            "sort_order": pkg.sort_order,
        }, status=status.HTTP_201_CREATED)


class IngredientPackageDetailView(views.APIView):
    """تعديل / حذف / تعيين كافتراضي — عبوة صنف."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, ingredient_id, pk):
        pkg = IngredientPackage.objects.filter(id=pk, ingredient_id=ingredient_id).first()
        if not pkg:
            return response.Response({"detail": "Package not found"}, status=404)
        data = request.data
        if "name_en" in data:
            pkg.name_en = (data["name_en"] or "").strip() or pkg.name_en
        if "name_ar" in data:
            pkg.name_ar = (data.get("name_ar") or "").strip()
        if "conversion_factor" in data and data["conversion_factor"]:
            try:
                pkg.conversion_factor = Decimal(str(data["conversion_factor"]))
            except (Exception,):
                pass
        if "is_active" in data:
            pkg.is_active = bool(data["is_active"])
        if "is_default" in data and data["is_default"]:
            pkg.ingredient.packages.exclude(id=pkg.id).update(is_default=False)
            pkg.is_default = True
        if "sort_order" in data:
            pkg.sort_order = int(data.get("sort_order", 0))
        pkg.save()
        return response.Response({
            "id": pkg.id,
            "name_en": pkg.name_en,
            "name_ar": pkg.name_ar,
            "conversion_factor": str(pkg.conversion_factor),
            "is_active": pkg.is_active,
            "is_default": pkg.is_default,
            "sort_order": pkg.sort_order,
        })

    def delete(self, request, ingredient_id, pk):
        pkg = IngredientPackage.objects.filter(id=pk, ingredient_id=ingredient_id).first()
        if not pkg:
            return response.Response({"detail": "Package not found"}, status=404)
        pkg.delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)


class ProductCatalogUploadView(views.APIView):
    """
    Upload Product Catalog (Saif format) [Ref: 132745].
    Headers: المنتج, الوحدة, كود تعريف المنتج, السعر غير شامل الضريبة.
    Creates/updates Products (final items sold). Ingredients uploaded separately.
    """
    permission_classes = [permissions.IsAuthenticated]

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
    [Ref: Audit] فلترة حسب صلاحيات المستخدم – لا يرى سوى الفروع المخصصة له.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import datetime
        from org.models import Branch, Brand

        branch_id = request.query_params.get("branch_id")
        branch_ids_param = request.query_params.get("branch_ids")
        brands_param = request.query_params.get("brands")
        date_from_s = request.query_params.get("date_from")
        date_to_s = request.query_params.get("date_to")

        branch_qs = Branch.objects.filter(is_active=True).order_by("name")
        brand_ids = None

        if branch_ids_param:
            try:
                ids = [int(x.strip()) for x in branch_ids_param.split(",") if x.strip()]
                if ids:
                    branch_qs = branch_qs.filter(id__in=ids)
            except (TypeError, ValueError):
                pass
        elif branch_id:
            try:
                branch_qs = branch_qs.filter(id=int(branch_id))
            except (TypeError, ValueError):
                pass

        if brands_param:
            slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
            if slugs:
                brand_ids = list(Brand.objects.filter(slug__in=slugs).values_list("id", flat=True))
                if brand_ids:
                    branch_qs = branch_qs.filter(brand_id__in=brand_ids)

        if not (branch_ids_param or branch_id or brands_param):
            branch_qs = branch_qs[:50]

        branch_qs = _apply_branch_scope(request, branch_qs)
        branch_ids = list(branch_qs.values_list("id", flat=True))

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
        if not can_view_cost_price(request.user):
            result = {
                "total_sales": result.get("total_sales", "0"),
                "total_cogs": None,
                "gross_profit": None,
                "ingredients_with_cost": [],
                "flagged_for_review": [],
                **({"error": result["error"]} if "error" in result else {}),
            }
        return response.Response(result)


class WasteReportView(views.APIView):
    """
    Waste log: GET list by date (optional branch_id for theoretical from Prep List).
    POST to save. Query params: date, branch_id.
    """
    permission_classes = [permissions.IsAuthenticated]

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
        if branch_id:
            try:
                qs = qs.filter(branch_id=int(branch_id))
            except (ValueError, TypeError):
                pass
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

        branch_id = data.get("branch_id")
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
                branch_id=branch_id,
                defaults={
                    "theoretical_usage": theoretical,
                    "actual_usage": actual,
                    "variance": round(Decimal(str(var_pct)), 2),
                },
            )
            saved += 1

        return response.Response({"saved": saved, "date": log_date.isoformat()}, status=status.HTTP_201_CREATED)


class CentralKitchenTransfersView(views.APIView):
    """شاشة المطبخ المركزي – طلبات التحويل الواردة من الفروع."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        central_branches = Branch.objects.filter(
            is_central_kitchen=True, is_active=True
        )
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None:
            central_branches = central_branches.filter(id__in=scope["branch_ids"])
        central_ids = list(central_branches.values_list("id", flat=True))
        if not central_ids:
            return response.Response({"transfers": []})

        qs = StockTransfer.objects.filter(
            to_branch_id__in=central_ids,
            status=StockTransferStatus.PENDING,
        ).select_related(
            "from_branch", "to_branch", "requested_by"
        ).prefetch_related("lines__ingredient").order_by("-requested_at")[:50]

        out = []
        for t in qs:
            lines = [
                {
                    "ingredient_id": l.ingredient_id,
                    "ingredient_name": l.ingredient.name_en,
                    "qty": str(l.qty),
                }
                for l in t.lines.all()
            ]
            out.append({
                "id": t.id,
                "uuid": str(t.uuid),
                "from_branch_id": t.from_branch_id,
                "from_branch_name": t.from_branch.name,
                "from_branch_name_ar": t.from_branch.name_ar or "",
                "to_branch_id": t.to_branch_id,
                "to_branch_name": t.to_branch.name,
                "status": t.status,
                "requested_at": t.requested_at.isoformat() if t.requested_at else None,
                "requested_by": t.requested_by.username if t.requested_by else None,
                "lines": lines,
                "notes": t.notes or "",
            })
        return response.Response({"transfers": out})


class StockTransferListCreateView(views.APIView):
    """قائمة طلبات التحويل بين الفروع."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from inventory.transfer_services import notify_stale_transfers_if_any
        notify_stale_transfers_if_any()
        scope = get_user_scope(request.user)
        qs = StockTransfer.objects.select_related(
            "from_branch", "to_branch", "requested_by", "confirmed_by"
        ).prefetch_related("lines__ingredient")
        if scope["branch_ids"] is not None:
            qs = qs.filter(
                Q(from_branch_id__in=scope["branch_ids"])
                | Q(to_branch_id__in=scope["branch_ids"])
            )
        from_branch = request.query_params.get("from_branch")
        to_branch = request.query_params.get("to_branch")
        status_filter = request.query_params.get("status")
        if from_branch:
            try:
                qs = qs.filter(from_branch_id=int(from_branch))
            except (ValueError, TypeError):
                pass
        if to_branch:
            try:
                qs = qs.filter(to_branch_id=int(to_branch))
            except (ValueError, TypeError):
                pass
        if status_filter:
            qs = qs.filter(status=status_filter)
        qs = qs.order_by("-requested_at")[:100]
        out = []
        for t in qs:
            lines = [
                {
                    "ingredient_id": l.ingredient_id,
                    "ingredient_name": l.ingredient.name_en,
                    "qty": str(l.qty),
                }
                for l in t.lines.all()
            ]
            out.append({
                "id": t.id,
                "uuid": str(t.uuid),
                "from_branch_id": t.from_branch_id,
                "from_branch_name": t.from_branch.name,
                "to_branch_id": t.to_branch_id,
                "to_branch_name": t.to_branch.name,
                "status": t.status,
                "requested_at": t.requested_at.isoformat() if t.requested_at else None,
                "confirmed_at": t.confirmed_at.isoformat() if t.confirmed_at else None,
                "lines": lines,
                "notes": t.notes or "",
            })
        return response.Response({"transfers": out})

    def post(self, request):
        from_branch_id = request.data.get("from_branch_id")
        to_branch_id = request.data.get("to_branch_id")
        lines = request.data.get("lines") or []
        notes = request.data.get("notes", "")
        if not from_branch_id or not to_branch_id:
            return response.Response(
                {"detail": "from_branch_id and to_branch_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if from_branch_id == to_branch_id:
            return response.Response(
                {"detail": "الفرع المرسل والمستلم يجب أن يكونا مختلفين"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from_branch_id = int(from_branch_id)
            to_branch_id = int(to_branch_id)
        except (TypeError, ValueError):
            return response.Response({"detail": "Invalid branch IDs"}, status=400)
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None and from_branch_id not in (scope["branch_ids"] or []):
            raise PermissionDenied("لا يمكنك إنشاء تحويل من فرع غير معين لك")
        valid_lines = []
        for L in lines:
            ing_id = L.get("ingredient_id")
            qty = L.get("qty")
            if not ing_id or not qty:
                continue
            try:
                qty_val = Decimal(str(qty))
                if qty_val <= 0:
                    continue
            except Exception:
                continue
            if not Ingredient.objects.filter(pk=int(ing_id)).exists():
                continue
            valid_lines.append((int(ing_id), qty_val))
        if not valid_lines:
            return response.Response(
                {"detail": "يجب إضافة سطر واحد على الأقل (ingredient_id, qty)"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.db import transaction
        from org.models import Branch

        try:
            Branch.objects.get(pk=from_branch_id)
            Branch.objects.get(pk=to_branch_id)
        except Branch.DoesNotExist:
            return response.Response({"detail": "Branch not found"}, status=404)

        from core.error_logging import log_system_error
        from inventory.transfer_services import process_transfer_departure

        try:
            with transaction.atomic():
                transfer = StockTransfer.objects.create(
                    from_branch_id=from_branch_id,
                    to_branch_id=to_branch_id,
                    status=StockTransferStatus.PENDING,
                    requested_by=request.user,
                    notes=notes,
                )
                for ing_id, qty in valid_lines:
                    StockTransferLine.objects.create(
                        transfer=transfer,
                        ingredient_id=ing_id,
                        qty=qty,
                    )
                process_transfer_departure(transfer)
        except Exception as e:
            log_system_error(
                "transfer_failed",
                str(e),
                user=request.user,
                context={"from_branch_id": from_branch_id, "to_branch_id": to_branch_id},
                exc=e,
            )
            return response.Response(
                {"detail": str(e)[:500]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return response.Response(
            {"id": transfer.id, "uuid": str(transfer.uuid), "status": transfer.status},
            status=status.HTTP_201_CREATED,
        )


class StockTransferConfirmView(views.APIView):
    """تأكيد استلام التحويل."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, uuid):
        try:
            transfer = StockTransfer.objects.get(uuid=uuid)
        except StockTransfer.DoesNotExist:
            return response.Response({"detail": "Transfer not found"}, status=404)
        if transfer.status == StockTransferStatus.CONFIRMED:
            return response.Response(
                {"detail": "التحويل مؤكد مسبقاً"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None:
            if transfer.to_branch_id not in (scope["branch_ids"] or []):
                raise PermissionDenied("لا يمكنك تأكيد تحويل لفرع غير معين لك")
        from core.error_logging import log_system_error
        from inventory.transfer_services import confirm_transfer

        try:
            confirm_transfer(transfer, confirmed_by=request.user)
        except Exception as e:
            log_system_error("transfer_failed", str(e), user=request.user, context={"transfer_id": transfer.id}, exc=e)
            raise
        return response.Response({"status": "confirmed", "id": transfer.id, "uuid": str(transfer.uuid)})


class StockTransferRejectView(views.APIView):
    """رفض استلام التحويل – عكس الحركة من قيد النقل إلى الفرع المرسل."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, uuid):
        try:
            transfer = StockTransfer.objects.get(uuid=uuid)
        except StockTransfer.DoesNotExist:
            return response.Response({"detail": "Transfer not found"}, status=404)
        if transfer.status != StockTransferStatus.PENDING:
            return response.Response(
                {"detail": "لا يمكن رفض تحويل مؤكد أو مرفوض مسبقاً"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None:
            if transfer.to_branch_id not in (scope["branch_ids"] or []):
                raise PermissionDenied("لا يمكنك رفض تحويل لفرع غير معين لك")
        from core.error_logging import log_system_error
        from inventory.transfer_services import reject_transfer

        try:
            reject_transfer(transfer, rejected_by=request.user)
        except ValueError as e:
            return response.Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            log_system_error("transfer_failed", str(e), user=request.user, context={"transfer_id": transfer.id}, exc=e)
            raise
        return response.Response({"status": "rejected", "id": transfer.id, "uuid": str(transfer.uuid)})


class FoodicsProductSearchView(views.APIView):
    """بحث عن منتجات Foodics بالاسم أو الـ SKU — يُستخدم في التنبؤ اليدوي للشراء."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 1:
            # Return all active products (up to 100) when no query
            qs = FoodicsProduct.objects.filter(is_active=True).order_by("name")[:100]
        else:
            qs = FoodicsProduct.objects.filter(is_active=True).filter(
                Q(name__icontains=q) | Q(foodics_product_id__icontains=q)
            ).order_by("name")[:40]

        return response.Response({
            "products": [
                {"id": p.id, "sku": p.foodics_product_id, "name": p.name}
                for p in qs
            ]
        })


class ProductListView(views.APIView):
    """قائمة جميع المنتجات مع معلوماتها الأساسية وعدد مكونات الوصفة."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        active_filter = request.query_params.get("active")  # "true" / "false" / None

        qs = FoodicsProduct.objects.select_related("sales_unit").prefetch_related(
            "recipe__lines__ingredient__base_unit",
            "recipe__lines__unit",
            "recipe__lines__ingredient__packages",
        ).order_by("name")

        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(foodics_product_id__icontains=q))
        if active_filter == "true":
            qs = qs.filter(is_active=True)
        elif active_filter == "false":
            qs = qs.filter(is_active=False)

        out = []
        for p in qs:
            try:
                recipe = p.recipe
                has_recipe = True
                lines_list = recipe.lines.all()
                recipe_lines_count = len(lines_list)

                # Calculate total production cost using prefetched data
                total_cost = Decimal("0")
                has_any_cost = False
                for line in lines_list:
                    ing = line.ingredient
                    if ing.unit_cost is not None:
                        try:
                            recipe_unit_code = line.unit.code if line.unit else ""
                            base_unit_code = ing.base_unit.code if ing.base_unit else ""
                            if recipe_unit_code == base_unit_code:
                                factor = Decimal("1")
                            else:
                                factor = Decimal("1")
                                for pkg in ing.packages.all():
                                    if pkg.is_active and pkg.conversion_factor:
                                        factor = Decimal(str(pkg.conversion_factor))
                                        break
                            total_cost += line.qty * factor * ing.unit_cost
                            has_any_cost = True
                        except Exception:
                            pass

                cost_str = str(total_cost.quantize(Decimal("0.01"))) if has_any_cost else None
            except Exception:
                has_recipe = False
                recipe_lines_count = 0
                cost_str = None

            out.append({
                "id": p.id,
                "sku": p.foodics_product_id,
                "name": p.name,
                "is_active": p.is_active,
                "price_excl_tax": str(p.price_excl_tax) if p.price_excl_tax else None,
                "sales_unit": p.sales_unit.code if p.sales_unit else None,
                "has_recipe": has_recipe,
                "recipe_lines_count": recipe_lines_count,
                "total_cost": cost_str,
            })

        return response.Response({"products": out, "count": len(out)})


class ProductDetailView(views.APIView):
    """تفاصيل منتج واحد مع مكونات وصفته الكاملة."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            product = FoodicsProduct.objects.select_related(
                "sales_unit",
                "recipe__yield_unit",
            ).prefetch_related(
                "recipe__lines__ingredient__base_unit",
                "recipe__lines__unit",
            ).get(pk=pk)
        except FoodicsProduct.DoesNotExist:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        result = {
            "id": product.id,
            "sku": product.foodics_product_id,
            "name": product.name,
            "is_active": product.is_active,
            "price_excl_tax": str(product.price_excl_tax) if product.price_excl_tax else None,
            "sales_unit": product.sales_unit.code if product.sales_unit else None,
            "created_at": product.created_at.isoformat() if product.created_at else None,
            "updated_at": product.updated_at.isoformat() if product.updated_at else None,
            "recipe": None,
        }

        if hasattr(product, "recipe"):
            recipe = product.recipe
            lines = []
            total_cost = Decimal("0")
            has_any_cost = False

            for line in recipe.lines.all().order_by("ingredient__name_en"):
                ing = line.ingredient
                qty = line.qty

                # Calculate line cost: qty (in recipe unit) × unit_cost (per base unit)
                # If recipe unit == base unit, factor=1; else use conversion via base unit
                line_cost = None
                line_cost_str = None
                if ing.unit_cost is not None:
                    # unit_cost is per base unit; qty in recipe may be in a different unit
                    # Attempt simple calculation: assume recipe qty is in base unit unless
                    # we can find conversion factor
                    try:
                        recipe_unit_code = line.unit.code if line.unit else ""
                        base_unit_code = ing.base_unit.code if ing.base_unit else ""
                        if recipe_unit_code == base_unit_code:
                            factor = Decimal("1")
                        else:
                            # Try to find conversion via IngredientPackage
                            factor = Decimal("1")
                            from inventory.models import IngredientPackage
                            pkg = IngredientPackage.objects.filter(
                                ingredient=ing, is_active=True
                            ).first()
                            if pkg and pkg.conversion_factor:
                                factor = Decimal(str(pkg.conversion_factor))

                        line_cost = (qty * factor * ing.unit_cost).quantize(Decimal("0.0001"))
                        total_cost += line_cost
                        has_any_cost = True
                        line_cost_str = str(line_cost)
                    except Exception:
                        line_cost_str = None

                lines.append({
                    "ingredient_id": ing.id,
                    "ingredient_name": ing.name_en or "",
                    "ingredient_name_ar": ing.name_ar or "",
                    "serial_code": ing.serial_code or "",
                    "qty": str(qty),
                    "unit_code": line.unit.code if line.unit else "",
                    "unit_label": (line.unit.name_en or line.unit.code) if line.unit else "",
                    "unit_label_ar": (line.unit.name_ar or line.unit.name_en or line.unit.code) if line.unit else "",
                    "base_unit_code": ing.base_unit.code if ing.base_unit else "",
                    "unit_cost": str(ing.unit_cost) if ing.unit_cost is not None else None,
                    "line_cost": line_cost_str,
                })

            result["recipe"] = {
                "id": recipe.id,
                "yield_qty": str(recipe.yield_qty),
                "yield_unit": recipe.yield_unit.code if recipe.yield_unit else "",
                "lines_count": len(lines),
                "lines": lines,
                "total_cost": str(total_cost.quantize(Decimal("0.01"))) if has_any_cost else None,
                "has_cost_data": has_any_cost,
            }

            # Profit margin if selling price and cost both known
            if has_any_cost and product.price_excl_tax and total_cost > 0:
                selling = Decimal(str(product.price_excl_tax))
                profit = selling - total_cost
                margin_pct = (profit / selling * 100).quantize(Decimal("0.1")) if selling > 0 else None
                result["recipe"]["profit_margin"] = str(margin_pct) if margin_pct is not None else None
                result["recipe"]["profit_amount"] = str(profit.quantize(Decimal("0.01")))
            else:
                result["recipe"]["profit_margin"] = None
                result["recipe"]["profit_amount"] = None

        return response.Response(result)


# ─── Recipe Line CRUD ──────────────────────────────────────────────────────────

def _build_line_response(line: "RecipeLine") -> dict:
    """Serialize a single RecipeLine for API response (reuses ProductDetailView logic)."""
    ing = line.ingredient
    qty = line.qty
    line_cost_str = None

    if ing.unit_cost is not None:
        try:
            recipe_unit_code = line.unit.code if line.unit else ""
            base_unit_code = ing.base_unit.code if ing.base_unit else ""
            if recipe_unit_code == base_unit_code:
                factor = Decimal("1")
            else:
                factor = Decimal("1")
                pkg = IngredientPackage.objects.filter(ingredient=ing, is_active=True).first()
                if pkg and pkg.conversion_factor:
                    factor = Decimal(str(pkg.conversion_factor))
            line_cost = qty * factor * ing.unit_cost
            line_cost_str = str(line_cost.quantize(Decimal("0.0001")))
        except Exception:
            line_cost_str = None

    return {
        "id": line.id,
        "ingredient_id": ing.id,
        "ingredient_name": ing.name_en or "",
        "ingredient_name_ar": ing.name_ar or "",
        "serial_code": ing.serial_code or "",
        "unit_code": line.unit.code if line.unit else "",
        "unit_label": line.unit.name_en if line.unit else "",
        "unit_label_ar": line.unit.name_ar if line.unit else "",
        "qty": str(qty),
        "unit_cost": str(ing.unit_cost) if ing.unit_cost is not None else None,
        "line_cost": line_cost_str,
    }


class ProductRecipeLinesView(views.APIView):
    """POST – add a new ingredient line to a product's recipe."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            product = FoodicsProduct.objects.get(pk=pk)
        except FoodicsProduct.DoesNotExist:
            return response.Response({"error": "Product not found"}, status=404)

        ingredient_id = request.data.get("ingredient_id")
        qty = request.data.get("qty")
        unit_code = request.data.get("unit_code")

        if not ingredient_id or not qty or not unit_code:
            return response.Response({"error": "ingredient_id, qty, unit_code are required"}, status=400)

        try:
            ing = Ingredient.objects.get(pk=ingredient_id)
        except Ingredient.DoesNotExist:
            return response.Response({"error": "Ingredient not found"}, status=404)

        try:
            unit = Unit.objects.get(code=unit_code)
        except Unit.DoesNotExist:
            return response.Response({"error": f"Unit '{unit_code}' not found"}, status=404)

        # Get or create the Recipe for this product
        recipe, _ = Recipe.objects.get_or_create(
            product=product,
            defaults={"yield_unit": unit},
        )

        # Create or update the line
        line, created = RecipeLine.objects.get_or_create(
            recipe=recipe,
            ingredient=ing,
            defaults={"qty": Decimal(str(qty)), "unit": unit},
        )
        if not created:
            line.qty = Decimal(str(qty))
            line.unit = unit
            line.save()

        return response.Response(_build_line_response(line), status=201 if created else 200)


class ProductRecipeLineDetailView(views.APIView):
    """PATCH / DELETE a single recipe line."""

    permission_classes = [permissions.IsAuthenticated]

    def _get_line(self, pk, line_id):
        try:
            line = RecipeLine.objects.select_related(
                "ingredient", "ingredient__base_unit", "unit", "recipe__product"
            ).get(id=line_id, recipe__product__id=pk)
            return line, None
        except RecipeLine.DoesNotExist:
            return None, response.Response({"error": "Line not found"}, status=404)

    def patch(self, request, pk, line_id):
        line, err = self._get_line(pk, line_id)
        if err:
            return err

        if "qty" in request.data:
            line.qty = Decimal(str(request.data["qty"]))

        if "unit_code" in request.data:
            try:
                line.unit = Unit.objects.get(code=request.data["unit_code"])
            except Unit.DoesNotExist:
                return response.Response({"error": "Unit not found"}, status=404)

        line.save()
        return response.Response(_build_line_response(line))

    def delete(self, request, pk, line_id):
        line, err = self._get_line(pk, line_id)
        if err:
            return err
        line.delete()
        return response.Response(status=204)


class StockBalanceReportView(views.APIView):
    """
    تقرير أرصدة المخزون الحالية — Stock Balance Report
    GET /inventory/stock-balance/
    يعرض كمية كل صنف في كل فرع مع قيمة المخزون وحالة الإنذار المبكر.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        qs = BranchStock.objects.select_related(
            "branch", "branch__brand", "ingredient", "ingredient__base_unit"
        ).order_by("branch__name", "ingredient__name_en")

        branch_id = request.query_params.get("branch_id")
        brand_id = request.query_params.get("brand_id")
        search = (request.query_params.get("search") or "").strip()
        low_stock_only = request.query_params.get("low_stock_only") == "1"

        if scope.get("brand_ids"):
            qs = qs.filter(branch__brand_id__in=scope["brand_ids"])
        elif brand_id:
            try:
                qs = qs.filter(branch__brand_id=int(brand_id))
            except (TypeError, ValueError):
                pass

        if scope.get("branch_ids"):
            qs = qs.filter(branch_id__in=scope["branch_ids"])
        elif branch_id:
            try:
                qs = qs.filter(branch_id=int(branch_id))
            except (TypeError, ValueError):
                pass

        if search:
            qs = qs.filter(
                Q(ingredient__name_en__icontains=search)
                | Q(ingredient__name_ar__icontains=search)
            )

        if low_stock_only:
            from django.db.models import F
            qs = qs.filter(on_hand__lte=F("reorder_level"))

        page_items, pagination = paginate_queryset(qs, request, page_size=50, max_page_size=100)
        rows = []
        total_value = Decimal("0")
        for bs in page_items:
            unit_cost = bs.ingredient.unit_cost if hasattr(bs.ingredient, "unit_cost") else None
            value = (bs.on_hand * unit_cost) if unit_cost else None
            if value:
                total_value += value
            is_low = bs.reorder_level > 0 and bs.on_hand <= bs.reorder_level
            rows.append({
                "id": bs.id,
                "branch_id": bs.branch_id,
                "branch_name": bs.branch.name,
                "brand_name": bs.branch.brand.name if bs.branch.brand else "",
                "ingredient_id": bs.ingredient_id,
                "ingredient_name_en": bs.ingredient.name_en,
                "ingredient_name_ar": bs.ingredient.name_ar or "",
                "unit_code": bs.ingredient.base_unit.code if bs.ingredient.base_unit else "",
                "on_hand": str(bs.on_hand),
                "reorder_level": str(bs.reorder_level),
                "unit_cost": str(unit_cost) if unit_cost is not None else None,
                "value": str(value) if value is not None else None,
                "is_low_stock": is_low,
            })

        return response.Response({
            "rows": rows,
            "total_count": pagination["count"],
            "total_value": str(total_value),
            "pagination": pagination,
        })


class StockMovementsReportView(views.APIView):
    """
    تقرير حركات المخزون — Stock Movements Report
    GET /inventory/stock-movements/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        from datetime import date, datetime as _dt

        branch_id = request.query_params.get("branch_id")
        brand_id = request.query_params.get("brand_id")
        ingredient_id = request.query_params.get("ingredient_id")
        movement_type = request.query_params.get("movement_type")
        date_from_str = request.query_params.get("date_from")
        date_to_str = request.query_params.get("date_to")
        search = (request.query_params.get("search") or "").strip()

        today = date.today()
        try:
            date_from = _dt.strptime(date_from_str, "%Y-%m-%d").date() if date_from_str else today
        except ValueError:
            date_from = today
        try:
            date_to = _dt.strptime(date_to_str, "%Y-%m-%d").date() if date_to_str else today
        except ValueError:
            date_to = today

        qs = StockMovement.objects.select_related(
            "branch", "branch__brand", "ingredient", "ingredient__base_unit"
        ).filter(
            created_at__date__gte=date_from,
            created_at__date__lte=date_to,
        ).order_by("-created_at")

        if scope.get("brand_ids"):
            qs = qs.filter(branch__brand_id__in=scope["brand_ids"])
        elif brand_id:
            try:
                qs = qs.filter(branch__brand_id=int(brand_id))
            except (TypeError, ValueError):
                pass

        if scope.get("branch_ids"):
            qs = qs.filter(branch_id__in=scope["branch_ids"])
        elif branch_id:
            try:
                qs = qs.filter(branch_id=int(branch_id))
            except (TypeError, ValueError):
                pass

        if ingredient_id:
            try:
                qs = qs.filter(ingredient_id=int(ingredient_id))
            except (TypeError, ValueError):
                pass

        if movement_type:
            qs = qs.filter(movement_type=movement_type)

        if search:
            qs = qs.filter(
                Q(ingredient__name_en__icontains=search)
                | Q(ingredient__name_ar__icontains=search)
                | Q(reference__icontains=search)
            )

        from inventory.models import StockMovementType
        type_labels_ar = {
            "purchase": "شراء",
            "adjustment": "تسوية",
            "depletion": "استهلاك",
            "transfer_out": "تحويل صادر",
            "transfer_in": "تحويل وارد",
        }

        rows = []
        for mv in qs[:2000]:
            rows.append({
                "id": mv.id,
                "branch_id": mv.branch_id,
                "branch_name": mv.branch.name,
                "brand_name": mv.branch.brand.name if mv.branch.brand else "",
                "ingredient_id": mv.ingredient_id,
                "ingredient_name_en": mv.ingredient.name_en,
                "ingredient_name_ar": mv.ingredient.name_ar or "",
                "unit_code": mv.ingredient.base_unit.code if mv.ingredient.base_unit else "",
                "movement_type": mv.movement_type,
                "movement_type_ar": type_labels_ar.get(mv.movement_type, mv.movement_type),
                "qty_delta": str(mv.qty_delta),
                "reference": mv.reference or "",
                "created_at": mv.created_at.isoformat() if mv.created_at else None,
            })

        total_in = sum(
            Decimal(r["qty_delta"]) for r in rows if Decimal(r["qty_delta"]) > 0
        )
        total_out = sum(
            Decimal(r["qty_delta"]) for r in rows if Decimal(r["qty_delta"]) < 0
        )

        return response.Response({
            "rows": rows,
            "total_count": len(rows),
            "total_in": str(total_in),
            "total_out": str(total_out),
            "date_from": str(date_from),
            "date_to": str(date_to),
        })


class IngredientCostUpdateView(views.APIView):
    """PATCH /ingredients/<pk>/cost/ – update only the unit_cost of an ingredient."""

    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            ing = Ingredient.objects.get(pk=pk)
        except Ingredient.DoesNotExist:
            return response.Response({"error": "Ingredient not found"}, status=404)

        raw_cost = request.data.get("unit_cost")
        if raw_cost is None:
            return response.Response({"error": "unit_cost is required"}, status=400)

        try:
            ing.unit_cost = Decimal(str(raw_cost)) if str(raw_cost).strip() else None
            ing.save(update_fields=["unit_cost"])
        except Exception as exc:
            return response.Response({"error": str(exc)}, status=400)

        return response.Response({
            "id": ing.id,
            "name_ar": ing.name_ar or "",
            "name_en": ing.name_en or "",
            "unit_cost": str(ing.unit_cost) if ing.unit_cost is not None else None,
        })


# ─── Recipe Costing API ────────────────────────────────────────────────────────

class RecipeCostView(views.APIView):
    """
    GET /api/inventory/recipes/<product_pk>/cost/

    Returns detailed cost breakdown for a product's recipe:
      - cost_per_serving: total ingredient cost (SAR)
      - ingredients_cost: same (raw without waste)
      - waste_cost: extra cost due to waste %
      - lines: per-ingredient breakdown
      - has_missing_costs: True if any ingredient lacks unit_cost
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, product_pk):
        try:
            recipe = Recipe.objects.prefetch_related(
                "lines__ingredient", "lines__unit"
            ).get(product_id=product_pk)
        except Recipe.DoesNotExist:
            return response.Response(
                {"detail": "Recipe not found for this product."},
                status=status.HTTP_404_NOT_FOUND,
            )

        lines_data = []
        total_raw_cost = Decimal("0.0000")
        total_waste_cost = Decimal("0.0000")
        has_missing_costs = False

        for line in recipe.lines.all():
            ing = line.ingredient
            unit_cost = ing.unit_cost or Decimal("0")
            if ing.unit_cost is None:
                has_missing_costs = True

            raw_cost = (line.qty * unit_cost).quantize(Decimal("0.0001"))
            effective_cost = line.actual_cost_per_serving
            waste_cost_line = (effective_cost - raw_cost).quantize(Decimal("0.0001"))

            total_raw_cost += effective_cost
            total_waste_cost += waste_cost_line

            lines_data.append({
                "ingredient_id": ing.pk,
                "ingredient_name": ing.name_en,
                "ingredient_name_ar": ing.name_ar,
                "qty": str(line.qty),
                "unit": line.unit.code,
                "waste_percentage": str(line.waste_percentage),
                "effective_qty": str(line.effective_qty.quantize(Decimal("0.0001"))),
                "unit_cost": str(unit_cost),
                "raw_cost": str(raw_cost),
                "waste_cost": str(waste_cost_line),
                "total_cost": str(effective_cost),
            })

        ingredients_cost = (total_raw_cost - total_waste_cost).quantize(Decimal("0.01"))
        cost_per_serving = total_raw_cost.quantize(Decimal("0.01"))
        waste_total = total_waste_cost.quantize(Decimal("0.01"))

        # Food cost % vs selling price
        product = recipe.product
        food_cost_pct = None
        if product.price_excl_tax and product.price_excl_tax > 0 and cost_per_serving > 0:
            food_cost_pct = float(
                (cost_per_serving / product.price_excl_tax * 100).quantize(Decimal("0.1"))
            )

        return response.Response({
            "product_id": product.pk,
            "product_name": product.name,
            "selling_price": str(product.price_excl_tax) if product.price_excl_tax else None,
            "cost_per_serving": str(cost_per_serving),
            "ingredients_cost": str(ingredients_cost),
            "waste": str(waste_total),
            "food_cost_pct": food_cost_pct,
            "has_missing_costs": has_missing_costs,
            "lines": lines_data,
        })
