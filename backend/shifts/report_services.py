"""
التقارير المالية – Single Source of Truth: ShiftClosing only.
All 5 reports derive from the same queryset. No duplicate calculations.
"""
from datetime import date, timedelta
from typing import Any

from shifts.models import ShiftClosing


def _apply_scope(qs, scope: dict, branch_field: str = "shift__branch_id"):
    """Apply user branch/brand scope to queryset."""
    if scope.get("branch_ids"):
        return qs.filter(**{f"{branch_field}__in": scope["branch_ids"]})
    if scope.get("brand_ids"):
        return qs.filter(**{f"shift__branch__brand_id__in": scope["brand_ids"]})
    return qs


def get_shift_closing_queryset(
    date_from: date,
    date_to: date,
    branch_ids: list[int] | None = None,
    brand_slug: str | None = None,
    employee_id: int | None = None,
    submitted_only: bool = True,
    scope: dict | None = None,
):
    """
    Single query for all reports. Returns queryset of ShiftClosing.
    """
    qs = ShiftClosing.objects.filter(
        shift__opened_at__date__gte=date_from,
        shift__opened_at__date__lte=date_to,
    ).select_related(
        "shift",
        "shift__branch",
        "shift__branch__brand",
        "submitted_by",
    )
    if submitted_only:
        qs = qs.filter(status="submitted")
    if branch_ids:
        qs = qs.filter(shift__branch_id__in=branch_ids)
    if brand_slug:
        qs = qs.filter(shift__branch__brand__slug=brand_slug)
    if employee_id:
        qs = qs.filter(submitted_by_id=employee_id)
    if scope:
        qs = _apply_scope(qs, scope)
    return qs.order_by("shift__opened_at", "shift__branch__name")


# --- Report A: Daily Sales (تقرير المبيعات اليومية) ---
def get_daily_sales_report(closings: list) -> list[dict[str, Any]]:
    """Branch x Date: sales, tax (15%), total. Aggregated from ShiftClosing."""
    by_branch_date: dict[tuple[int, str], dict] = {}
    for c in closings:
        bid = c.shift.branch_id
        d = str(c.shift.opened_at.date())
        key = (bid, d)
        if key not in by_branch_date:
            by_branch_date[key] = {
                "branch_id": bid,
                "branch_name": c.shift.branch.name,
                "branch_name_ar": getattr(c.shift.branch, "name_ar", None) or c.shift.branch.name,
                "brand_name": c.shift.branch.brand.name,
                "date": d,
                "sales": 0.0,
                "tax": 0.0,
                "total_sales": 0.0,
            }
        row = by_branch_date[key]
        st = float(c.system_total_sales or 0)
        cash = float(c.manual_cash_total())
        net = float(c.manual_network_total())
        deliv = float(c.manual_delivery_total())
        # Use system_total_sales when available, else sum of manual
        total = st if st > 0 else (cash + net + deliv)
        row["sales"] += total
    # Compute tax (15%) and total
    for row in by_branch_date.values():
        sales_val = float(row["sales"])
        row["tax"] = round(sales_val * 0.15, 2)
        row["total_sales"] = round(sales_val + row["tax"], 2)
    return sorted(by_branch_date.values(), key=lambda r: (r["date"], r["branch_name"]))


# --- Report B: Cash Report (تقرير المقبوضات) ---
def get_cash_report(closings: list) -> list[dict[str, Any]]:
    """Actual cash vs system expected per day per branch."""
    by_branch_date: dict[tuple[int, str], dict] = {}
    for c in closings:
        bid = c.shift.branch_id
        d = str(c.shift.opened_at.date())
        key = (bid, d)
        if key not in by_branch_date:
            by_branch_date[key] = {
                "branch_id": bid,
                "branch_name": c.shift.branch.name,
                "date": d,
                "actual_cash": 0.0,
                "system_cash": 0.0,
                "variance": 0.0,
            }
        row = by_branch_date[key]
        actual = float(c.manual_cash_total())
        system = float(c.system_cash or 0)
        row["actual_cash"] += actual
        row["system_cash"] += system
    for row in by_branch_date.values():
        row["variance"] = round(row["actual_cash"] - row["system_cash"], 2)
    return sorted(by_branch_date.values(), key=lambda r: (r["date"], r["branch_name"]))


