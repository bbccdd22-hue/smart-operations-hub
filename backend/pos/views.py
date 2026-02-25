"""
POS API - شاشة الكاشير.
"""
from decimal import Decimal

from rest_framework import permissions, response, status, views
from rest_framework.exceptions import PermissionDenied

from core.permissions import get_user_scope
from inventory.models import FoodicsProduct
from org.models import Branch

from .models import PaymentMethod, SaleTransaction, SplitPayment
from .services import create_pos_journal_entry, process_pos_depletion


def _next_sale_number() -> str:
    from django.db.models import Max
    from django.utils import timezone
    prefix = timezone.now().strftime("%Y%m%d")
    qs = SaleTransaction.objects.filter(sale_number__startswith=f"POS-{prefix}")
    max_num = qs.aggregate(m=Max("sale_number"))["m"]
    if not max_num:
        return f"POS-{prefix}-0001"
    try:
        num = int(max_num.split("-")[-1]) + 1
        return f"POS-{prefix}-{num:04d}"
    except (ValueError, IndexError):
        return f"POS-{prefix}-0001"


class POSProductsView(views.APIView):
    """قائمة المنتجات للكاشير - مع فلتر بالتصنيف والفرع."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        branch_id = request.query_params.get("branch_id")
        category = request.query_params.get("category")

        if request.user.is_authenticated:
            scope = get_user_scope(request.user)
            if scope["branch_ids"] is not None and branch_id:
                try:
                    bid = int(branch_id)
                    if bid not in (scope["branch_ids"] or []):
                        raise PermissionDenied("صلاحية الفرع فقط")
                except ValueError:
                    pass

        qs = FoodicsProduct.objects.filter(is_active=True).select_related("sales_unit").order_by("name")
        if hasattr(FoodicsProduct, "pos_category") and category:
            qs = qs.filter(pos_category=category)

        products = [
            {
                "id": p.id,
                "sku": p.foodics_product_id,
                "name": p.name,
                "price": float(p.price_excl_tax or 0),
                "unit": p.sales_unit.code if p.sales_unit else "pcs",
                "category": getattr(p, "pos_category", None) or "other",
            }
            for p in qs
        ]
        return response.Response({"products": products})


class POSCategoriesView(views.APIView):
    """التصنيفات المعرفة (من المنتجات أو ثابتة)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        categories = [
            {"id": "coffee", "name": "قهوة", "name_ar": "قهوة"},
            {"id": "desserts", "name": "حلى", "name_ar": "حلى"},
            {"id": "sandwiches", "name": "سندوتشات", "name_ar": "سندوتشات"},
            {"id": "drinks", "name": "مشروبات", "name_ar": "مشروبات"},
            {"id": "other", "name": "أخرى", "name_ar": "أخرى"},
        ]
        return response.Response({"categories": categories})


