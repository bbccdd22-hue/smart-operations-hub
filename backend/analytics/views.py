from django.conf import settings
from datetime import datetime, timedelta

from django.db import models
from django.db.models import Avg, Count, F, Q, Sum
from rest_framework import permissions, response, views

from analytics.forecasting import forecast_next_days, predict_sales_for_date
from core.permissions import get_user_scope
from accounting.models import FoodicsPaymentCategory, FoodicsPaymentRecord
from accounting.services import get_financial_summary
from inventory.models import BranchStock
from imports.models import DailySale, ExcelReportType, ExcelUpload, ProductSale
from org.models import Branch, Brand
from shifts.models import ShiftClosing

# [Ref: 135441, 161033, SAIF] Universal Data Mapping – single source for all reports
from analytics.report_data_sources import (
    PRODUCT_SALE_EXCLUDE_SUMMARY as _PRODUCT_SALE_EXCLUDE_SUMMARY,
)

_PRODUCT_SALE_EXCLUDE_SUMMARY = _PRODUCT_SALE_EXCLUDE_SUMMARY


def _apply_branch_scope(request, branch_qs):
    """
    Apply branch/brand scoping from get_user_scope.
    Users see only data for branches they are allowed to access.
    """
    if not request.user or not request.user.is_authenticated:
        return branch_qs
    scope = get_user_scope(request.user)
    if scope["branch_ids"] is not None:
        allowed = scope["branch_ids"] or []
        branch_qs = branch_qs.filter(id__in=allowed)
    if scope["brand_ids"] is not None:
        allowed = scope["brand_ids"] or []
        branch_qs = branch_qs.filter(brand_id__in=allowed)
    return branch_qs


def _product_sales_qs(branch_ids, date_from, date_to):
    """ProductSale queryset excluding summary rows (Total, المجموع, etc.). Returns empty qs if no branches."""
    if not branch_ids:
        return ProductSale.objects.none()
    return ProductSale.objects.filter(
        branch_id__in=branch_ids,
        date__gte=date_from,
        date__lte=date_to,
    ).exclude(_PRODUCT_SALE_EXCLUDE_SUMMARY)


def _product_sales_qs_date_only(date_from, date_to):
    """[Ref: 2026-02-13] Date-only query - NO branch filter. Use when branch filter returns 0 to diagnose ID mismatch."""
    return ProductSale.objects.filter(
        date__gte=date_from,
        date__lte=date_to,
    ).exclude(_PRODUCT_SALE_EXCLUDE_SUMMARY)


def _product_sales_qs_by_brand(brand_ids, date_from, date_to):
    """[Ref: 2026-02-13] Fallback: filter ProductSale by brand_id when branch filter yields empty."""
    if not brand_ids:
        return ProductSale.objects.none()
    return ProductSale.objects.filter(
        brand_id__in=brand_ids,
        date__gte=date_from,
        date__lte=date_to,
    ).exclude(_PRODUCT_SALE_EXCLUDE_SUMMARY)


def _product_sales_qs_by_branch_code(brand_id, branch_code, date_from, date_to):
    """[Ref: 2026-02-13] Fallback: filter ProductSale by branch_code (e.g. B36) when branch_id yields empty."""
    if not brand_id or not branch_code or not str(branch_code).strip():
        return ProductSale.objects.none()
    return ProductSale.objects.filter(
        branch__brand_id=brand_id,
        branch__branch_code__iexact=str(branch_code).strip(),
        date__gte=date_from,
        date__lte=date_to,
    ).exclude(_PRODUCT_SALE_EXCLUDE_SUMMARY)


def _product_sales_qs_by_branch_name(brand_id, branch_name, date_from, date_to):
    """[Ref: 2026-02-13] Fallback: filter ProductSale by branch name (e.g. مكة الرصيفة) when branch_code yields empty."""
    if not brand_id or not branch_name or not str(branch_name).strip():
        return ProductSale.objects.none()
    name = str(branch_name).strip()
    return ProductSale.objects.filter(
        branch__brand_id=brand_id,
        date__gte=date_from,
        date__lte=date_to,
    ).filter(
        Q(branch__name__icontains=name) | Q(branch__name_ar__icontains=name)
    ).exclude(_PRODUCT_SALE_EXCLUDE_SUMMARY)


