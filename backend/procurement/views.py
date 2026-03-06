"""
Procurement API – طلبات الشراء، التنبؤ الذكي، بوابة الموردين، إدارة الموردين.
"""
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from rest_framework import permissions, response, status, views
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, NotFound, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.viewsets import ModelViewSet

from core.pagination import paginate_queryset
from core.permissions import get_user_scope

from procurement.serializers import (
    SupplierSerializer,
    SupplierInvoiceSerializer,
    SupplierInvoiceCreateSerializer,
    GoodsReceiptSerializer,
    GoodsReceiptCreateSerializer,
)
from procurement.supplier_report_services import (
    get_supplier_balances,
    get_supplier_statement,
    get_supplier_debt_aging,
)
from procurement.purchase_suggestion_services import (
    get_purchase_suggestions,
    _get_default_package,
    _fmt_qty,
)
from procurement.supplier_invoice_services import post_supplier_invoice, create_purchase_invoice
from procurement.services import confirm_goods_receipt, generate_next_receipt_number
from procurement.models import (
    Supplier,
    SupplierInvoice,
    SupplierInvoiceStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderStatus,
    PurchaseRequest,
    PurchaseRequestStatus,
    GoodsReceipt,
    GoodsReceiptLine,
    GoodsReceiptStatus,
)
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
    throttle_classes = []

    def _get_supplier_from_request(self, request) -> Supplier | None:
        api_key = (
            request.headers.get("X-Supplier-API-Key")
            or request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        )
        if not api_key:
            return None
        from .services import get_supplier_by_api_key
        return get_supplier_by_api_key(api_key)

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

        # Safety cap: reject implausibly large invoices (misconfiguration / injection)
        _MAX_INVOICE_AMOUNT = Decimal("1000000")
        if total_amount <= 0:
            return response.Response(
                {"detail": "total_amount must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if total_amount > _MAX_INVOICE_AMOUNT:
            return response.Response(
                {"detail": f"Invoice amount exceeds the allowed limit of {_MAX_INVOICE_AMOUNT:,.0f}."},
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


# ═══════════════════════════════════════════════════════════════════════════
# نظام الموردين — Supplier Management & Reports
# ═══════════════════════════════════════════════════════════════════════════


class SupplierListView(ListCreateAPIView):
    """قائمة الموردين + إضافة مورد جديد."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SupplierSerializer
    queryset = Supplier.objects.all().select_related("brand").order_by("name")

    def get_queryset(self):
        qs = super().get_queryset()
        brand_id = self.request.query_params.get("brand_id")
        if brand_id:
            try:
                qs = qs.filter(brand_id=int(brand_id))
            except (TypeError, ValueError):
                pass
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(name_ar__icontains=search)
                | Q(contact_phone__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save()


class SupplierDetailView(RetrieveUpdateDestroyAPIView):
    """تفاصيل مورد، تعديل، حذف."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SupplierSerializer
    queryset = Supplier.objects.all().select_related("brand")


class SupplierBalancesView(views.APIView):
    """أرصدة الموردين."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        brand_id = request.query_params.get("brand_id")
        branch_id = request.query_params.get("branch_id")
        try:
            brand_id = int(brand_id) if brand_id else None
        except (TypeError, ValueError):
            brand_id = None
        try:
            branch_id = int(branch_id) if branch_id else None
        except (TypeError, ValueError):
            branch_id = None
        rows = get_supplier_balances(brand_id=brand_id, branch_id=branch_id)
        return response.Response({"suppliers": rows})


class SupplierStatementView(views.APIView):
    """كشف حساب مورد."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, supplier_id):
        from_date = request.query_params.get("from_date")
        to_date = request.query_params.get("to_date")
        data = get_supplier_statement(
            supplier_id=int(supplier_id),
            from_date=from_date,
            to_date=to_date,
        )
        if not data:
            return response.Response({"detail": "المورد غير موجود"}, status=404)
        return response.Response(data)


class SupplierDebtAgingView(views.APIView):
    """أعمار الديون للموردين."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        brand_id = request.query_params.get("brand_id")
        as_of = request.query_params.get("as_of_date")
        try:
            brand_id = int(brand_id) if brand_id else None
        except (TypeError, ValueError):
            brand_id = None
        from datetime import datetime
        as_of_date = None
        if as_of:
            try:
                as_of_date = datetime.strptime(as_of, "%Y-%m-%d").date()
            except ValueError:
                pass
        data = get_supplier_debt_aging(brand_id=brand_id, as_of_date=as_of_date)
        return response.Response(data)


# ═══════════════════════════════════════════════════════════════════════════
# فواتير الشراء وطلبات الشراء — Purchase Invoices & Orders
# ═══════════════════════════════════════════════════════════════════════════


class SupplierInvoiceListView(views.APIView):
    """قائمة فواتير الشراء — للعرض والفلترة."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        qs = SupplierInvoice.objects.select_related(
            "supplier", "branch", "goods_receipt"
        ).order_by("-invoice_date", "-created_at")

        brand_id = request.query_params.get("brand_id")
        branch_id = request.query_params.get("branch_id")
        supplier_id = request.query_params.get("supplier_id")
        status_filter = request.query_params.get("status")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        search = (request.query_params.get("search") or "").strip()

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

        if supplier_id:
            try:
                qs = qs.filter(supplier_id=int(supplier_id))
            except (TypeError, ValueError):
                pass

        if status_filter and status_filter in ("draft", "posted"):
            qs = qs.filter(status=status_filter)

        if date_from:
            try:
                qs = qs.filter(invoice_date__gte=datetime.strptime(date_from, "%Y-%m-%d").date())
            except ValueError:
                pass
        if date_to:
            try:
                qs = qs.filter(invoice_date__lte=datetime.strptime(date_to, "%Y-%m-%d").date())
            except ValueError:
                pass

        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search)
                | Q(supplier__name__icontains=search)
                | Q(supplier__name_ar__icontains=search)
            )

        page_items, pagination = paginate_queryset(qs, request)
        invoices = []
        for inv in page_items:
            invoices.append({
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "invoice_date": str(inv.invoice_date),
                "supplier_id": inv.supplier_id,
                "supplier_name": inv.supplier.name,
                "supplier_name_ar": inv.supplier.name_ar or "",
                "branch_id": inv.branch_id,
                "branch_name": inv.branch.name,
                "total_amount": str(inv.total_amount),
                "status": inv.status,
                "status_display": dict(SupplierInvoiceStatus.choices).get(inv.status, inv.status),
                "goods_receipt_id": inv.goods_receipt_id,
                "notes": inv.notes or "",
            })
        return response.Response({"invoices": invoices, "pagination": pagination})


