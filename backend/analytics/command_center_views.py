"""
لوحة تحكم المالك الذكية – Owner's Command Center.
KPI، الرقابة اللحظية، الرسوم البيانية.
"""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from rest_framework import permissions, response, views

from analytics.report_data_sources import PRODUCT_SALE_EXCLUDE_SUMMARY
from core.permissions import get_user_scope, is_super_admin
from imports.models import DailySale, ProductSale
from inventory.models import BranchStock, Ingredient, StockTransfer, StockTransferLine, StockTransferStatus, WasteLog
from inventory.transfer_services import notify_stale_transfers_if_any
from org.models import Branch, Brand, SystemErrorLog


def _get_branch_ids(request, branch_ids_param, brand_slug, brands_param):
    """Resolve branch_ids from request params."""
    branch_ids = None
    qs = Branch.objects.filter(is_active=True).select_related("brand")
    if branch_ids_param:
        try:
            branch_ids = [int(x.strip()) for x in branch_ids_param.split(",") if x.strip()]
        except (ValueError, TypeError):
            pass
    if brand_slug:
        qs = qs.filter(brand__slug=brand_slug)
    elif brands_param:
        slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
        if slugs:
            qs = qs.filter(brand__slug__in=slugs)
    if request.user.is_authenticated:
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None:
            qs = qs.filter(id__in=(scope["branch_ids"] or []))
    all_ids = list(qs.values_list("id", flat=True))
    return branch_ids if branch_ids else all_ids, all_ids