class OwnerDashboardSummaryView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """
        Dashboard: aggregates from ShiftClosing + DailySale. Supports date range, brand, branch/branch_ids.
        Branch scoping applied – users see only their allowed branches.
        """
        city = request.query_params.get("city")
        brand = request.query_params.get("brand")
        brands_param = request.query_params.get("brands")
        branch_id = request.query_params.get("branch_id")
        branch_ids_param = request.query_params.get("branch_ids")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        report_type = request.query_params.get("report_type", "daily_sales")

        branch_qs = Branch.objects.select_related("brand", "city").filter(is_active=True)
        if city:
            branch_qs = branch_qs.filter(city__code=city)
        if brands_param:
            slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
            if slugs:
                branch_qs = branch_qs.filter(brand__slug__in=slugs)
        elif brand:
            branch_qs = branch_qs.filter(brand__slug=brand)
        if branch_ids_param:
            try:
                ids = [int(x.strip()) for x in branch_ids_param.split(",") if x.strip()]
                if ids:
                    branch_qs = branch_qs.filter(id__in=ids)
            except ValueError:
                pass
        elif branch_id:
            try:
                branch_qs = branch_qs.filter(id=int(branch_id))
            except ValueError:
                pass

        branch_qs = _apply_branch_scope(request, branch_qs)

        today = datetime.now().date()
        if not date_from:
            date_from = today
        else:
            try:
                date_from = datetime.fromisoformat(date_from).date()
            except ValueError:
                date_from = today
        if not date_to:
            date_to = today
        else:
            try:
                date_to = datetime.fromisoformat(date_to).date()
            except ValueError:
                date_to = today

        branch_ids = list(branch_qs.values_list("id", flat=True))

        closings = ShiftClosing.objects.filter(
            shift__branch__in=branch_qs,
            shift__opened_at__date__gte=date_from,
            shift__opened_at__date__lte=date_to,
        )

        totals = closings.aggregate(
            system_total_sales=Sum("system_total_sales"),
            system_cash=Sum("system_cash"),
            system_network=Sum("system_network"),
            shifts_count=Count("id"),
            avg_cash_variance=Avg("variance_cash"),
            avg_network_variance=Avg("variance_network"),
        )
        system_from_shifts = float(totals["system_total_sales"] or 0)

        # [Ref: 135441, 161033, CRITICAL] Net Sales = صافي المبيعات from Foodics Product Sales ONLY.
        # ProductSale.total_sales = total_price after discounts, excluding tax (صافي المبيعات from Excel).
        # ALWAYS prefer ProductSale when it has data for the selected period - never sum all-time or mix sources.
        daily_agg = DailySale.objects.filter(
            branch_id__in=branch_ids,
            date__gte=date_from,
            date__lte=date_to,
        ).aggregate(s=Sum("total_sales"))
        product_agg = _product_sales_qs(branch_ids, date_from, date_to).aggregate(s=Sum("total_sales"))

        system_from_daily = float(daily_agg["s"] or 0)
        system_from_products = float(product_agg["s"] or 0)

        # STRICT: Net Sales comes from ProductSale (Foodics Product Sales report) when available.
        # Fallback to Shift+Daily only when no ProductSale data in period.
        if system_from_products > 0:
            calculated_net = system_from_products  # صافي المبيعات from Foodics
        elif report_type == "product_sales":
            calculated_net = system_from_products
        else:
            calculated_net = system_from_shifts + system_from_daily

        override = getattr(settings, "NET_SALES_OVERRIDE", None)
        totals["system_total_sales"] = override if override is not None else calculated_net

        brand_sales_map = {}
        brand_names = {}
        brand_shifts = {}

        use_product_sales = system_from_products > 0
        if report_type == "product_sales" or use_product_sales:
            for r in _product_sales_qs(branch_ids, date_from, date_to).values(
                "branch__brand__name", "branch__brand__slug"
            ).annotate(s=Sum("total_sales")):
                slug = r["branch__brand__slug"]
                brand_sales_map[slug] = brand_sales_map.get(slug, 0) + float(r["s"] or 0)
                brand_names[slug] = brand_names.get(slug) or r["branch__brand__name"]
                brand_shifts[slug] = 0  # No shifts in product report
        if not use_product_sales and report_type != "product_sales":
            brand_rows = list(
                closings.values("shift__branch__brand__name", "shift__branch__brand__slug")
                .annotate(
                    system_total_sales=Sum("system_total_sales"),
                    shifts=Count("id"),
                )
                .order_by("-system_total_sales")
            )
            for r in brand_rows:
                slug = r["shift__branch__brand__slug"]
                brand_sales_map[slug] = float(r["system_total_sales"] or 0)
                brand_names[slug] = r["shift__branch__brand__name"]
                brand_shifts[slug] = r["shifts"]

            for r in DailySale.objects.filter(
                branch_id__in=branch_ids, date__gte=date_from, date__lte=date_to
            ).values("branch__brand__name", "branch__brand__slug").annotate(s=Sum("total_sales")):
                slug = r["branch__brand__slug"]
                brand_sales_map[slug] = brand_sales_map.get(slug, 0) + float(r["s"] or 0)
                brand_names[slug] = brand_names.get(slug) or r["branch__brand__name"]
                brand_shifts[slug] = brand_shifts.get(slug, 0)

        by_brand = [
            {
                "shift__branch__brand__name": brand_names.get(s, s),
                "shift__branch__brand__slug": s,
                "system_total_sales": v,
                "shifts": brand_shifts.get(s, 0),
            }
            for s, v in sorted(brand_sales_map.items(), key=lambda x: -x[1])
        ]

        # Alerts
        HIGH_VARIANCE = request.query_params.get("high_variance", "50")  # SAR
        try:
            high_var = abs(float(HIGH_VARIANCE))
        except ValueError:
            high_var = 50.0

        variance_alerts = (
            closings.filter(variance_cash__gte=high_var)
            .values("shift__branch__id", "shift__branch__name", "shift__branch__brand__name", "variance_cash")
            .order_by("-variance_cash")[:20]
        )

        low_stock_alerts = (
            BranchStock.objects.filter(branch__in=branch_qs, on_hand__lte=F("reorder_level"))
            .select_related("branch", "ingredient")[:50]
        )
        low_stock_payload = [
            {
                "branch_id": s.branch_id,
                "branch": s.branch.name,
                "ingredient": s.ingredient.name_en,
                "on_hand": str(s.on_hand),
                "reorder_level": str(s.reorder_level),
            }
            for s in low_stock_alerts
        ]

        total_variance = closings.aggregate(v=Sum("variance_cash"))["v"] or 0
        active_branches = branch_qs.count()

        # [Ref: 140426] Branches with data = distinct branches from ProductSale/DailySale/Shift in range
        branches_from_product = set(
            _product_sales_qs(branch_ids, date_from, date_to).values_list("branch_id", flat=True).distinct()
        )
        branches_from_daily = set(
            DailySale.objects.filter(
                branch_id__in=branch_ids,
                date__gte=date_from,
                date__lte=date_to,
            ).values_list("branch_id", flat=True).distinct()
        )
        branches_from_shifts = set(
            closings.values_list("shift__branch_id", flat=True).distinct()
        )
        branches_with_data = len(branches_from_product | branches_from_daily | branches_from_shifts)
        if branches_with_data > 0:
            active_branches = branches_with_data

        # [Ref: 7bddb3, 866466] STRICT RULE: Order Count = عدد الطلبات ONLY. NEVER use كمية المبيعات (qty).
        # عدد الطلبات = transactions. كمية المبيعات = items sold. They are different!
        daily_order_agg = DailySale.objects.filter(
            branch_id__in=branch_ids,
            date__gte=date_from,
            date__lte=date_to,
        ).aggregate(oc=Sum("order_count"))
        orders_count = int(daily_order_agg["oc"] or 0)
        if orders_count == 0:
            orders_count = totals.get("shifts_count") or 0  # Last resort: shift closings

        # [Ref: 7bddb3] Average Order (متوسط عدد الطلبات) = Read متوسط الطلب from Excel ONLY.
        # Weighted avg: sum(avg_order * order_count) / sum(order_count) when avg_order present.
        system_total = float(totals.get("system_total_sales") or 0)
        avg_check = 0
        daily_avg_data = list(
            DailySale.objects.filter(
                branch_id__in=branch_ids,
                date__gte=date_from,
                date__lte=date_to,
            )
            .exclude(average_order__isnull=True)
            .exclude(average_order=0)
            .values("order_count", "average_order")
        )
        if daily_avg_data:
            total_oc = sum(int(r.get("order_count") or 0) for r in daily_avg_data)
            if total_oc > 0:
                weighted_sum = sum(
                    float(r.get("average_order") or 0) * int(r.get("order_count") or 0)
                    for r in daily_avg_data
                )
                avg_check = round(weighted_sum / total_oc, 2)
        # No fallback: avg_check ONLY from متوسط الطلب when present in Daily Sales Report

        # [Ref: 86561c, 873374] Financial Summary: Payments Report ONLY (كاش فودكس, سبان, تطبيقات التوصيل)
        brand_slugs_list = None
        if brands_param:
            brand_slugs_list = [s.strip() for s in brands_param.split(",") if s.strip()]
        elif brand:
            brand_slugs_list = [brand]
        financial_summary = get_financial_summary(
            date_from,
            date_to,
            brand_slugs=brand_slugs_list,
            branch_ids=branch_ids if branch_ids else None,
        )

        # [Ref: 87a319] Net Sales (صافي المبيعات) branch breakdown - match primary source
        total_sales_breakdown = {}
        if report_type == "product_sales" or use_product_sales:
            for r in _product_sales_qs(branch_ids, date_from, date_to).values(
                "branch_id", "branch__name", "branch__name_ar"
            ).annotate(v=Sum("total_sales")):
                bid = r["branch_id"]
                name = r["branch__name_ar"] or r["branch__name"] or ""
                total_sales_breakdown[bid] = total_sales_breakdown.get(bid, {"branch_name": name, "total": 0})
                total_sales_breakdown[bid]["branch_name"] = name
                total_sales_breakdown[bid]["total"] += float(r["v"] or 0)
        else:
            for r in closings.values("shift__branch_id", "shift__branch__name", "shift__branch__name_ar").annotate(
                v=Sum("system_total_sales")
            ):
                bid = r["shift__branch_id"]
                name = r["shift__branch__name_ar"] or r["shift__branch__name"] or ""
                total_sales_breakdown[bid] = total_sales_breakdown.get(bid, {"branch_name": name, "total": 0})
                total_sales_breakdown[bid]["branch_name"] = name
                total_sales_breakdown[bid]["total"] += float(r["v"] or 0)
            for r in DailySale.objects.filter(
                branch_id__in=branch_ids, date__gte=date_from, date__lte=date_to
            ).values("branch_id", "branch__name", "branch__name_ar").annotate(v=Sum("total_sales")):
                bid = r["branch_id"]
                name = r["branch__name_ar"] or r["branch__name"] or ""
                total_sales_breakdown[bid] = total_sales_breakdown.get(bid, {"branch_name": name, "total": 0})
                total_sales_breakdown[bid]["branch_name"] = name
                total_sales_breakdown[bid]["total"] += float(r["v"] or 0)
        financial_summary["total_sales"] = round(system_total, 2)
        financial_summary["total_sales_breakdown"] = [
            {"branch_id": bid, "branch_name": v["branch_name"], "total": round(v["total"], 2)}
            for bid, v in sorted(total_sales_breakdown.items(), key=lambda x: -x[1]["total"])
        ]

        return response.Response(
            {
                "filters": {"city": city, "brand": brand, "branch_id": branch_id, "date_from": str(date_from), "date_to": str(date_to)},
                "totals": {
                    **totals,
                    "total_variance": total_variance,
                    "orders_count": orders_count,
                    "avg_check": avg_check,
                    "active_branches": active_branches,
                },
                "financial_summary": financial_summary,
                "by_brand": list(by_brand),
                "alerts": {
                    "variance_cash": list(variance_alerts),
                    "low_stock": low_stock_payload,
                },
            }
        )