class POSModifiersView(views.APIView):
    """خيارات التعديل (إضافة حليب، سكر، إلخ)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import ProductModifier

        mods = ProductModifier.objects.filter(is_active=True).select_related("ingredient")
        return response.Response({
            "modifiers": [
                {
                    "id": m.id,
                    "name": m.name,
                    "name_ar": m.name_ar,
                    "price_add": float(m.price_add),
                    "modifier_type": m.modifier_type,
                    "ingredient_id": m.ingredient_id,
                    "qty_per_use": float(m.qty_per_use or 1),
                }
                for m in mods
            ],
        })


class POSCreateSaleView(views.APIView):
    """
    إنشاء معاملة بيع.
    Body: { branch_id, items: [{ product_sku, product_name, qty, unit_price, modifiers: [], discount_amount }],
            payment_method, discount_total?, notes? }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        branch_id = request.data.get("branch_id")
        items = request.data.get("items") or []
        payment_method = request.data.get("payment_method") or "cash"
        discount_total = Decimal(str(request.data.get("discount_total") or 0))
        notes = (request.data.get("notes") or "")[:500]

        if not branch_id or not items:
            return response.Response(
                {"detail": "branch_id و items مطلوبان"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            branch_id = int(branch_id)
        except (TypeError, ValueError):
            return response.Response(
                {"detail": "branch_id يجب أن يكون رقماً"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None and branch_id not in (scope["branch_ids"] or []):
            raise PermissionDenied("صلاحية الفرع فقط")

        try:
            branch = Branch.objects.get(pk=branch_id)
        except Branch.DoesNotExist:
            return response.Response(
                {"detail": "الفرع غير موجود"},
                status=status.HTTP_404_NOT_FOUND,
            )

        subtotal = Decimal("0")
        for it in items:
            qty = Decimal(str(it.get("qty") or 1))
            up = Decimal(str(it.get("unit_price") or 0))
            mod_total = Decimal(str(it.get("modifier_total") or 0))
            item_disc = Decimal(str(it.get("discount_amount") or 0))
            subtotal += (qty * up + mod_total - item_disc)

        total = subtotal - discount_total
        tax_amount = Decimal("0")  # يمكن إضافة الضريبة لاحقاً

        sku_to_qty = {}
        for it in items:
            sku = (it.get("product_sku") or "").strip()
            if not sku:
                continue
            qty = int(float(it.get("qty") or 1))
            if qty > 0:
                sku_to_qty[sku] = sku_to_qty.get(sku, 0) + qty

        split_payments = request.data.get("split_payments") or []
        customer_id = request.data.get("customer_id")
        terminal_reference = (request.data.get("terminal_reference") or "")[:128]
        if split_payments:
            split_sum = sum(Decimal(str(sp.get("amount") or 0)) for sp in split_payments)
            if abs(split_sum - total) > Decimal("0.01"):
                return response.Response(
                    {"detail": "مجموع الدفعات لا يساوي الإجمالي"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        from django.db import transaction as db_transaction

        with db_transaction.atomic():
            dep_result = process_pos_depletion(
                branch_id, sku_to_qty, items_with_modifiers=items,
            )
            if dep_result.get("errors"):
                return response.Response(
                    {"detail": "خطأ في المخزون", "errors": dep_result["errors"][:5]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment_m = payment_method
            if split_payments:
                payment_m = split_payments[0].get("method", payment_method)

            sale = SaleTransaction.objects.create(
                branch=branch,
                sale_number=_next_sale_number(),
                items=items,
                subtotal=subtotal,
                discount_total=discount_total,
                tax_amount=tax_amount,
                total=total,
                payment_method=payment_m,
                cashier=request.user,
                customer_id=customer_id or None,
                notes=notes,
                terminal_reference=terminal_reference,
            )
            for sp in split_payments:
                SplitPayment.objects.create(
                    sale=sale,
                    amount=Decimal(str(sp.get("amount") or 0)),
                    method=sp.get("method") or "cash",
                    terminal_reference=(sp.get("terminal_reference") or "")[:128],
                )

            je = create_pos_journal_entry(
                sale, branch, total, payment_method,
                split_payments=split_payments if split_payments else None,
            )
            if je:
                sale.journal_entry = je
                sale.save(update_fields=["journal_entry"])

        return response.Response(
            {
                "sale_number": sale.sale_number,
                "total": float(sale.total),
                "depletion_movements": dep_result.get("movements_created", 0),
            },
            status=status.HTTP_201_CREATED,
        )


class POSSyncOfflineView(views.APIView):
    """
    مزامنة المعاملات المحفوظة محلياً (Offline).
    Body: { sales: [{ branch_id, items, ... }] }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        sales_data = request.data.get("sales") or []
        if not sales_data:
            return response.Response({"synced": 0, "errors": []})

        scope = get_user_scope(request.user)
        synced = 0
        errors = []

        for s in sales_data:
            try:
                branch_id = s.get("branch_id")
                if scope["branch_ids"] is not None and branch_id not in (scope["branch_ids"] or []):
                    errors.append(f"صلاحية الفرع لـ branch_id={branch_id}")
                    continue

                # Reuse same logic as POSCreateSaleView - simplified
                items = s.get("items") or []
                if not items:
                    continue

                discount_total = Decimal(str(s.get("discount_total") or 0))
                payment_method = s.get("payment_method") or "cash"

                subtotal = Decimal("0")
                sku_to_qty = {}
                for it in items:
                    qty = Decimal(str(it.get("qty") or 1))
                    up = Decimal(str(it.get("unit_price") or 0))
                    mod_total = Decimal(str(it.get("modifier_total") or 0))
                    item_disc = Decimal(str(it.get("discount_amount") or 0))
                    subtotal += (qty * up + mod_total - item_disc)
                    sku = (it.get("product_sku") or "").strip()
                    if sku:
                        sku_to_qty[sku] = sku_to_qty.get(sku, 0) + int(float(it.get("qty") or 1))

                total = subtotal - discount_total

                from django.db import transaction as db_transaction

                with db_transaction.atomic():
                    dep_result = process_pos_depletion(branch_id, sku_to_qty)
                    branch = Branch.objects.get(pk=branch_id)
                    sale = SaleTransaction.objects.create(
                        branch=branch,
                        sale_number=_next_sale_number(),
                        items=items,
                        subtotal=subtotal,
                        discount_total=discount_total,
                        tax_amount=Decimal("0"),
                        total=total,
                        payment_method=payment_method,
                        cashier=request.user,
                    )
                    je = create_pos_journal_entry(sale, branch, total, payment_method)
                    if je:
                        sale.journal_entry = je
                        sale.save(update_fields=["journal_entry"])
                    synced += 1
            except Exception as e:
                errors.append(str(e)[:100])

        return response.Response({"synced": synced, "errors": errors[:10]})


class POSKitchenOrdersView(views.APIView):
    """طلبات المطبخ - للعرض على شاشة KDS."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        branch_id = request.query_params.get("branch_id")
        if not branch_id:
            return response.Response({"detail": "branch_id مطلوب"}, status=400)

        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None and int(branch_id) not in (scope["branch_ids"] or []):
            raise PermissionDenied("صلاحية الفرع فقط")

        from django.utils import timezone
        from datetime import timedelta

        since = timezone.now() - timedelta(hours=12)
        qs = SaleTransaction.objects.filter(
            branch_id=branch_id,
            created_at__gte=since,
        ).order_by("-created_at")[:50]

        orders = [
            {
                "sale_number": s.sale_number,
                "items": s.items,
                "total": float(s.total),
                "created_at": s.created_at.isoformat(),
            }
            for s in qs
        ]
        return response.Response({"orders": orders})