class SupplierInvoiceViewSet(ModelViewSet):
    """
    فواتير المورد – قائمة، إنشاء، تفاصيل، تحديث، وترحيل (post).
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SupplierInvoiceSerializer
    queryset = SupplierInvoice.objects.all()

    def get_queryset(self):
        qs = (
            SupplierInvoice.objects.select_related("supplier", "branch", "goods_receipt", "journal_entry")
            .prefetch_related("lines", "lines__ingredient", "lines__unit")
            .order_by("-invoice_date", "-created_at")
        )
        scope = get_user_scope(self.request.user)
        brand_id = self.request.query_params.get("brand_id")
        branch_id = self.request.query_params.get("branch_id")
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
        supplier_id = self.request.query_params.get("supplier_id")
        if supplier_id:
            try:
                qs = qs.filter(supplier_id=int(supplier_id))
            except (TypeError, ValueError):
                pass
        status_filter = self.request.query_params.get("status")
        if status_filter and status_filter in ("draft", "posted"):
            qs = qs.filter(status=status_filter)
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            try:
                qs = qs.filter(invoice_date__gte=datetime.strptime(date_from, "%Y-%m-%d").date())
            except ValueError:
                pass
        if date_to:
            try:
                qs = qs.filter(invoice_date__lte=datetime.strptime(date_to, "%Y-%m-%d").date())
            except ValueError:
                pass
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search)
                | Q(supplier__name__icontains=search)
                | Q(supplier__name_ar__icontains=search)
            )
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        page_items, pagination = paginate_queryset(qs, request)
        serializer = self.get_serializer(page_items, many=True)
        return response.Response({"invoices": serializer.data, "pagination": pagination})

    def create(self, request, *args, **kwargs):
        ser = SupplierInvoiceCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if not data.get("lines"):
            raise ValidationError({"lines": "At least one line is required."})
        try:
            inv = create_purchase_invoice(
                supplier_id=data["supplier_id"],
                branch_id=data["branch_id"],
                invoice_number=data["invoice_number"],
                invoice_date=data["invoice_date"],
                notes=data.get("notes", ""),
                goods_receipt_id=data.get("goods_receipt_id"),
                lines=data["lines"],
            )
        except Exception as e:
            return response.Response(
                {"detail": str(e)[:300]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(inv)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        inv = self.get_object()
        serializer = self.get_serializer(inv)
        return response.Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        inv = self.get_object()
        if inv.status == SupplierInvoiceStatus.POSTED:
            return response.Response(
                {"detail": "Cannot edit a posted invoice."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for attr in ("invoice_number", "invoice_date", "notes"):
            if attr in request.data:
                setattr(inv, attr, request.data[attr])
        inv.save()
        serializer = self.get_serializer(inv)
        return response.Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="post")
    def post_invoice(self, request, pk=None):
        """ترحيل الفاتورة إلى الحسابات (إنشاء قيد محاسبي مع الأبعاد)."""
        inv = self.get_object()
        if inv.status == SupplierInvoiceStatus.POSTED:
            return response.Response(
                {"detail": "Invoice is already posted.", "journal_entry_id": inv.journal_entry_id},
                status=status.HTTP_200_OK,
            )
        try:
            je = post_supplier_invoice(inv)
        except Exception as e:
            return response.Response(
                {"detail": str(e)[:300]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return response.Response(
            {
                "detail": "تم ترحيل الفاتورة",
                "journal_entry_id": je.id,
                "status": inv.status,
            },
            status=status.HTTP_200_OK,
        )


class PurchaseOrderListView(views.APIView):
    """قائمة طلبات الشراء (أوامر الشراء)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        qs = PurchaseOrder.objects.select_related(
            "supplier", "branch", "branch__brand", "created_by"
        ).prefetch_related("lines").order_by("-order_date", "-created_at")

        brand_id = request.query_params.get("brand_id")
        branch_id = request.query_params.get("branch_id")
        supplier_id = request.query_params.get("supplier_id")
        status_filter = request.query_params.get("status")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        search = (request.query_params.get("search") or "").strip()

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

        if supplier_id:
            try:
                qs = qs.filter(supplier_id=int(supplier_id))
            except (TypeError, ValueError):
                pass

        if status_filter and status_filter in dict(PurchaseOrderStatus.choices):
            qs = qs.filter(status=status_filter)

        if date_from:
            try:
                qs = qs.filter(order_date__gte=datetime.strptime(date_from, "%Y-%m-%d").date())
            except ValueError:
                pass
        if date_to:
            try:
                qs = qs.filter(order_date__lte=datetime.strptime(date_to, "%Y-%m-%d").date())
            except ValueError:
                pass

        if search:
            qs = qs.filter(
                Q(order_number__icontains=search)
                | Q(supplier__name__icontains=search)
                | Q(supplier__name_ar__icontains=search)
            )

        page_items, pagination = paginate_queryset(qs, request)
        orders = []
        for po in page_items:
            lines_count = po.lines.count()
            orders.append({
                "id": po.id,
                "order_number": po.order_number,
                "order_date": str(po.order_date),
                "supplier_id": po.supplier_id,
                "supplier_name": po.supplier.name,
                "supplier_name_ar": po.supplier.name_ar or "",
                "branch_id": po.branch_id,
                "branch_name": po.branch.name,
                "brand_name": po.branch.brand.name if po.branch.brand else "",
                "status": po.status,
                "status_display": dict(PurchaseOrderStatus.choices).get(po.status, po.status),
                "lines_count": lines_count,
                "expected_delivery_date": str(po.expected_delivery_date) if po.expected_delivery_date else None,
            })
        return response.Response({"orders": orders, "pagination": pagination})