class DashboardChartView(views.APIView):
    """Daily sales series + revenue split + top products + branch performance + sales vs qty."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        city = request.query_params.get("city")
        brand = request.query_params.get("brand")
        brands_param = request.query_params.get("brands")
        branch_id = request.query_params.get("branch_id")
        branch_ids_param = request.query_params.get("branch_ids")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        report_type = request.query_params.get("report_type", "daily_sales")

        branch_qs = Branch.objects.select_related("brand", "city").filter(is_active=True)
        if city:
            branch_qs = branch_qs.filter(city__code=city)
        if brands_param:
            slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
            if slugs:
                branch_qs = branch_qs.filter(brand__slug__in=slugs)
        elif brand:
            branch_qs = branch_qs.filter(brand__slug=brand)
        branch_code_param = request.query_params.get("branch_code", "").strip()
        branch_name_param = request.query_params.get("branch_name", "").strip()
        if branch_code_param:
            branch_qs = branch_qs.filter(branch_code__iexact=branch_code_param)
        elif branch_ids_param:
            try:
                ids = [int(x.strip()) for x in branch_ids_param.split(",") if x.strip()]
                if ids:
                    branch_qs = branch_qs.filter(id__in=ids)
            except ValueError:
                pass
        elif branch_id:
            bid_str = str(branch_id).strip()
            try:
                branch_qs = branch_qs.filter(id=int(bid_str))
            except ValueError:
                branch_qs = branch_qs.filter(branch_code__iexact=bid_str)
        elif branch_name_param:
            branch_qs = branch_qs.filter(
                Q(name__icontains=branch_name_param) | Q(name_ar__icontains=branch_name_param)
            )
        branch_qs = _apply_branch_scope(request, branch_qs)

        today = datetime.now().date()
        if not date_from:
            date_from = today
        else:
            try:
                date_from = datetime.fromisoformat(date_from).date()
            except ValueError:
                date_from = today
        if not date_to:
            date_to = today
        else:
            try:
                date_to = datetime.fromisoformat(date_to).date()
            except ValueError:
                date_to = today

        branch_ids = list(branch_qs.values_list("id", flat=True))
        brand_id = None
        if branch_qs.exists():
            first_brand = branch_qs.first().brand_id
            if branch_qs.filter(brand_id=first_brand).count() == branch_qs.count():
                brand_id = first_brand

        daily_sales_from_shift = (
            ShiftClosing.objects.filter(
                shift__branch_id__in=branch_ids,
                shift__opened_at__date__gte=date_from,
                shift__opened_at__date__lte=date_to,
            )
            .values("shift__opened_at__date")
            .annotate(sales=Sum("system_total_sales"))
            .order_by("shift__opened_at__date")
        )
        daily_sales_from_excel = (
            DailySale.objects.filter(
                branch_id__in=branch_ids,
                date__gte=date_from,
                date__lte=date_to,
            )
            .values("date")
            .annotate(sales=Sum("total_sales"))
            .order_by("date")
        )
        product_sales_by_date = (
            _product_sales_qs(branch_ids, date_from, date_to)
            .values("date")
            .annotate(sales=Sum("total_sales"), qty=Sum("qty"))
            .order_by("date")
        )

        # [Ref: CRITICAL] Align with summary: Net Sales from ProductSale when it has data.
        # NO double-count: never add ProductSale to Shift+Daily (they can overlap).
        by_date = {}
        by_date_qty = {}
        product_sum = sum(float(r["sales"] or 0) for r in product_sales_by_date)
        use_product_for_chart = product_sum > 0
        is_product_report = report_type == "product_sales"

        if is_product_report or use_product_for_chart:
            # صافي المبيعات from ProductSale only - actual daily fluctuations from Foodics
            for r in product_sales_by_date:
                d = r["date"]
                by_date[d] = float(r["sales"] or 0)
                by_date_qty[d] = float(r["qty"] or 0)
        else:
            # Fallback: Shift + DailySale (no ProductSale - avoid double-count)
            for r in daily_sales_from_shift:
                d = r["shift__opened_at__date"]
                by_date[d] = float(r["sales"] or 0)
            for r in daily_sales_from_excel:
                d = r["date"]
                by_date[d] = by_date.get(d, 0) + float(r["sales"] or 0)

        daily_series = []
        current = date_from
        while current <= date_to:
            sales = by_date.get(current, 0)
            qty = by_date_qty.get(current, 0)
            pred = predict_sales_for_date(
                branch_id=int(branch_id) if branch_id else None,
                brand_id=brand_id,
                target_date=current,
                lookback_days=90,
            )
            forecast = pred.get("predicted_sales", 0) or 0
            daily_series.append({
                "date": str(current),
                "sales": round(sales, 2),
                "forecast": round(forecast, 2),
                "qty": round(qty, 2),
            })
            current += timedelta(days=1)

        sales_vs_qty_trend = [
            {"date": d["date"], "sales": d["sales"], "qty": d["qty"]}
            for d in daily_series
        ]

        closings = ShiftClosing.objects.filter(
            shift__branch_id__in=branch_ids,
            shift__opened_at__date__gte=date_from,
            shift__opened_at__date__lte=date_to,
        )
        revenue = closings.aggregate(
            cash=Sum("system_cash"),
            network=Sum("system_network"),
            delivery=Sum("system_delivery"),
        )
        if closings.exists():
            cash = float(revenue["cash"] or 0)
            network = float(revenue["network"] or 0)
            delivery = float(revenue["delivery"] or 0)
        else:
            excel_rev = DailySale.objects.filter(
                branch_id__in=branch_ids,
                date__gte=date_from,
                date__lte=date_to,
            ).aggregate(cash=Sum("cash_amount"), network=Sum("network_amount"))
            cash = float(excel_rev["cash"] or 0)
            network = float(excel_rev["network"] or 0)
            delivery = 0

        # [Ref: 87b658] When no Shift/Daily data, use Payments Report (يوم) for Revenue timeline
        if cash == 0 and network == 0 and delivery == 0 and branch_ids:
            pay_rev = list(
                FoodicsPaymentRecord.objects.filter(
                    report_date__gte=date_from,
                    report_date__lte=date_to,
                    branch_id__in=branch_ids,
                ).values("category").annotate(amt=Sum("net_amount"))
            )
            for r in pay_rev:
                a = float(r.get("amt") or 0)
                if r.get("category") == FoodicsPaymentCategory.CASH:
                    cash += a
                elif r.get("category") == FoodicsPaymentCategory.SPAN:
                    network += a
                elif r.get("category") == FoodicsPaymentCategory.DELIVERY_APPS:
                    delivery += a

        revenue_split = [
            {"name": "Cash", "value": round(cash, 2), "key": "cash"},
            {"name": "Network", "value": round(network, 2), "key": "network"},
            {"name": "Delivery", "value": round(delivery, 2), "key": "delivery"},
        ]

        # Top 5 products by net sales (from ProductSale, exclude summary rows)
        # [Ref: 2026-02-13] EXACT qty: ProductSale.filter(...).annotate(Sum('qty')) - no averaging
        # When include_all_products=1: return ALL products with product_sku. Fallback: branch_code -> branch_name -> brand
        include_all = request.query_params.get("include_all_products") == "1" and report_type == "product_sales"
        group_by_sku = include_all

        def _build_top_products_qs(qs, by_sku):
            if by_sku:
                return qs.values("product_name", "product_sku").annotate(
                    sales=Sum("total_sales"), qty=Sum("qty")
                ).order_by("-sales")
            return qs.values("product_name").annotate(
                sales=Sum("total_sales"), qty=Sum("qty")
            ).order_by("-sales")

        # [Ref: 2026-02-13] Match Dashboard EXACTLY: same _product_sales_qs(branch_ids, date_from, date_to)
        base_qs = _product_sales_qs(branch_ids, date_from, date_to)
        top_products_qs = _build_top_products_qs(base_qs, group_by_sku)

        # When branch filter returns 0: try brand_id (Dashboard fallback), then DATE-ONLY (no branch) to confirm ID mismatch
        if not top_products_qs.exists() and report_type == "product_sales":
            brand_ids_fb = []
            if branch_qs.exists():
                brand_ids_fb = list(branch_qs.values_list("brand_id", flat=True).distinct())
            elif brands_param:
                slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
                brand_ids_fb = list(Brand.objects.filter(slug__in=slugs).values_list("id", flat=True))
            if brand_ids_fb:
                alt = _build_top_products_qs(
                    _product_sales_qs_by_brand(brand_ids_fb, date_from, date_to), group_by_sku
                )
                if alt.exists():
                    top_products_qs = alt
            if not top_products_qs.exists():
                top_products_qs = _build_top_products_qs(
                    _product_sales_qs_date_only(date_from, date_to), group_by_sku
                )
        if not include_all:
            top_products_qs = top_products_qs[:5]
        top_products = [
            {
                "product_name": r["product_name"] or "—",
                "product_sku": (r.get("product_sku") or "") if group_by_sku else "",
                "sales": float(r["sales"] or 0),
                "qty": float(r["qty"] or 0),
            }
            for r in top_products_qs
        ]

        # Branch performance (sales by branch) for donut
        branch_sales = {}
        for r in (
            _product_sales_qs(branch_ids, date_from, date_to)
            .values("branch_id", "branch__name", "branch__name_ar")
            .annotate(v=Sum("total_sales"))
        ):
            bid = r["branch_id"]
            name = r["branch__name_ar"] or r["branch__name"] or "—"
            if bid not in branch_sales:
                branch_sales[bid] = {"name": name, "value": 0}
            branch_sales[bid]["value"] += float(r["v"] or 0)
        if not is_product_report:
            for r in (
                DailySale.objects.filter(
                    branch_id__in=branch_ids,
                    date__gte=date_from,
                    date__lte=date_to,
                )
                .values("branch_id", "branch__name", "branch__name_ar")
                .annotate(v=Sum("total_sales"))
            ):
                bid = r["branch_id"]
                name = r["branch__name_ar"] or r["branch__name"] or "—"
                if bid not in branch_sales:
                    branch_sales[bid] = {"name": name, "value": 0}
                branch_sales[bid]["value"] += float(r["v"] or 0)
        branch_performance = [
            {"branch_name": v["name"], "value": round(v["value"], 2)}
            for v in branch_sales.values()
        ]
        branch_performance.sort(key=lambda x: -x["value"])

        payload = {
            "daily_series": daily_series,
            "revenue_split": revenue_split,
            "top_products": top_products,
            "branch_performance": branch_performance,
            "sales_vs_qty_trend": sales_vs_qty_trend,
        }
        return response.Response(payload)


class ForecastView(views.APIView):
    """Predictive sales for next 7 and 30 days from archived Daily Sales (DB only)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        branch_id = request.query_params.get("branch_id")
        branch_id = int(branch_id) if branch_id else None
        brand_id = request.query_params.get("brand_id")
        brand_id = int(brand_id) if brand_id else None
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None and branch_id is not None:
            if branch_id not in (scope["branch_ids"] or []):
                return response.Response({"next_7_days": [], "next_30_days": [], "warnings": ["Branch access denied"]}, status=403)
        horizon = request.query_params.get("horizon", "7")
        horizon = 30 if str(horizon) == "30" else 7

        pred_7, warnings_7 = forecast_next_days(
            branch_id=branch_id, brand_id=brand_id, horizon_days=7, lookback_days=90
        )
        pred_30, warnings_30 = forecast_next_days(
            branch_id=branch_id, brand_id=brand_id, horizon_days=30, lookback_days=90
        )

        return response.Response({
            "next_7_days": pred_7,
            "next_30_days": pred_30,
            "warnings": list(warnings_7) + [w for w in warnings_30 if w not in warnings_7],
        })


