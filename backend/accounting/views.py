"""
Accounting & Reconciliation API.
"""
from datetime import date, datetime, timedelta

from django.http import HttpResponse
from rest_framework import permissions, response, views

from accounting.daily_report import generate_daily_report_excel
from accounting.services import (
    get_daily_reconciliation,
    get_cash_to_bank,
    get_discrepancy_alerts,
)
from core.permissions import get_user_scope


class DailyReconciliationView(views.APIView):
    """Reconciliation table for a given date."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        date_str = request.query_params.get("date")
        brand = request.query_params.get("brand")
        branch_ids = request.query_params.get("branch_ids")
        target = date.today()
        if date_str:
            try:
                target = datetime.fromisoformat(date_str).date()
            except ValueError:
                pass

        bids = None
        if branch_ids:
            try:
                bids = [int(x.strip()) for x in branch_ids.split(",") if x.strip()]
            except ValueError:
                pass

        rows = get_daily_reconciliation(target, brand_slug=brand, branch_ids=bids)
        return response.Response({
            "date": str(target),
            "rows": rows,
        })


class CashToBankView(views.APIView):
    """Cash-to-Bank report for Owner."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        date_str = request.query_params.get("date")
        brand = request.query_params.get("brand")
        target = date.today()
        if date_str:
            try:
                target = datetime.fromisoformat(date_str).date()
            except ValueError:
                pass

        data = get_cash_to_bank(target, brand_slug=brand)
        return response.Response(data)


