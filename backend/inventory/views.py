from django.db.models import Q
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from decimal import Decimal

from rest_framework import permissions, response, status, views
from rest_framework.exceptions import PermissionDenied

from core.permissions import can_view_cost_price, get_user_scope
from analytics.views import _apply_branch_scope
from org.models import Branch
from inventory.models import (
    BranchStock,
    FoodicsProduct,
    Ingredient,
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


def _coerce_bool(value, default: bool = True) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"1", "true", "yes", "on"}:
            return True
        if v in {"0", "false", "no", "off"}:
            return False
    return bool(value)


def _resolve_default_display_unit(value: str | None, package_name_en: str = "", package_name_ar: str = "") -> str | None:
    if value is None:
        return None
    v = str(value).strip().lower()
    if v in ("base", "package"):
        return v
    aliases = {
        str(package_name_en or "").strip().lower(),
        str(package_name_ar or "").strip().lower(),
        "pkg",
        "pack",
        "package_unit",
        "added_unit",
    }
    if v and v in aliases:
        return "package"
    return None


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
        try:
            parsed_pkg_factor = Decimal(str(pkg_factor)) if pkg_factor else None
        except Exception:
            return response.Response({"detail": "Invalid package_conversion_factor"}, status=400)
        pkg_name_en = (data.get("package_name_en") or "").strip()
        pkg_name_ar = (data.get("package_name_ar") or "").strip()
        package_is_active = _coerce_bool(data.get("package_is_active", True), default=True)
        default_display_unit = _resolve_default_display_unit(
            data.get("default_display_unit"),
            package_name_en=pkg_name_en,
            package_name_ar=pkg_name_ar,
        )
        if default_display_unit is None:
            default_display_unit = "base"
        has_active_package = (
            parsed_pkg_factor is not None
            and parsed_pkg_factor > 0
            and package_is_active
        )
        if default_display_unit == "package" and not has_active_package:
            default_display_unit = "base"
        ing = Ingredient.objects.create(
            name_en=name_en,
            name_ar=name_ar,
            base_unit=base_unit,
            serial_code=serial_code,
            system_group=system_group,
            package_conversion_factor=parsed_pkg_factor,
            package_name_en=pkg_name_en or "",
            package_name_ar=pkg_name_ar or "",
            package_is_active=package_is_active,
            default_display_unit=default_display_unit,
        )
        return response.Response({
            "id": ing.id,
            "serial_code": ing.serial_code,
            "name_en": ing.name_en,
            "name_ar": ing.name_ar,
            "system_code": ing.system_code,
            "base_unit_code": ing.base_unit.code,
            "default_display_unit": ing.default_display_unit,
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
        })

    def patch(self, request, pk):
        ing = Ingredient.objects.filter(id=pk).first()
        if not ing:
            return response.Response({"detail": "Not found"}, status=404)
        data = request.data
        requested_default_display_unit = None
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
            try:
                new_factor = Decimal(str(val)) if val else None
            except Exception:
                return response.Response({"detail": "Invalid package_conversion_factor"}, status=400)
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
            ing.package_is_active = _coerce_bool(data.get("package_is_active", True), default=True)
        if "default_display_unit" in data:
            vs = _resolve_default_display_unit(
                data.get("default_display_unit"),
                package_name_en=ing.package_name_en,
                package_name_ar=ing.package_name_ar,
            )
            if vs in ("base", "package"):
                requested_default_display_unit = vs
                ing.default_display_unit = vs
        has_active_package = (
            bool(ing.package_conversion_factor and ing.package_conversion_factor > 0)
            and bool(getattr(ing, "package_is_active", True))
        )
        if requested_default_display_unit == "package":
            if not has_active_package:
                return response.Response(
                    {
                        "detail": "invalid_default_display_unit",
                        "message": "Package default requires active package and conversion factor > 0.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Force update when package is active and conversion factor is valid.
            ing.default_display_unit = "package"
        if ing.default_display_unit == "package" and not has_active_package:
            ing.default_display_unit = "base"
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