class PredictDateView(views.APIView):
    """Predicted sales for a specific future date (Dashboard & Production Planner)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import datetime
        from analytics.forecasting import predict_sales_for_date
        branch_id = request.query_params.get("branch_id")
        branch_id = int(branch_id) if branch_id else None
        brand_id = request.query_params.get("brand_id")
        brand_id = int(brand_id) if brand_id else None
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None and branch_id is not None:
            if branch_id not in (scope["branch_ids"] or []):
                return response.Response({"predicted_sales": 0, "error": "Branch access denied"}, status=403)
        date_str = request.query_params.get("date")
        target = None
        if date_str:
            try:
                target = datetime.fromisoformat(date_str).date()
            except ValueError:
                pass
        result = predict_sales_for_date(
            branch_id=branch_id, brand_id=brand_id, target_date=target, lookback_days=90
        )
        return response.Response(result)


class DashboardInsightsView(views.APIView):
    """Smart Insights: Zero variance branch, recurring shortages, forecast warnings."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import date

        from accounting.services import get_daily_reconciliation, get_discrepancy_alerts
        from analytics.forecasting import predict_sales_for_date

        today = date.today()
        brand = request.query_params.get("brand")
        brands_param = request.query_params.get("brands")
        brand_slug = brand
        if brands_param:
            slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
            brand_slug = slugs[0] if slugs else brand
        insights = []

        # 1. Top Branch with Zero Variance today (i18n keys for full Arabic support)
        rows = get_daily_reconciliation(today, brand_slug=brand_slug, submitted_only=True)
        zero_var = [r for r in rows if not r.get("has_variance") and r.get("actual_cash", 0) > 0]
        if zero_var:
            top = max(zero_var, key=lambda r: r.get("actual_cash", 0) + r.get("actual_card", 0))
            insights.append({
                "type": "success",
                "title_key": "insightZeroVarianceTop",
                "message_key": "insightZeroVarianceMsg",
                "params": {"name": top["branch_name"], "brand": top["brand_name"]},
            })
        elif rows:
            insights.append({
                "type": "info",
                "title_key": "insightZeroVarianceNone",
                "message_key": None,
                "params": {},
            })

        # 2. Recurring shortage alert
        alerts = get_discrepancy_alerts(days=30, brand_slug=brand_slug)
        if alerts:
            a = alerts[0]
            insights.append({
                "type": "alert",
                "title_key": "insightRecurringShortage",
                "message_key": "insightRecurringShortageMsg",
                "params": {
                    "name": a["branch_name"],
                    "count": a["occurrences"],
                    "avg": a["avg_shortage"],
                },
            })

        # 3. Forecast warning: sales 20%+ below forecast (use ALL sources: DailySale + ProductSale + ShiftClosing)
        brand_ids_list = list(Branch.objects.filter(is_active=True).values_list("brand_id", flat=True).distinct())
        if brand:
            from org.models import Brand
            b = Brand.objects.filter(slug=brand).first()
            brand_ids_list = [b.id] if b else []
        from org.models import Brand as BrandModel  # noqa: F811

        for bid in brand_ids_list[:10]:
            pred = predict_sales_for_date(brand_id=bid, target_date=today, lookback_days=90)
            forecast_val = pred.get("predicted_sales") or 0
            if forecast_val <= 0:
                continue
            # [Ref: 981,459] Include ShiftClosing + DailySale + ProductSale (same sources as dashboard)
            branch_ids_bid = list(Branch.objects.filter(brand_id=bid).values_list("id", flat=True))
            actual_daily = DailySale.objects.filter(
                date=today, branch__brand_id=bid
            ).aggregate(s=Sum("total_sales"))["s"] or 0
            actual_product = _product_sales_qs(branch_ids_bid, today, today).aggregate(
                s=Sum("total_sales")
            )["s"] or 0
            actual_shifts = ShiftClosing.objects.filter(
                shift__opened_at__date=today,
                shift__branch_id__in=branch_ids_bid,
            ).aggregate(s=Sum("system_total_sales"))["s"] or 0
            actual = float(actual_daily) + float(actual_product) + float(actual_shifts)
            if actual < forecast_val * 0.8:
                bn = BrandModel.objects.filter(id=bid).first()
                name = bn.name if bn else f"Brand {bid}"
                pct = round((1 - actual / forecast_val) * 100)
                insights.append({
                    "type": "warning",
                    "title_key": "insightSalesBelowForecast",
                    "message_key": "insightSalesBelowForecastMsg",
                    "params": {"name": name, "percent": pct},
                })
                break

        return response.Response({"insights": insights})