class DiscrepancyAlertsView(views.APIView):
    """Recurring shortage alerts by branch."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        days = int(request.query_params.get("days", "30"))
        brand = request.query_params.get("brand")
        min_occurrences = int(request.query_params.get("min_occurrences", "2"))
        threshold = float(request.query_params.get("threshold", "50"))

        alerts = get_discrepancy_alerts(
            days=days,
            brand_slug=brand,
            min_occurrences=min_occurrences,
            threshold=threshold,
        )
        return response.Response({"alerts": alerts})


class DailyReportExportView(views.APIView):
    """Download Daily Financial Report (تقرير الحسابات اليومي) - Excel, Arabic, only SUBMITTED shifts."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        date_str = request.query_params.get("date")
        brand = request.query_params.get("brand")
        target = date.today()
        if date_str:
            try:
                target = datetime.fromisoformat(date_str).date()
            except ValueError:
                pass

        buffer = generate_daily_report_excel(target, brand_slug=brand)
        resp = HttpResponse(
            buffer.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = f'attachment; filename="تقرير_الحسابات_{target}.xlsx"'
        return resp


class SubmittedBranchesView(views.APIView):
    """Branch IDs that have SUBMITTED shifts for a date (for dashboard green checkmark)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        date_str = request.query_params.get("date")
        target = date.today()
        if date_str:
            try:
                target = datetime.fromisoformat(date_str).date()
            except ValueError:
                pass
        from shifts.models import ShiftClosing
        branch_ids = list(
            ShiftClosing.objects.filter(
                status="submitted",
                shift__opened_at__date=target,
            ).values_list("shift__branch_id", flat=True).distinct()
        )
        return response.Response({"date": str(target), "branch_ids": branch_ids})


class PendingSubmissionsView(views.APIView):
    """Count of shifts pending review (submitted but day not finalized) for a date."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        date_str = request.query_params.get("date")
        brand = request.query_params.get("brand")
        target = date.today()
        if date_str:
            try:
                target = datetime.fromisoformat(date_str).date()
            except ValueError:
                pass

        from shifts.models import ShiftClosing
        qs = ShiftClosing.objects.filter(
            status="submitted",
            shift__opened_at__date=target,
        )
        if brand:
            qs = qs.filter(shift__branch__brand__slug=brand)
        count = qs.count()
        from accounting.models import DailyAccountingStatus
        is_finalized = DailyAccountingStatus.objects.filter(report_date=target).exists()
        return response.Response({
            "date": str(target),
            "pending_count": count,
            "is_finalized": is_finalized,
        })


class FinalizeDayView(views.APIView):
    """Owner finalizes the day's accounts."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        date_str = request.data.get("date")
        if not date_str:
            return response.Response({"detail": "date required"}, status=400)
        try:
            target = datetime.fromisoformat(date_str).date()
        except ValueError:
            return response.Response({"detail": "Invalid date"}, status=400)

        from accounting.models import DailyAccountingStatus
        obj, created = DailyAccountingStatus.objects.update_or_create(
            report_date=target,
            defaults={"finalized_by": request.user},
        )
        return response.Response({
            "date": str(target),
            "finalized": True,
        })


class ExportReconciliationView(views.APIView):
    """Export reconciliation as Excel, CSV, or PDF."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        date_str = request.query_params.get("date")
        brand = request.query_params.get("brand")
        fmt = request.query_params.get("format", "xlsx")  # xlsx, csv, pdf
        target = date.today()
        if date_str:
            try:
                target = datetime.fromisoformat(date_str).date()
            except ValueError:
                pass

        rows = get_daily_reconciliation(target, brand_slug=brand)

        if fmt == "pdf":
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from io import BytesIO

            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4)
            elements = []
            styles = getSampleStyleSheet()
            elements.append(Paragraph(f"Daily Reconciliation Report - {target}", styles["Title"]))
            elements.append(Spacer(1, 12))

            data = [
                ["Branch", "System Cash\n(نقد)", "Actual Cash\n(إجمالي المقبوضات)", "Cash Var",
                 "System Card\n(الشبكة)", "Actual Card", "Card Var", "Delivery Apps", "Notes"]
            ]
            for r in rows:
                data.append([
                    str(r["branch_name"]),
                    f"{r['system_cash']:.2f}",
                    f"{r['actual_cash']:.2f}",
                    f"{r['cash_variance']:.2f}",
                    f"{r['system_card']:.2f}",
                    f"{r['actual_card']:.2f}",
                    f"{r['card_variance']:.2f}",
                    f"{r['delivery_total']:.2f}",
                    (r["manual_notes"] or "")[:50] + ("..." if len(r["manual_notes"] or "") > 50 else ""),
                ])

            t = Table(data)
            style_commands = [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4472C4")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
            ]
            for i, r in enumerate(rows):
                row_idx = i + 1
                if r.get("cash_variance") and r["cash_variance"] != 0:
                    style_commands.append(("BACKGROUND", (3, row_idx), (3, row_idx), colors.HexColor("#FFC7CE")))
                if r.get("card_variance") and r["card_variance"] != 0:
                    style_commands.append(("BACKGROUND", (6, row_idx), (6, row_idx), colors.HexColor("#FFC7CE")))
            t.setStyle(TableStyle(style_commands))
            elements.append(t)
            doc.build(elements)
            buffer.seek(0)
            resp = HttpResponse(buffer.read(), content_type="application/pdf")
            resp["Content-Disposition"] = f'attachment; filename="reconciliation_{target}.pdf"'
            return resp

        if fmt == "csv":
            import csv
            from io import StringIO
            output = StringIO()
            writer = csv.writer(output)
            # Arabic headers with English fallback
            headers = [
                "Branch",
                "System Cash (نقد)",
                "Actual Cash (إجمالي المقبوضات)",
                "Cash Variance",
                "System Card (الشبكة)",
                "Actual Card",
                "Card Variance",
                "Delivery Apps",
                "Notes",
            ]
            writer.writerow(headers)
            for r in rows:
                writer.writerow([
                    r["branch_name"],
                    r["system_cash"],
                    r["actual_cash"],
                    r["cash_variance"],
                    r["system_card"],
                    r["actual_card"],
                    r["card_variance"],
                    r["delivery_total"],
                    r["manual_notes"],
                ])
            resp = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8-sig")
            resp["Content-Disposition"] = f'attachment; filename="reconciliation_{target}.csv"'
            return resp

        # Excel
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
        from io import BytesIO

        wb = Workbook()
        ws = wb.active
        ws.title = f"Reconciliation {target}"

        headers = [
            "Branch",
            "System Cash\n(نقد)",
            "Actual Cash\n(إجمالي المقبوضات)",
            "Cash Variance",
            "System Card\n(الشبكة)",
            "Actual Card",
            "Card Variance",
            "Delivery Apps",
            "Notes",
        ]
        for col, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=h.replace("\n", " "))
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
            cell.font = Font(bold=True, color="FFFFFF")

        for row_idx, r in enumerate(rows, 2):
            ws.cell(row=row_idx, column=1, value=r["branch_name"])
            ws.cell(row=row_idx, column=2, value=r["system_cash"])
            ws.cell(row=row_idx, column=3, value=r["actual_cash"])
            cash_var_cell = ws.cell(row=row_idx, column=4, value=r["cash_variance"])
            if r["cash_variance"] != 0:
                cash_var_cell.fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
            ws.cell(row=row_idx, column=5, value=r["system_card"])
            ws.cell(row=row_idx, column=6, value=r["actual_card"])
            card_var_cell = ws.cell(row=row_idx, column=7, value=r["card_variance"])
            if r["card_variance"] != 0:
                card_var_cell.fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
            ws.cell(row=row_idx, column=8, value=r["delivery_total"])
            ws.cell(row=row_idx, column=9, value=r["manual_notes"])

        from openpyxl.utils import get_column_letter
        for col in range(1, 10):
            ws.column_dimensions[get_column_letter(col)].width = 18 if col == 9 else 16

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        resp = HttpResponse(buffer.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = f'attachment; filename="reconciliation_{target}.xlsx"'
        return resp