class PurchaseOrderDetailView(views.APIView):
    """تفاصيل أمر شراء واحد مع السطور – لاستخدامها في نموذج استلام البضاعة."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        scope = get_user_scope(request.user)
        po = PurchaseOrder.objects.filter(pk=pk).select_related(
            "supplier", "branch", "branch__brand"
        ).prefetch_related("lines", "lines__ingredient", "lines__unit").first()
        if not po:
            raise NotFound("أمر الشراء غير موجود")
        if scope.get("brand_ids") and po.branch.brand_id not in scope["brand_ids"]:
            raise PermissionDenied("لا يمكنك عرض أمر شراء لعلامة غير معينة لك")
        if scope.get("branch_ids") and po.branch_id not in scope["branch_ids"]:
            raise PermissionDenied("لا يمكنك عرض أمر شراء لفرع غير معين لك")

        lines = []
        for line in po.lines.all():
            lines.append({
                "id": line.id,
                "ingredient_id": line.ingredient_id,
                "ingredient_name": line.ingredient.name_en,
                "ingredient_name_ar": line.ingredient.name_ar or "",
                "quantity": str(line.quantity),
                "unit_id": line.unit_id,
                "unit_code": line.unit.code,
                "unit_name": line.unit.name_en,
                "unit_price": str(line.unit_price),
            })
        return response.Response({
            "id": po.id,
            "order_number": po.order_number,
            "order_date": str(po.order_date),
            "supplier_id": po.supplier_id,
            "supplier_name": po.supplier.name,
            "supplier_name_ar": po.supplier.name_ar or "",
            "branch_id": po.branch_id,
            "branch_name": po.branch.name,
            "status": po.status,
            "lines": lines,
        })


class PurchaseRequestListView(views.APIView):
    """قائمة طلبات الشراء — للعرض والفلترة."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        qs = PurchaseRequest.objects.select_related(
            "branch", "branch__brand", "requested_by"
        ).prefetch_related("lines").order_by("-requested_at")

        branch_id = request.query_params.get("branch_id")
        brand_id = request.query_params.get("brand_id")
        status_filter = request.query_params.get("status")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        search = (request.query_params.get("search") or "").strip()

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

        if status_filter and status_filter in dict(PurchaseRequestStatus.choices):
            qs = qs.filter(status=status_filter)

        if date_from:
            try:
                from datetime import date as _date, datetime as _dt
                qs = qs.filter(requested_at__date__gte=_dt.strptime(date_from, "%Y-%m-%d").date())
            except ValueError:
                pass
        if date_to:
            try:
                from datetime import datetime as _dt
                qs = qs.filter(requested_at__date__lte=_dt.strptime(date_to, "%Y-%m-%d").date())
            except ValueError:
                pass

        if search:
            qs = qs.filter(
                Q(request_number__icontains=search)
                | Q(notes__icontains=search)
                | Q(requested_by__username__icontains=search)
            )

        page_items, pagination = paginate_queryset(qs, request)
        reqs = []
        for pr in page_items:
            lines_count = pr.lines.count()
            estimated_total = sum(
                (l.estimated_unit_price or 0) * l.quantity
                for l in pr.lines.all()
            )
            reqs.append({
                "id": pr.id,
                "request_number": pr.request_number,
                "requested_at": pr.requested_at.isoformat() if pr.requested_at else None,
                "branch_id": pr.branch_id,
                "branch_name": pr.branch.name,
                "brand_name": pr.branch.brand.name if pr.branch.brand else "",
                "status": pr.status,
                "status_display": dict(PurchaseRequestStatus.choices).get(pr.status, pr.status),
                "requested_by": pr.requested_by.username if pr.requested_by else "",
                "lines_count": lines_count,
                "estimated_total": str(estimated_total),
                "notes": pr.notes or "",
            })
        return response.Response({"requests": reqs, "pagination": pagination})


