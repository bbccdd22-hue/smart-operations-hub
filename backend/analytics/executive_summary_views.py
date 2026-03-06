"""
Executive Summary API – تجميع أداء النظام للمالك.
Aggregates ProductSale, COGS (profit_services), and JournalEntryLine for Net Margin.
"""
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Sum

from rest_framework import permissions, response, views

from accounting.consolidation_services import get_consolidated_income
from accounting.models import JournalEntryLine
from core.permissions import get_user_scope, is_super_admin
from org.models import Branch

from analytics.report_data_sources import CANONICAL_SALES_FIELD, PRODUCT_SALE_EXCLUDE_SUMMARY
from imports.models import ProductSale
from inventory.profit_services import get_profit_summary


def _resolve_branch_ids(request):
    """Resolve branch_ids from request params and user scope (same as executive_dashboard_views)."""
    branch_id = request.query_params.get("branch_id")
    brand = request.query_params.get("brand")
    brands_param = request.query_params.get("brands")

    qs = Branch.objects.filter(is_active=True)
    if brand:
        qs = qs.filter(brand__slug=brand)
    elif brands_param:
        slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
        if slugs:
            qs = qs.filter(brand__slug__in=slugs)

    if request.user.is_authenticated:
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None:
            qs = qs.filter(id__in=(scope["branch_ids"] or []))

    branch_ids = list(qs.values_list("id", flat=True))
    if branch_id:
        try:
            bid = int(branch_id)
            if bid in branch_ids:
                branch_ids = [bid]
        except (ValueError, TypeError):
            pass

    return branch_ids if branch_ids else list(Branch.objects.filter(is_active=True).values_list("id", flat=True))


class ExecutiveSummaryView(views.APIView):
    """
    GET /api/reports/executive-summary/
    Query params: from_date, to_date (YYYY-MM-DD), branch_id (optional), brand (optional).

    Returns:
    - total_revenue, total_cogs, gross_profit (from ProductSale + profit_services)
    - net_margin (from JournalEntryLine: revenue/expense accounts)
    - by_branch: [{ branch_id, branch_name, sales, expenses }] for bar chart
    - by_category: [{ category, sales }] for pie chart (product_name grouping)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_super_admin(request.user):
            from core.permissions import _role_has_permission, get_user_profile
            profile = get_user_profile(request.user)
            if not _role_has_permission(profile, "perm_full_system_access"):
                return response.Response({"detail": "غير مصرح"}, status=403)

        from_s = request.query_params.get("from_date") or request.query_params.get("date_from")
        to_s = request.query_params.get("to_date") or request.query_params.get("date_to")
        today = datetime.now().date()
        try:
            date_from = datetime.strptime(from_s, "%Y-%m-%d").date() if from_s else today - timedelta(days=30)
            date_to = datetime.strptime(to_s, "%Y-%m-%d").date() if to_s else today
        except ValueError:
            date_from = today - timedelta(days=30)
            date_to = today
        if date_from > date_to:
            date_from, date_to = date_to, date_from

        branch_ids = _resolve_branch_ids(request)
        if not branch_ids:
            return response.Response({
                "total_revenue": "0",
                "total_cogs": "0",
                "gross_profit": "0",
                "net_margin_pct": 0,
                "by_branch": [],
                "by_category": [],
                "filters": {"from_date": str(date_from), "to_date": str(date_to), "branch_ids": []},
            })

        # 1) Revenue, COGS, Gross Profit from ProductSale + profit_services
        profit = get_profit_summary(branch_ids=branch_ids, date_from=date_from, date_to=date_to)
        total_revenue = Decimal(profit.get("total_sales", "0") or "0")
        total_cogs = Decimal(profit.get("total_cogs", "0") or "0")
        gross_profit = total_revenue - total_cogs

        # 2) Net Margin from accounting (JournalEntryLine: revenue 4*, expense 5*)
        inc = get_consolidated_income(
            branch_ids=branch_ids,
            from_date=date_from.isoformat(),
            to_date=date_to.isoformat(),
        )
        accounting_revenue = inc.get("total_revenue") or Decimal("0")
        net_income = inc.get("net_income") or Decimal("0")
        net_margin_pct = float((net_income / accounting_revenue * 100).quantize(Decimal("0.01"))) if accounting_revenue else 0

        # 3) By branch: sales (ProductSale) + expenses (JournalEntryLine expense accounts)
        branch_sales = (
            ProductSale.objects.filter(
                branch_id__in=branch_ids,
                date__gte=date_from,
                date__lte=date_to,
            )
            .exclude(PRODUCT_SALE_EXCLUDE_SUMMARY)
            .values("branch_id")
            .annotate(sales=Sum(CANONICAL_SALES_FIELD))
        )
        sales_by_branch = {r["branch_id"]: float(r["sales"] or 0) for r in branch_sales}

        expense_lines = (
            JournalEntryLine.objects.filter(
                journal_entry__branch_id__in=branch_ids,
                journal_entry__entry_date__gte=date_from,
                journal_entry__entry_date__lte=date_to,
            )
            .filter(account__statement="قائمة الدخل", account__code__startswith="5")
            .values("journal_entry__branch_id")
            .annotate(exp=Sum("debit_amount"))
        )
        expenses_by_branch = {r["journal_entry__branch_id"]: float(r["exp"] or 0) for r in expense_lines}

        by_branch = []
        for b in Branch.objects.filter(id__in=branch_ids).order_by("name"):
            by_branch.append({
                "branch_id": b.id,
                "branch_name": b.name_ar or b.name,
                "sales": round(sales_by_branch.get(b.id, 0), 2),
                "expenses": round(expenses_by_branch.get(b.id, 0), 2),
            })

        # 4) By category: ProductSale grouped by product_name (top slices for pie)
        category_agg = (
            ProductSale.objects.filter(
                branch_id__in=branch_ids,
                date__gte=date_from,
                date__lte=date_to,
            )
            .exclude(PRODUCT_SALE_EXCLUDE_SUMMARY)
            .values("product_name")
            .annotate(sales=Sum(CANONICAL_SALES_FIELD))
            .order_by("-sales")[:20]
        )
        by_category = [{"category": r["product_name"] or "—", "sales": round(float(r["sales"] or 0), 2)} for r in category_agg]

        return response.Response({
            "total_revenue": str(total_revenue),
            "total_cogs": str(total_cogs),
            "gross_profit": str(gross_profit),
            "net_margin_pct": round(net_margin_pct, 2),
            "by_branch": by_branch,
            "by_category": by_category,
            "filters": {"from_date": str(date_from), "to_date": str(date_to), "branch_ids": branch_ids},
        })