class SystemHealthView(views.APIView):
    """Last Excel sync and data coverage/gaps."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        last_uploads = []
        for rt in ExcelReportType:
            last = ExcelUpload.objects.filter(report_type=rt.value).order_by("-created_at").first()
            last_uploads.append({
                "report_type": rt.value,
                "label": rt.label,
                "last_sync": last.created_at.isoformat() if last else None,
                "file_name": last.file.name if last else None,
                "date_from": last.report_date_from.isoformat() if last and last.report_date_from else None,
                "date_to": last.report_date_to.isoformat() if last and last.report_date_to else None,
            })

        return response.Response({
            "last_uploads": last_uploads,
            "status": "ok",
        })


class HeartbeatView(views.APIView):
    """Cafe Heartbeat Dashboard: burn rate, sales mix, basket ratio, waste monitor."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import datetime
        from analytics.heartbeat_services import get_heartbeat_data

        branch_id = request.query_params.get("branch_id")
        branch_ids_param = request.query_params.get("branch_ids")
        date_str = request.query_params.get("date")

        branch_ids = None
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
        if not branch_ids:
            branch_qs = Branch.objects.filter(is_active=True)[:50]
            branch_qs = _apply_branch_scope(request, branch_qs)
            branch_ids = list(branch_qs.values_list("id", flat=True))
        else:
            scope = get_user_scope(request.user)
            if scope["branch_ids"] is not None:
                allowed = set(scope["branch_ids"] or [])
                branch_ids = [b for b in branch_ids if b in allowed]
            if scope["brand_ids"] is not None:
                allowed_branches = set(Branch.objects.filter(brand_id__in=(scope["brand_ids"] or [])).values_list("id", flat=True))
                branch_ids = [b for b in branch_ids if b in allowed_branches]

        dt = None
        if date_str:
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                pass

        data = get_heartbeat_data(branch_ids=branch_ids, dt=dt)
        return response.Response(data)