class GoodsReceiptListCreateView(views.APIView):
    """قائمة إشعارات استلام البضاعة (GRN) + إنشاء استلام جديد."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        qs = GoodsReceipt.objects.select_related(
            "purchase_order", "purchase_order__supplier", "purchase_order__branch"
        ).prefetch_related(
            "lines", "lines__order_line", "lines__order_line__ingredient", "lines__order_line__unit", "invoices"
        ).order_by("-receipt_date", "-created_at")

        if scope.get("brand_ids"):
            qs = qs.filter(purchase_order__branch__brand_id__in=scope["brand_ids"])
        elif request.query_params.get("brand_id"):
            try:
                qs = qs.filter(purchase_order__branch__brand_id=int(request.query_params["brand_id"]))
            except (TypeError, ValueError):
                pass
        if scope.get("branch_ids"):
            qs = qs.filter(purchase_order__branch_id__in=scope["branch_ids"])
        elif request.query_params.get("branch_id"):
            try:
                qs = qs.filter(purchase_order__branch_id=int(request.query_params["branch_id"]))
            except (TypeError, ValueError):
                pass
        if request.query_params.get("status") in ("draft", "confirmed"):
            qs = qs.filter(status=request.query_params["status"])
        if request.query_params.get("date_from"):
            try:
                qs = qs.filter(receipt_date__gte=datetime.strptime(request.query_params["date_from"], "%Y-%m-%d").date())
            except ValueError:
                pass
        if request.query_params.get("date_to"):
            try:
                qs = qs.filter(receipt_date__lte=datetime.strptime(request.query_params["date_to"], "%Y-%m-%d").date())
            except ValueError:
                pass

        page_items, pagination = paginate_queryset(qs, request)
        serializer = GoodsReceiptSerializer(page_items, many=True)
        return response.Response({"receipts": serializer.data, "pagination": pagination})

    def post(self, request):
        ser = GoodsReceiptCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        po = PurchaseOrder.objects.filter(pk=data["purchase_order_id"]).select_related(
            "supplier", "branch"
        ).prefetch_related("lines").first()
        if not po:
            raise ValidationError({"purchase_order_id": "أمر الشراء غير موجود"})

        scope = get_user_scope(request.user)
        if scope.get("brand_ids") and po.branch.brand_id not in scope["brand_ids"]:
            raise PermissionDenied("لا يمكنك إنشاء استلام لأمر شراء لعلامة غير معينة لك")
        if scope.get("branch_ids") and po.branch_id not in scope["branch_ids"]:
            raise PermissionDenied("لا يمكنك إنشاء استلام لأمر شراء لفرع غير معين لك")

        order_line_ids = {line.id for line in po.lines.all()}
        lines_payload = {item["order_line_id"]: item["quantity_received"] for item in data["lines"]}
        for ol_id in lines_payload:
            if ol_id not in order_line_ids:
                raise ValidationError({"lines": f"order_line_id {ol_id} غير تابع لأمر الشراء المحدد"})

        with transaction.atomic():
            receipt_number = generate_next_receipt_number()
            gr = GoodsReceipt.objects.create(
                purchase_order=po,
                receipt_number=receipt_number,
                receipt_date=data["receipt_date"],
                received_by=request.user,
                status=GoodsReceiptStatus.DRAFT,
                notes=(data.get("notes") or "").strip(),
            )
            for item in data["lines"]:
                qty = item["quantity_received"]
                if qty <= 0:
                    continue
                GoodsReceiptLine.objects.create(
                    goods_receipt=gr,
                    order_line_id=item["order_line_id"],
                    quantity_received=qty,
                )

        gr = (
            GoodsReceipt.objects.filter(pk=gr.pk)
            .select_related("purchase_order", "purchase_order__supplier", "purchase_order__branch")
            .prefetch_related(
                "lines", "lines__order_line", "lines__order_line__ingredient", "lines__order_line__unit", "invoices"
            )
            .first()
        )
        serializer = GoodsReceiptSerializer(gr)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)


class GoodsReceiptDetailView(views.APIView):
    """تفاصيل استلام بضاعة واحد."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        gr = GoodsReceipt.objects.filter(pk=pk).select_related(
            "purchase_order", "purchase_order__supplier", "purchase_order__branch"
        ).prefetch_related("lines", "lines__order_line", "lines__order_line__ingredient", "lines__order_line__unit", "invoices").first()
        if not gr:
            raise NotFound("إشعار الاستلام غير موجود")
        scope = get_user_scope(request.user)
        if scope.get("brand_ids") and gr.purchase_order.branch.brand_id not in scope["brand_ids"]:
            raise PermissionDenied("لا يمكنك عرض هذا الاستلام")
        if scope.get("branch_ids") and gr.purchase_order.branch_id not in scope["branch_ids"]:
            raise PermissionDenied("لا يمكنك عرض هذا الاستلام")
        serializer = GoodsReceiptSerializer(gr)
        return response.Response(serializer.data)