# --- Report C: Network Operations (تقرير عمليات الشبكة) ---
def get_network_report(closings: list) -> list[dict[str, Any]]:
    """Card/MADA/Network totals per day per branch for bank reconciliation."""
    by_branch_date: dict[tuple[int, str], dict] = {}
    for c in closings:
        bid = c.shift.branch_id
        d = str(c.shift.opened_at.date())
        key = (bid, d)
        if key not in by_branch_date:
            by_branch_date[key] = {
                "branch_id": bid,
                "branch_name": c.shift.branch.name,
                "date": d,
                "mada": 0.0,
                "visa": 0.0,
                "master_card": 0.0,
                "network_total": 0.0,
                "system_network": 0.0,
                "variance": 0.0,
            }
        row = by_branch_date[key]
        mada = float(c.mada or 0)
        visa = float(c.visa or 0)
        mc = float(c.master_card or 0)
        net_total = mada + visa + mc
        sys_net = float(c.system_network or 0)
        row["mada"] += mada
        row["visa"] += visa
        row["master_card"] += mc
        row["network_total"] += net_total
        row["system_network"] += sys_net
    for row in by_branch_date.values():
        row["variance"] = round(row["network_total"] - row["system_network"], 2)
    return sorted(by_branch_date.values(), key=lambda r: (r["date"], r["branch_name"]))


# --- Report D: Cashier Shortage (تقرير عجز الكاشير) ---
def get_cashier_shortage_report(closings: list) -> list[dict[str, Any]]:
    """Per closing: employee who closed, expected, actual, shortage/surplus."""
    rows = []
    for c in closings:
        if not c.submitted_by_id:
            continue
        expected = float(c.system_cash or 0)
        actual = float(c.manual_cash_total())
        variance = round(actual - expected, 2)
        rows.append({
            "closing_id": c.id,
            "date": str(c.shift.opened_at.date()),
            "branch_name": c.shift.branch.name,
            "shift_type": c.shift.shift_type,
            "employee_name": (
                getattr(c.submitted_by, "first_name", "") or ""
                + " "
                + getattr(c.submitted_by, "last_name", "") or ""
            ).strip() or c.submitted_by.username,
            "employee_username": c.submitted_by.username,
            "expected_amount": expected,
            "actual_amount": actual,
            "variance": variance,
            "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
        })
    return sorted(rows, key=lambda r: (r["date"], r["branch_name"], r["shift_type"]))


# --- Report E: Journal Entry (القيد اليومي) ---
def get_journal_entry_report(closings: list) -> list[dict[str, Any]]:
    """
    Accounting-style entries: debit/credit from shift closing.
    Format: تاريخ | وصف | حساب مدين | حساب دائن | مبلغ مدين | مبلغ دائن
    """
    entries = []
    for c in closings:
        d = str(c.shift.opened_at.date())
        branch = c.shift.branch.name
        shift_type = c.shift.shift_type
        desc = f"إقفال وردية {shift_type} - {branch}"

        cash = float(c.manual_cash_total())
        network = float(c.manual_network_total())
        delivery = float(c.manual_delivery_total())
        expenses = float(c.expenses_vouchers or 0) + float(c.staff_drinks or 0)

        # Revenue entries (إيرادات): مدين صندوق/بنك، دائن إيرادات المبيعات
        if cash > 0:
            entries.append({
                "date": d,
                "description": f"{desc} - نقد",
                "debit_account": "صندوق فرعي",
                "credit_account": "إيرادات المبيعات",
                "debit_amount": cash,
                "credit_amount": 0,
            })
        if network > 0:
            entries.append({
                "date": d,
                "description": f"{desc} - شبكة",
                "debit_account": "بنك - بطاقات",
                "credit_account": "إيرادات المبيعات",
                "debit_amount": network,
                "credit_amount": 0,
            })
        if delivery > 0:
            entries.append({
                "date": d,
                "description": f"{desc} - تطبيقات توصيل",
                "debit_account": "بنك - توصيل",
                "credit_account": "إيرادات المبيعات",
                "debit_amount": delivery,
                "credit_amount": 0,
            })
        if expenses > 0:
            entries.append({
                "date": d,
                "description": f"{desc} - مصروفات",
                "debit_account": "مصروفات تشغيلية",
                "credit_account": "صندوق فرعي",
                "debit_amount": expenses,
                "credit_amount": 0,
            })
    return sorted(entries, key=lambda r: (r["date"], r["description"]))