class OwnerCommandCenterView(views.APIView):
    """
    لوحة تحكم المالك – KPI، تحويلات معلقة، أخطاء، مبيعات/هدر، أصناف منخفضة.
    سيف أو perm_full_system_access.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_super_admin(request.user):
            from core.permissions import _role_has_permission, get_user_profile
            profile = get_user_profile(request.user)
            if not _role_has_permission(profile, "perm_full_system_access"):
                return response.Response({"detail": "غير مصرح"}, status=403)

        date_s = request.query_params.get("date") or request.query_params.get("date_from")
        branch_id = request.query_params.get("branch_id")
        branch_ids_param = request.query_params.get("branch_ids")
        brand_slug = request.query_params.get("brand")
        brands_param = request.query_params.get("brands")

        try:
            target_date = date.fromisoformat(date_s) if date_s else date.today()
        except ValueError:
            target_date = date.today()
        prev_date = target_date - timedelta(days=1)

        branch_ids, all_branch_ids = _get_branch_ids(request, branch_ids_param, brand_slug, brands_param)
        if branch_id:
            try:
                branch_ids = [int(branch_id)]
            except (ValueError, TypeError):
                pass
        if not branch_ids:
            branch_ids = all_branch_ids

        # 1) KPI: Daily sales today vs yesterday
        sales_today = float(
            DailySale.objects.filter(branch_id__in=branch_ids, date=target_date)
            .aggregate(s=Sum("total_sales"))["s"] or 0
        )
        sales_from_products_today = float(
            ProductSale.objects.filter(branch_id__in=branch_ids, date=target_date)
            .exclude(PRODUCT_SALE_EXCLUDE_SUMMARY)
            .aggregate(s=Sum("total_sales"))["s"] or 0
        )
        sales_yesterday = float(
            DailySale.objects.filter(branch_id__in=branch_ids, date=prev_date)
            .aggregate(s=Sum("total_sales"))["s"] or 0
        )
        sales_from_products_yesterday = float(
            ProductSale.objects.filter(branch_id__in=branch_ids, date=prev_date)
            .exclude(PRODUCT_SALE_EXCLUDE_SUMMARY)
            .aggregate(s=Sum("total_sales"))["s"] or 0
        )
        daily_sales = max(sales_today, sales_from_products_today)
        daily_sales_prev = max(sales_yesterday, sales_from_products_yesterday)
        sales_change_pct = round((daily_sales - daily_sales_prev) / daily_sales_prev * 100, 1) if daily_sales_prev else 0

        # 2) KPI: In-transit value (BranchStock for IN_TRANSIT branch × unit_cost)
        in_transit_branch = Branch.objects.filter(branch_code="IN_TRANSIT").first()
        in_transit_value = Decimal("0")
        if in_transit_branch:
            for bs in BranchStock.objects.filter(branch=in_transit_branch, on_hand__gt=0).select_related("ingredient"):
                uc = bs.ingredient.unit_cost or Decimal("0")
                in_transit_value += bs.on_hand * uc

        # 3) KPI: Unresolved errors count
        errors_unresolved = SystemErrorLog.objects.filter(resolved=False).count()

        # 4) KPI: Negative stock count (exclude in-transit)
        real_branches = list(Branch.objects.exclude(branch_code="IN_TRANSIT").values_list("id", flat=True))
        negative_stock_count = BranchStock.objects.filter(
            branch_id__in=real_branches,
            on_hand__lt=0,
        ).count()

        # 5) Latest 5 pending transfers (with value = sum qty * unit_cost)
        # تنبيه فوري: تحويلات عالقة >24 ساعة
        notify_stale_transfers_if_any()
        pending_qs = StockTransfer.objects.filter(status=StockTransferStatus.PENDING)
        if branch_ids:
            pending_qs = pending_qs.filter(
                Q(from_branch_id__in=branch_ids) | Q(to_branch_id__in=branch_ids)
            )
        pending_qs = pending_qs.select_related(
            "from_branch", "to_branch", "requested_by"
        ).prefetch_related("lines__ingredient").order_by("-requested_at")[:5]

        pending_transfers = []
        for t in pending_qs:
            value_sar = Decimal("0")
            for line in t.lines.select_related("ingredient").all():
                uc = line.ingredient.unit_cost or Decimal("0")
                value_sar += line.qty * uc
            pending_transfers.append({
                "id": t.id,
                "from_branch_name": t.from_branch.name,
                "to_branch_name": t.to_branch.name,
                "value_sar": round(float(value_sar), 2),
                "requested_at": t.requested_at.isoformat() if t.requested_at else None,
            })

        # 6) Latest 5 system errors
        latest_errors = []
        for e in SystemErrorLog.objects.filter(resolved=False).select_related("user").order_by("-created_at")[:5]:
            latest_errors.append({
                "id": e.id,
                "error_type": e.error_type,
                "message": (e.message or "")[:200],
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "username": e.user.username if e.user else "—",
            })

        # 7) Sales vs waste by branch (date range: target_date)
        sales_by_branch = defaultdict(float)
        for r in ProductSale.objects.filter(branch_id__in=branch_ids, date=target_date).exclude(
            PRODUCT_SALE_EXCLUDE_SUMMARY
        ).values("branch_id", "branch__name", "branch__name_ar").annotate(s=Sum("total_sales")):
            sales_by_branch[r["branch_id"]] = {"name": r["branch__name_ar"] or r["branch__name"] or "", "sales": float(r["s"] or 0)}
        for r in DailySale.objects.filter(branch_id__in=branch_ids, date=target_date).values(
            "branch_id", "branch__name", "branch__name_ar"
        ).annotate(s=Sum("total_sales")):
            bid = r["branch_id"]
            if bid not in sales_by_branch or sales_by_branch[bid]["sales"] < float(r["s"] or 0):
                sales_by_branch[bid] = {"name": r["branch__name_ar"] or r["branch__name"] or "", "sales": float(r["s"] or 0)}

        waste_by_branch = defaultdict(lambda: {"name": "", "waste_sar": 0.0})
        for wl in WasteLog.objects.filter(branch_id__in=branch_ids, date=target_date).select_related(
            "branch", "ingredient"
        ):
            if not wl.branch_id:
                continue
            excess = max(Decimal("0"), (wl.actual_usage or 0) - (wl.theoretical_usage or 0))
            uc = wl.ingredient.unit_cost or Decimal("0")
            waste_sar = float(excess * uc)
            waste_by_branch[wl.branch_id]["waste_sar"] = waste_by_branch[wl.branch_id]["waste_sar"] + waste_sar
            waste_by_branch[wl.branch_id]["name"] = (wl.branch.name_ar or wl.branch.name) if wl.branch else ""

        branch_names = {b["id"]: (b["name_ar"] or b["name"]) for b in Branch.objects.filter(id__in=branch_ids).values("id", "name", "name_ar")}
        sales_vs_waste = []
        for bid in branch_ids:
            sb = sales_by_branch.get(bid, {"name": branch_names.get(bid, ""), "sales": 0})
            wb = waste_by_branch.get(bid, {"name": sb["name"], "waste_sar": 0})
            sales_vs_waste.append({
                "branch_id": bid,
                "branch_name": sb["name"] or wb["name"] or str(bid),
                "sales": round(sb["sales"], 2),
                "waste_sar": round(wb["waste_sar"], 2),
            })
        sales_vs_waste.sort(key=lambda x: -x["sales"])

        # 8) Top 5 low-stock ingredients (lowest on_hand, exclude in-transit)
        low_stock_branch_ids = [b for b in real_branches if b in branch_ids] if branch_ids else list(real_branches)
        low_stock = []
        for bs in (
            BranchStock.objects.filter(branch_id__in=low_stock_branch_ids)
            .exclude(branch__branch_code="IN_TRANSIT")
            .select_related("ingredient", "branch")
            .order_by("on_hand")[:50]
        ):
            if bs.on_hand < 0 or (bs.reorder_level and bs.on_hand <= bs.reorder_level):
                low_stock.append({
                    "ingredient_name": bs.ingredient.name_en,
                    "ingredient_name_ar": bs.ingredient.name_ar or "",
                    "branch_name": bs.branch.name_ar or bs.branch.name,
                    "on_hand": float(bs.on_hand),
                    "reorder_level": float(bs.reorder_level or 0),
                })
        low_stock = sorted(low_stock, key=lambda x: x["on_hand"])[:5]

        return response.Response({
            "filters": {"date": str(target_date), "branch_ids": branch_ids, "brand": brand_slug or brands_param},
            "kpis": {
                "daily_sales_today": round(daily_sales, 2),
                "daily_sales_yesterday": round(daily_sales_prev, 2),
                "sales_change_pct": sales_change_pct,
                "in_transit_value_sar": round(float(in_transit_value), 2),
                "errors_unresolved_count": errors_unresolved,
                "negative_stock_count": negative_stock_count,
            },
            "pending_transfers": pending_transfers,
            "latest_errors": latest_errors,
            "sales_vs_waste_by_branch": sales_vs_waste,
            "low_stock_items": low_stock,
        })