class GoodsReceiptConfirmView(views.APIView):
    """تأكيد استلام البضاعة – تحديث المخزون وقيد الاستحقاق."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        gr = GoodsReceipt.objects.filter(pk=pk).select_related(
            "purchase_order", "purchase_order__branch", "purchase_order__supplier"
        ).prefetch_related("lines", "lines__order_line").first()
        if not gr:
            raise NotFound("إشعار الاستلام غير موجود")
        if gr.status == GoodsReceiptStatus.CONFIRMED:
            raise ValidationError({"detail": "تم تأكيد هذا الاستلام مسبقاً"})
        scope = get_user_scope(request.user)
        if scope.get("brand_ids") and gr.purchase_order.branch.brand_id not in scope["brand_ids"]:
            raise PermissionDenied("لا يمكنك تأكيد هذا الاستلام")
        if scope.get("branch_ids") and gr.purchase_order.branch_id not in scope["branch_ids"]:
            raise PermissionDenied("لا يمكنك تأكيد هذا الاستلام")
        if not gr.lines.exists():
            raise ValidationError({"detail": "أضف سطراً واحداً على الأقل قبل التأكيد"})

        try:
            je = confirm_goods_receipt(gr)
        except ValueError as e:
            raise ValidationError({"detail": str(e)})

        gr.refresh_from_db()
        serializer = GoodsReceiptSerializer(gr)
        return response.Response({
            "receipt": serializer.data,
            "journal_entry_id": je.id,
        }, status=status.HTTP_200_OK)


class ProcurementDailyMovementsView(views.APIView):
    """تقرير الحركات اليومية للمشتريات — فواتير، أوامر، استلامات."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        brand_id = request.query_params.get("brand_id")
        branch_id = request.query_params.get("branch_id")
        movement_type = request.query_params.get("type")  # invoice | order | receipt | all

        from datetime import date
        today = date.today()
        if not date_from:
            date_from = today
        else:
            try:
                date_from = datetime.strptime(date_from, "%Y-%m-%d").date()
            except ValueError:
                date_from = today
        if not date_to:
            date_to = today
        else:
            try:
                date_to = datetime.strptime(date_to, "%Y-%m-%d").date()
            except ValueError:
                date_to = today

        movements = []

        # ─── فواتير الموردين ───
        if movement_type in (None, "", "all", "invoice"):
            inv_qs = SupplierInvoice.objects.select_related(
                "supplier", "branch"
            ).filter(invoice_date__gte=date_from, invoice_date__lte=date_to).order_by("-invoice_date")
            if scope.get("brand_ids"):
                inv_qs = inv_qs.filter(branch__brand_id__in=scope["brand_ids"])
            elif brand_id:
                try:
                    inv_qs = inv_qs.filter(branch__brand_id=int(brand_id))
                except (TypeError, ValueError):
                    pass
            if scope.get("branch_ids"):
                inv_qs = inv_qs.filter(branch_id__in=scope["branch_ids"])
            elif branch_id:
                try:
                    inv_qs = inv_qs.filter(branch_id=int(branch_id))
                except (TypeError, ValueError):
                    pass
            for inv in inv_qs[:500]:
                movements.append({
                    "id": inv.id,
                    "type": "invoice",
                    "type_display_ar": "فاتورة مورد",
                    "type_display_en": "Supplier Invoice",
                    "doc_number": inv.invoice_number,
                    "doc_date": str(inv.invoice_date),
                    "supplier_id": inv.supplier_id,
                    "supplier_name": inv.supplier.name,
                    "supplier_name_ar": inv.supplier.name_ar or "",
                    "branch_id": inv.branch_id,
                    "branch_name": inv.branch.name,
                    "amount": str(inv.total_amount),
                    "status": inv.status,
                    "status_display": dict(SupplierInvoiceStatus.choices).get(inv.status, inv.status),
                })

        # ─── أوامر الشراء ───
        if movement_type in (None, "", "all", "order"):
            po_qs = PurchaseOrder.objects.select_related("supplier", "branch").prefetch_related("lines")
            po_qs = po_qs.filter(order_date__gte=date_from, order_date__lte=date_to).order_by("-order_date")
            if scope.get("brand_ids"):
                po_qs = po_qs.filter(branch__brand_id__in=scope["brand_ids"])
            elif brand_id:
                try:
                    po_qs = po_qs.filter(branch__brand_id=int(brand_id))
                except (TypeError, ValueError):
                    pass
            if scope.get("branch_ids"):
                po_qs = po_qs.filter(branch_id__in=scope["branch_ids"])
            elif branch_id:
                try:
                    po_qs = po_qs.filter(branch_id=int(branch_id))
                except (TypeError, ValueError):
                    pass
            for po in po_qs[:500]:
                total = sum(
                    (line.quantity * line.unit_price) for line in po.lines.all()
                )
                movements.append({
                    "id": po.id,
                    "type": "order",
                    "type_display_ar": "أمر شراء",
                    "type_display_en": "Purchase Order",
                    "doc_number": po.order_number,
                    "doc_date": str(po.order_date),
                    "supplier_id": po.supplier_id,
                    "supplier_name": po.supplier.name,
                    "supplier_name_ar": po.supplier.name_ar or "",
                    "branch_id": po.branch_id,
                    "branch_name": po.branch.name,
                    "amount": str(total),
                    "status": po.status,
                    "status_display": dict(PurchaseOrderStatus.choices).get(po.status, po.status),
                })

        # ─── استلامات البضاعة ───
        if movement_type in (None, "", "all", "receipt"):
            gr_qs = GoodsReceipt.objects.select_related(
                "purchase_order", "purchase_order__supplier", "purchase_order__branch"
            ).filter(receipt_date__gte=date_from, receipt_date__lte=date_to).order_by("-receipt_date")
            if scope.get("brand_ids"):
                gr_qs = gr_qs.filter(purchase_order__branch__brand_id__in=scope["brand_ids"])
            elif brand_id:
                try:
                    gr_qs = gr_qs.filter(purchase_order__branch__brand_id=int(brand_id))
                except (TypeError, ValueError):
                    pass
            if scope.get("branch_ids"):
                gr_qs = gr_qs.filter(purchase_order__branch_id__in=scope["branch_ids"])
            elif branch_id:
                try:
                    gr_qs = gr_qs.filter(purchase_order__branch_id=int(branch_id))
                except (TypeError, ValueError):
                    pass
            for gr in gr_qs[:500]:
                total = Decimal("0")
                for rl in gr.lines.select_related("order_line").all():
                    total += rl.quantity_received * rl.order_line.unit_price
                movements.append({
                    "id": gr.id,
                    "type": "receipt",
                    "type_display_ar": "استلام بضاعة",
                    "type_display_en": "Goods Receipt",
                    "doc_number": gr.receipt_number,
                    "doc_date": str(gr.receipt_date),
                    "supplier_id": gr.purchase_order.supplier_id,
                    "supplier_name": gr.purchase_order.supplier.name,
                    "supplier_name_ar": gr.purchase_order.supplier.name_ar or "",
                    "branch_id": gr.purchase_order.branch_id,
                    "branch_name": gr.purchase_order.branch.name,
                    "amount": str(total),
                    "status": gr.status,
                    "status_display": dict(GoodsReceiptStatus.choices).get(gr.status, gr.status),
                })

        movements.sort(key=lambda m: (m["doc_date"], m["type"]), reverse=True)
        return response.Response({
            "movements": movements,
            "date_from": str(date_from),
            "date_to": str(date_to),
            "total_count": len(movements),
        })