def get_hub_executive_summary(
    date_from: date | None = None,
    date_to: date | None = None,
    finalized_only: bool = True,
) -> list[dict[str, Any]]:
    """
    ملخص تنفيذي للـ Hub – من إقفالات معتمدة فقط.
    العلامة التجارية، الفرع، إجمالي المبيعات، الضريبة، الخصومات، صافي المبيعات.
    """
    from accounting.models import DailyAccountingStatus

    if finalized_only:
        finalized_dates = set(
            DailyAccountingStatus.objects.values_list("report_date", flat=True)
        )
        if not finalized_dates:
            return []
    else:
        finalized_dates = None

    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today()

    qs = ShiftClosing.objects.filter(
        shift__opened_at__date__gte=date_from,
        shift__opened_at__date__lte=date_to,
        status="submitted",
    ).select_related("shift", "shift__branch", "shift__branch__brand")

    if finalized_only and finalized_dates is not None:
        qs = qs.filter(shift__opened_at__date__in=finalized_dates)

    by_branch: dict[int, dict[str, Any]] = {}
    for c in qs:
        bid = c.shift.branch_id
        branch = c.shift.branch
        if bid not in by_branch:
            by_branch[bid] = {
                "branch_id": bid,
                "brand_name": branch.brand.name,
                "brand_slug": branch.brand.slug,
                "branch_name": branch.name,
                "branch_reference": getattr(branch, "branch_code", None) or getattr(branch, "code", "") or "",
                "gross_sales": 0.0,
                "tax": 0.0,
                "discounts": 0.0,
                "net_sales": 0.0,
            }
        row = by_branch[bid]
        st = float(c.system_total_sales or 0)
        cash = float(c.manual_cash_total())
        net = float(c.manual_network_total())
        deliv = float(c.manual_delivery_total())
        revenue = st if st > 0 else (cash + net + deliv)
        disc = float(c.expenses_vouchers or 0) + float(c.staff_drinks or 0)
        tax_val = round(revenue * 0.15, 2)
        row["net_sales"] += revenue
        row["tax"] += tax_val
        row["discounts"] += disc
        row["gross_sales"] += revenue + tax_val

    return sorted(by_branch.values(), key=lambda r: (r["brand_name"], r["branch_name"]))


def build_all_reports(
    date_from: date,
    date_to: date,
    branch_ids: list[int] | None = None,
    brand_slug: str | None = None,
    employee_id: int | None = None,
    scope: dict | None = None,
) -> dict[str, list]:
    """Single query, five report views."""
    closings_qs = get_shift_closing_queryset(
        date_from=date_from,
        date_to=date_to,
        branch_ids=branch_ids,
        brand_slug=brand_slug,
        employee_id=employee_id,
        scope=scope,
    )
    closings = list(closings_qs)

    return {
        "daily_sales": get_daily_sales_report(closings),
        "cash_report": get_cash_report(closings),
        "network_report": get_network_report(closings),
        "cashier_shortage": get_cashier_shortage_report(closings),
        "journal_entry": get_journal_entry_report(closings),
    }
