"""
Excel Daily Financial Report (تقرير الحسابات اليومي).
- Structure matches PDF: Branch | Today Revenue | App Revenue | Cash (M/E/N) | Card (SPAN/VISA) | Variance
- Only SUBMITTED shifts
- Full Arabic, Tajawal font
- Red highlight for variance cells
"""
from datetime import date
from decimal import Decimal
from io import BytesIO
from typing import Any

from django.db.models import Sum
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

from imports.models import DailySale
from org.models import Branch
from shifts.models import ShiftClosing, ShiftType


def _branch_name_ar(branch: Branch) -> str:
    return (branch.name_ar or branch.name).strip() or branch.name


def _get_submitted_shifts_by_branch(target_date: date, brand_slug: str | None = None) -> dict[int, list[Any]]:
    qs = ShiftClosing.objects.filter(
        status="submitted",
        shift__opened_at__date=target_date,
    ).select_related("shift", "shift__branch", "shift__branch__brand")
    if brand_slug:
        qs = qs.filter(shift__branch__brand__slug=brand_slug)

    by_branch: dict[int, list] = {}
    for c in qs:
        bid = c.shift.branch_id
        by_branch.setdefault(bid, []).append(c)
    return by_branch


def _get_system_by_branch(target_date: date, branch_ids: list[int]) -> dict[int, dict]:
    rows = DailySale.objects.filter(
        date=target_date,
        branch_id__in=branch_ids,
    ).values("branch_id").annotate(
        cash=Sum("cash_amount"),
        network=Sum("network_amount"),
        total=Sum("total_sales"),
    )
    return {r["branch_id"]: r for r in rows}


def generate_daily_report_excel(
    target_date: date,
    brand_slug: str | None = None,
) -> BytesIO:
    """
    Generate Excel matching تقرير الحساقات اليومي.
    Columns: الفرع | إيرادات اليوم | إيرادات التطبيقات | نقد صباحي | نقد مسائي | نقد ليلي | شبكة | الفرق | ملاحظات
    """
    submitted_by_branch = _get_submitted_shifts_by_branch(target_date, brand_slug)
    branch_ids = list(submitted_by_branch.keys())
    if not branch_ids:
        wb = Workbook()
        ws = wb.active
        ws.title = f"تقرير {target_date}"
        ws["A1"] = "لا توجد بيانات مقبولة لهذا التاريخ"
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        return buf

    qs = Branch.objects.filter(id__in=branch_ids).select_related("brand").order_by("brand__name", "name")
    system_by_branch = _get_system_by_branch(target_date, branch_ids)

    wb = Workbook()
    ws = wb.active
    ws.title = f"تقرير {target_date}"
    ws.sheet_view.rightToLeft = True

    # Tajawal font
    tajawal = Font(name="Tajawal", size=11)
    tajawal_bold = Font(name="Tajawal", size=11, bold=True)
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font = Font(name="Tajawal", size=11, bold=True, color="FFFFFF")
    var_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")

    headers = [
        "الفرع",
        "إيرادات اليوم",
        "إيرادات التطبيقات",
        "نقد صباحي",
        "نقد مسائي",
        "نقد ليلي",
        "إجمالي النقد",
        "شبكة (SPAN/VISA)",
        "الفرق",
        "ملاحظات",
    ]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", wrap_text=True)

    total_revenue = 0
    total_app = 0
    total_cash = 0
    total_card = 0

    for row_idx, branch in enumerate(qs, 2):
        closings = submitted_by_branch.get(branch.id, [])
        sys = system_by_branch.get(branch.id, {})

        cash_morning = cash_evening = cash_night = 0
        for c in closings:
            cash = float(c.manual_cash_total())
            if c.shift.shift_type == ShiftType.MORNING:
                cash_morning = cash
            elif c.shift.shift_type == ShiftType.EVENING:
                cash_evening = cash
            else:
                cash_night = cash

        actual_cash = sum(float(c.manual_cash_total()) for c in closings)
        actual_card = sum(float(c.manual_network_total()) for c in closings)
        app_revenue = sum(float(c.manual_delivery_total()) for c in closings)
        system_cash = float(sys.get("cash") or 0)
        system_network = float(sys.get("network") or 0)
        today_revenue = float(sys.get("total") or 0) or (actual_cash + actual_card + app_revenue)

        variance = round(actual_cash - system_cash, 2)
        notes = " | ".join((c.shift.notes or "").strip() for c in closings if (c.shift.notes or "").strip())

        total_revenue += today_revenue
        total_app += app_revenue
        total_cash += actual_cash
        total_card += actual_card

        ws.cell(row=row_idx, column=1, value=_branch_name_ar(branch)).font = tajawal
        ws.cell(row=row_idx, column=2, value=round(today_revenue, 2)).font = tajawal
        ws.cell(row=row_idx, column=3, value=round(app_revenue, 2)).font = tajawal
        ws.cell(row=row_idx, column=4, value=round(cash_morning, 2)).font = tajawal
        ws.cell(row=row_idx, column=5, value=round(cash_evening, 2)).font = tajawal
        ws.cell(row=row_idx, column=6, value=round(cash_night, 2)).font = tajawal
        ws.cell(row=row_idx, column=7, value=round(actual_cash, 2)).font = tajawal
        ws.cell(row=row_idx, column=8, value=round(actual_card, 2)).font = tajawal
        var_cell = ws.cell(row=row_idx, column=9, value=round(variance, 2))
        var_cell.font = tajawal
        if variance != 0:
            var_cell.fill = var_fill
        ws.cell(row=row_idx, column=10, value=notes[:200]).font = tajawal

    # Summary row
    summary_row = row_idx + 2
    ws.cell(row=summary_row, column=1, value="إجمالي إيرادات العلامات").font = tajawal_bold
    ws.cell(row=summary_row, column=2, value=round(total_revenue, 2)).font = tajawal_bold
    ws.cell(row=summary_row, column=3, value=round(total_app, 2)).font = tajawal_bold
    ws.cell(row=summary_row, column=7, value=round(total_cash, 2)).font = tajawal_bold
    ws.cell(row=summary_row, column=8, value=round(total_card, 2)).font = tajawal_bold

    for col in range(1, 11):
        ws.column_dimensions[get_column_letter(col)].width = 16
    ws.column_dimensions["J"].width = 35

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