class ProcurementReviewMovementsView(views.APIView):
    """مراجعة حركات المشتريات — تقرير تفصيلي للمراجعة والتدقيق."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = get_user_scope(request.user)
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        brand_id = request.query_params.get("brand_id")
        branch_id = request.query_params.get("branch_id")
        supplier_id = request.query_params.get("supplier_id")

        from datetime import date
        today = date.today()
        if not date_from:
            date_from = today
        else:
            try:
                date_from = datetime.strptime(date_from, "%Y-%m-%d").date()
            except ValueError:
                date_from = today
        if not date_to:
            date_to = today
        else:
            try:
                date_to = datetime.strptime(date_to, "%Y-%m-%d").date()
            except ValueError:
                date_to = today

        movements = []
        inv_qs = SupplierInvoice.objects.select_related("supplier", "branch").filter(
            invoice_date__gte=date_from, invoice_date__lte=date_to
        ).order_by("-invoice_date", "-created_at")
        if scope.get("brand_ids"):
            inv_qs = inv_qs.filter(branch__brand_id__in=scope["brand_ids"])
        elif brand_id:
            try:
                inv_qs = inv_qs.filter(branch__brand_id=int(brand_id))
            except (TypeError, ValueError):
                pass
        if scope.get("branch_ids"):
            inv_qs = inv_qs.filter(branch_id__in=scope["branch_ids"])
        elif branch_id:
            try:
                inv_qs = inv_qs.filter(branch_id=int(branch_id))
            except (TypeError, ValueError):
                pass
        if supplier_id:
            try:
                inv_qs = inv_qs.filter(supplier_id=int(supplier_id))
            except (TypeError, ValueError):
                pass
        for inv in inv_qs[:500]:
            movements.append({
                "id": inv.id,
                "type": "invoice",
                "type_display_ar": "فاتورة مورد",
                "type_display_en": "Supplier Invoice",
                "doc_number": inv.invoice_number,
                "doc_date": str(inv.invoice_date),
                "supplier_id": inv.supplier_id,
                "supplier_name": inv.supplier.name,
                "supplier_name_ar": inv.supplier.name_ar or "",
                "branch_id": inv.branch_id,
                "branch_name": inv.branch.name,
                "amount": str(inv.total_amount),
                "status": inv.status,
                "status_display": dict(SupplierInvoiceStatus.choices).get(inv.status, inv.status),
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
                "notes": inv.notes or "",
            })

        po_qs = PurchaseOrder.objects.select_related("supplier", "branch").prefetch_related("lines")
        po_qs = po_qs.filter(order_date__gte=date_from, order_date__lte=date_to)
        if scope.get("brand_ids"):
            po_qs = po_qs.filter(branch__brand_id__in=scope["brand_ids"])
        elif brand_id:
            try:
                po_qs = po_qs.filter(branch__brand_id=int(brand_id))
            except (TypeError, ValueError):
                pass
        if scope.get("branch_ids"):
            po_qs = po_qs.filter(branch_id__in=scope["branch_ids"])
        elif branch_id:
            try:
                po_qs = po_qs.filter(branch_id=int(branch_id))
            except (TypeError, ValueError):
                pass
        if supplier_id:
            try:
                po_qs = po_qs.filter(supplier_id=int(supplier_id))
            except (TypeError, ValueError):
                pass
        for po in po_qs[:500]:
            total = sum((line.quantity * line.unit_price) for line in po.lines.all())
            movements.append({
                "id": po.id,
                "type": "order",
                "type_display_ar": "أمر شراء",
                "type_display_en": "Purchase Order",
                "doc_number": po.order_number,
                "doc_date": str(po.order_date),
                "supplier_id": po.supplier_id,
                "supplier_name": po.supplier.name,
                "supplier_name_ar": po.supplier.name_ar or "",
                "branch_id": po.branch_id,
                "branch_name": po.branch.name,
                "amount": str(total),
                "status": po.status,
                "status_display": dict(PurchaseOrderStatus.choices).get(po.status, po.status),
                "created_at": po.created_at.isoformat() if po.created_at else None,
                "notes": po.notes or "",
            })

        gr_qs = GoodsReceipt.objects.select_related(
            "purchase_order", "purchase_order__supplier", "purchase_order__branch"
        ).filter(receipt_date__gte=date_from, receipt_date__lte=date_to)
        if scope.get("brand_ids"):
            gr_qs = gr_qs.filter(purchase_order__branch__brand_id__in=scope["brand_ids"])
        elif brand_id:
            try:
                gr_qs = gr_qs.filter(purchase_order__branch__brand_id=int(brand_id))
            except (TypeError, ValueError):
                pass
        if scope.get("branch_ids"):
            gr_qs = gr_qs.filter(purchase_order__branch_id__in=scope["branch_ids"])
        elif branch_id:
            try:
                gr_qs = gr_qs.filter(purchase_order__branch_id=int(branch_id))
            except (TypeError, ValueError):
                pass
        if supplier_id:
            try:
                gr_qs = gr_qs.filter(purchase_order__supplier_id=int(supplier_id))
            except (TypeError, ValueError):
                pass
        for gr in gr_qs[:500]:
            total = Decimal("0")
            for rl in gr.lines.select_related("order_line").all():
                total += rl.quantity_received * rl.order_line.unit_price
            movements.append({
                "id": gr.id,
                "type": "receipt",
                "type_display_ar": "استلام بضاعة",
                "type_display_en": "Goods Receipt",
                "doc_number": gr.receipt_number,
                "doc_date": str(gr.receipt_date),
                "supplier_id": gr.purchase_order.supplier_id,
                "supplier_name": gr.purchase_order.supplier.name,
                "supplier_name_ar": gr.purchase_order.supplier.name_ar or "",
                "branch_id": gr.purchase_order.branch_id,
                "branch_name": gr.purchase_order.branch.name,
                "amount": str(total),
                "status": gr.status,
                "status_display": dict(GoodsReceiptStatus.choices).get(gr.status, gr.status),
                "created_at": gr.created_at.isoformat() if gr.created_at else None,
                "notes": gr.notes or "",
            })

        movements.sort(key=lambda m: (m["doc_date"], m["created_at"] or ""), reverse=True)

        summed_by_supplier = {}
        for m in movements:
            sid = m["supplier_id"]
            if sid not in summed_by_supplier:
                summed_by_supplier[sid] = {"name": m["supplier_name"], "name_ar": m["supplier_name_ar"], "total": Decimal("0")}
            summed_by_supplier[sid]["total"] += Decimal(m["amount"])
        summary = [{"supplier_id": k, "supplier_name": v["name"], "supplier_name_ar": v["name_ar"], "total": str(v["total"])} for k, v in summed_by_supplier.items()]
        summary.sort(key=lambda x: Decimal(x["total"]), reverse=True)

        return response.Response({
            "movements": movements,
            "summary_by_supplier": summary,
            "date_from": str(date_from),
            "date_to": str(date_to),
            "total_count": len(movements),
            "grand_total": str(sum(Decimal(m["amount"]) for m in movements)),
        })
