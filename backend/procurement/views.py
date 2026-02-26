"""
Procurement API – طلبات الشراء، التنبؤ الذكي، بوابة الموردين.
"""
from datetime import datetime
from decimal import Decimal

from rest_framework import permissions, response, status, views
from rest_framework.exceptions import PermissionDenied

from core.permissions import get_user_scope

from procurement.purchase_suggestion_services import (
    get_purchase_suggestions,
    _get_default_package,
    _fmt_qty,
)
from procurement.supplier_invoice_services import post_supplier_invoice
from procurement.models import Supplier, SupplierInvoice, SupplierInvoiceStatus
from org.models import Branch
from inventory.models import BranchStock, Ingredient
from inventory.services import explode_recipe_requirements


class PurchaseSuggestionsView(views.APIView):
    """التنبؤ الذكي – اقتراح كميات الشراء بناءً على استهلاك الكاشير."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        branch_id = request.query_params.get("branch_id")
        horizon = request.query_params.get("horizon_days", "7")
        lookback = request.query_params.get("lookback_days", "90")
        if not branch_id:
            return response.Response(
                {"detail": "branch_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            branch_id = int(branch_id)
            horizon_days = int(horizon)
            lookback_days = int(lookback)
        except (TypeError, ValueError):
            return response.Response({"detail": "Invalid parameters"}, status=400)

        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None and branch_id not in (scope["branch_ids"] or []):
            raise PermissionDenied("لا يمكنك عرض اقتراحات فرع غير معين لك")

        try:
            suggestions = get_purchase_suggestions(
                branch_id=branch_id,
                horizon_days=horizon_days,
                lookback_days=lookback_days,
            )
        except Exception as e:
            return response.Response(
                {"detail": str(e)[:300]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return response.Response({"suggestions": suggestions})


class SupplierPortalInvoiceSubmitView(views.APIView):
    """
    بوابة الموردين – تسجيل فاتورة آلياً.
    المصادقة: Header X-Supplier-API-Key أو Authorization: Bearer <api_key>.
    """
    permission_classes = [permissions.AllowAny]

    def _get_supplier_from_request(self, request) -> Supplier | None:
        api_key = (
            request.headers.get("X-Supplier-API-Key")
            or request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        )
        if not api_key:
            return None
        return Supplier.objects.filter(
            portal_api_key=api_key, is_active=True
        ).select_related("brand").first()

    def post(self, request):
        supplier = self._get_supplier_from_request(request)
        if not supplier:
            return response.Response(
                {"detail": "Invalid or missing API key. Use X-Supplier-API-Key header."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        data = request.data or {}
        invoice_number = (data.get("invoice_number") or "").strip()
        invoice_date_s = data.get("invoice_date", "")
        total_amount = data.get("total_amount")
        branch_id = data.get("branch_id")
        goods_receipt_id = data.get("goods_receipt_id")
        notes = (data.get("notes") or "").strip()

        if not invoice_number:
            return response.Response(
                {"detail": "invoice_number is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if total_amount is None or total_amount == "":
            return response.Response(
                {"detail": "total_amount is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            total_amount = Decimal(str(total_amount))
        except Exception:
            return response.Response(
                {"detail": "total_amount must be a number"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if invoice_date_s:
            try:
                invoice_date = datetime.strptime(invoice_date_s, "%Y-%m-%d").date()
            except ValueError:
                return response.Response(
                    {"detail": "invoice_date must be YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            invoice_date = datetime.now().date()

        # Branch: required for standalone invoices
        branch = None
        if branch_id:
            try:
                branch = Branch.objects.filter(
                    id=int(branch_id), brand=supplier.brand, is_active=True
                ).first()
            except (TypeError, ValueError):
                pass
        if not branch and not goods_receipt_id:
            # Try first branch of brand
            branch = Branch.objects.filter(
                brand=supplier.brand, is_active=True
            ).first()
        if not branch:
            return response.Response(
                {"detail": "branch_id required or no branch for brand"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check duplicate
        if SupplierInvoice.objects.filter(
            supplier=supplier, invoice_number=invoice_number
        ).exists():
            return response.Response(
                {"detail": f"Invoice {invoice_number} already registered"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        goods_receipt = None
        if goods_receipt_id:
            from procurement.models import GoodsReceipt
            goods_receipt = GoodsReceipt.objects.filter(
                id=int(goods_receipt_id),
                purchase_order__supplier=supplier,
            ).first()
            if goods_receipt and goods_receipt.purchase_order.branch:
                branch = goods_receipt.purchase_order.branch

        inv = SupplierInvoice.objects.create(
            supplier=supplier,
            branch=branch,
            goods_receipt=goods_receipt,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            total_amount=total_amount,
            status=SupplierInvoiceStatus.DRAFT,
            notes=notes,
        )

        # Auto-post to AP
        auto_post = data.get("auto_post", True)
        if auto_post:
            try:
                post_supplier_invoice(inv)
            except Exception as e:
                return response.Response(
                    {"detail": f"Invoice saved but posting failed: {str(e)[:200]}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return response.Response(
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "status": inv.status,
                "journal_entry_id": inv.journal_entry_id,
                "message": "تم تسجيل الفاتورة" + (" وترحيلها للحسابات" if inv.status == "posted" else ""),
            },
            status=status.HTTP_201_CREATED,
        )


class ManualPurchaseForecastView(views.APIView):
    """التنبؤ اليدوي للشراء – يحسب احتياجات المواد الخام بناءً على مبيعات يدوية متوقعة."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        branch_id = request.data.get("branch_id")
        products = request.data.get("products", [])

        if not branch_id:
            return response.Response(
                {"detail": "branch_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not products:
            return response.Response({"ingredients": []})

        # Validate branch access
        scope = get_user_scope(request.user)
        allowed_branch_ids = scope.get("branch_ids")  # None = unrestricted (Owner/GM)
        if allowed_branch_ids is not None and int(branch_id) not in allowed_branch_ids:
            raise PermissionDenied("No access to this branch.")

        # Build expected_sales dict {sku: qty}
        expected_sales: dict[str, int] = {}
        for item in products:
            sku = str(item.get("sku") or "").strip()
            qty = item.get("qty", 0)
            if sku and qty and float(qty) > 0:
                expected_sales[sku] = expected_sales.get(sku, 0) + int(float(qty))

        if not expected_sales:
            return response.Response({"ingredients": []})

        # Explode recipes to get ingredient requirements
        requirements = explode_recipe_requirements(expected_sales)
        if not requirements:
            return response.Response({"ingredients": []})

        ingredient_ids = [r.ingredient_id for r in requirements]

        # Load stock for branch
        stock_map = {
            s.ingredient_id: s
            for s in BranchStock.objects.filter(
                branch_id=branch_id, ingredient_id__in=ingredient_ids
            )
        }

        # Load ingredients with packages
        ingredients_by_id = {
            ing.id: ing
            for ing in Ingredient.objects.filter(pk__in=ingredient_ids)
                .select_related("base_unit")
                .prefetch_related("packages")
        }

        def _best_package(ing):
            """
            Return the best package for display — checks active packages regardless of
            default_display_unit so that items with packages always show nicely.
            Priority: is_default=True → first active → None.
            """
            try:
                pkgs = [p for p in ing.packages.all() if p.is_active and p.conversion_factor and float(p.conversion_factor) > 0]
            except Exception:
                pkgs = []
            if not pkgs:
                # Legacy single-package fields
                cf = getattr(ing, "package_conversion_factor", None)
                if cf and float(cf) > 0 and (getattr(ing, "package_name_en", None) or getattr(ing, "package_name_ar", None)):
                    class _FakePkg:
                        conversion_factor = cf
                        name_en = getattr(ing, "package_name_en", None)
                        name_ar = getattr(ing, "package_name_ar", None)
                    return _FakePkg()
                return None
            for p in pkgs:
                if getattr(p, "is_default", False):
                    return p
            return pkgs[0]

        out = []
        for r in requirements:
            ing = ingredients_by_id.get(r.ingredient_id)
            if not ing:
                continue

            stock = stock_map.get(r.ingredient_id)
            on_hand = Decimal(str(stock.on_hand)) if stock else Decimal("0")
            required = r.qty
            suggested = max(Decimal("0"), required - on_hand)

            base_unit_code = ing.base_unit.code if ing.base_unit else "pcs"
            base_unit_label = (ing.base_unit.name_en or base_unit_code) if ing.base_unit else base_unit_code
            base_unit_label_ar = (ing.base_unit.name_ar or base_unit_label) if ing.base_unit else base_unit_label

            pkg = _best_package(ing)
            if pkg:
                conversion_factor = Decimal(str(pkg.conversion_factor))
                required_display = (required / conversion_factor).quantize(Decimal("0.01"))
                on_hand_display = (on_hand / conversion_factor).quantize(Decimal("0.01"))
                suggested_display = (suggested / conversion_factor).quantize(Decimal("0.01"))
                display_unit_label = (getattr(pkg, "name_en", None) or getattr(pkg, "name_ar", None) or "package").strip() or "package"
                display_unit_label_ar = (getattr(pkg, "name_ar", None) or getattr(pkg, "name_en", None) or "عبوة").strip() or "عبوة"
                display_unit_code = display_unit_label
            else:
                conversion_factor = Decimal("1")
                required_display = required.quantize(Decimal("0.01"))
                on_hand_display = on_hand.quantize(Decimal("0.01"))
                suggested_display = suggested.quantize(Decimal("0.01"))
                display_unit_code = base_unit_code
                display_unit_label = base_unit_label
                display_unit_label_ar = base_unit_label_ar

            out.append({
                "ingredient_id": r.ingredient_id,
                "ingredient_name": r.ingredient_name,
                "ingredient_name_ar": r.ingredient_name_ar or "",
                "serial_code": r.serial_code or "",
                "unit_code": display_unit_code,
                "unit_label": display_unit_label,
                "unit_label_ar": display_unit_label_ar,
                "required_qty": _fmt_qty(required_display),
                "on_hand": _fmt_qty(on_hand_display),
                "suggested_purchase_qty": _fmt_qty(suggested_display),
                "base_unit_code": base_unit_code,
            })

        out.sort(key=lambda x: (-float(x["suggested_purchase_qty"]), x["ingredient_name"]))

        return response.Response({"ingredients": out})
