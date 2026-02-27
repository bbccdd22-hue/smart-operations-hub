"""
Accounting & Reconciliation API.
"""
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.http import HttpResponse
from rest_framework import permissions, response, status, views
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView

from core.permissions import (
    can_delete_chart_or_users,
    can_manage_chart_accounts,
    can_upload_or_modify_data,
    get_user_profile,
    is_read_only_role,
)

from accounting.daily_report import generate_daily_report_excel
from accounting.models import ChartAccount, CostAuditEntry, CostUpload, ManualAdjustment
from accounting.serializers import ChartAccountSerializer
from accounting.services import (
    get_daily_reconciliation,
    get_cash_to_bank,
    get_discrepancy_alerts,
)
from core.permissions import get_user_scope


class DailyReconciliationView(views.APIView):
    """Reconciliation table for a given date."""
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            days = int(request.query_params.get("days", "30"))
        except (TypeError, ValueError):
            days = 30
        brand = request.query_params.get("brand")
        try:
            min_occurrences = int(request.query_params.get("min_occurrences", "2"))
        except (TypeError, ValueError):
            min_occurrences = 2
        try:
            threshold = float(request.query_params.get("threshold", "50"))
        except (TypeError, ValueError):
            threshold = 50.0

        alerts = get_discrepancy_alerts(
            days=days,
            brand_slug=brand,
            min_occurrences=min_occurrences,
            threshold=threshold,
        )
        return response.Response({"alerts": alerts})


class DailyReportExportView(views.APIView):
    """Download Daily Financial Report (تقرير الحسابات اليومي) - Excel, Arabic, only SUBMITTED shifts."""
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

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




def _chart_account_has_balance(account):
    """قاعدة سيف: لا يمكن حذف حساب له رصيد أو حركات."""
    return bool(getattr(account, "balance", None) and float(account.balance) != 0)


class ChartAccountListView(views.APIView):
    """دليل الشجرة المحاسبية – قائمة + إنشاء."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = ChartAccount.objects.filter(is_active=True).order_by("code")
        data = ChartAccountSerializer(qs, many=True).data
        return response.Response(data)

    def post(self, request):
        if not can_manage_chart_accounts(request.user):
            return response.Response({"detail": "سيف أو المدير العام فقط"}, status=status.HTTP_403_FORBIDDEN)
        ser = ChartAccountSerializer(data=request.data)
        if not ser.is_valid():
            return response.Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return response.Response(ser.data, status=status.HTTP_201_CREATED)


def _recalc_chart_balance_from_upload(upload_id: int) -> int:
    """إعادة حساب أرصدة الحسابات من إدخالات الرفع غير المستبعدة."""
    from django.db.models import Sum
    all_codes = set(
        CostAuditEntry.objects.filter(upload_id=upload_id)
        .values_list("account_code", flat=True)
        .distinct()
    )
    agg = CostAuditEntry.objects.filter(
        upload_id=upload_id,
        is_excluded=False,
    ).values("account_code").annotate(total=Sum("amount"))
    by_code = {r["account_code"]: (r["total"] or Decimal("0")) for r in agg}
    updated = 0
    for code in all_codes:
        total = by_code.get(code, Decimal("0"))
        ChartAccount.objects.filter(code=code, is_active=True).update(
            balance=total,
            updated_at=datetime.now(),
        )
        updated += 1
    return updated


class ChartAccountImportBalancesView(views.APIView):
    """
    محرك رفع البيانات المالي – تحديث أرصدة الحسابات من ملف الإكسل.
    POST body: { "balances": {...} } أو { "rows": [...], "source_file": "..." }
    عند وجود rows يُنشأ سجل تدقيق لكل صف.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not can_upload_or_modify_data(request.user) or is_read_only_role(get_user_profile(request.user)):
            return response.Response({"detail": "صلاحية الرفع مطلوبة"}, status=status.HTTP_403_FORBIDDEN)

        rows = request.data.get("rows")
        source_file = (request.data.get("source_file") or "").strip() or "رفع يدوي"
        balances = request.data.get("balances")

        if rows and isinstance(rows, list):
            # تدفق جديد: صفوف تفصيلية مع مصدر الملف
            cost_upload = CostUpload.objects.create(
                source_file=source_file,
                uploaded_by=request.user if request.user.is_authenticated else None,
            )
            created = 0
            for r in rows:
                code = str(r.get("code") or "").strip()
                if not code:
                    continue
                try:
                    amount = Decimal(str(r.get("amount") or 0))
                except (InvalidOperation, TypeError, ValueError):
                    continue
                CostAuditEntry.objects.create(
                    upload=cost_upload,
                    account_code=code,
                    account_name=str(r.get("account_name") or "")[:255],
                    description=str(r.get("description") or "")[:500],
                    amount=amount,
                    source_file=source_file,
                    is_excluded=False,
                )
                created += 1
            _recalc_chart_balance_from_upload(cost_upload.id)
            return response.Response({
                "updated": created,
                "upload_id": cost_upload.id,
                "source_file": source_file,
            })

        # تدفق قديم: توازنات فقط
        if not isinstance(balances, dict):
            return response.Response(
                {"detail": "balances must be an object: { code: amount }"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cost_upload = CostUpload.objects.create(
            source_file=source_file,
            uploaded_by=request.user if request.user.is_authenticated else None,
        )
        updated = 0
        not_found = []
        errors = []
        for code, val in balances.items():
            code = str(code).strip()
            if not code:
                continue
            try:
                amount = Decimal(str(val))
            except (InvalidOperation, TypeError, ValueError):
                errors.append(f"{code}: invalid amount")
                continue
            try:
                acc = ChartAccount.objects.get(code=code, is_active=True)
                CostAuditEntry.objects.create(
                    upload=cost_upload,
                    account_code=code,
                    account_name=(acc.name_ar or acc.name_en or "")[:255],
                    description="",
                    amount=amount,
                    source_file=source_file,
                    is_excluded=False,
                )
                acc.balance = amount
                acc.save(update_fields=["balance", "updated_at"])
                updated += 1
            except ChartAccount.DoesNotExist:
                not_found.append(code)
        return response.Response({
            "updated": updated,
            "not_found": not_found[:50],
            "errors": errors[:20],
        })


class CostAuditListView(views.APIView):
    """سجل تدقيق التكاليف – قائمة تفصيلية بكل عملية تسجيل تكلفة."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = CostAuditEntry.objects.select_related("upload").order_by("-amount", "-created_at")
        upload_id = request.query_params.get("upload_id")
        if upload_id:
            try:
                qs = qs.filter(upload_id=int(upload_id))
            except ValueError:
                pass
        show_excluded = request.query_params.get("show_excluded", "true").lower() == "true"
        if not show_excluded:
            qs = qs.filter(is_excluded=False)
        rows = []
        for e in qs[:2000]:  # حد معقول
            rows.append({
                "id": e.id,
                "recorded_at": e.created_at.isoformat() if e.created_at else None,
                "account_code": e.account_code,
                "account_name": e.account_name,
                "description": e.description,
                "amount": str(e.amount),
                "source_file": e.source_file or (e.upload.source_file if e.upload else ""),
                "is_excluded": e.is_excluded,
                "upload_id": e.upload_id,
            })
        return response.Response({"entries": rows})


class CostAuditExcludeView(views.APIView):
    """استبعاد إدخال من الحساب – SAIF فقط."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if request.user.username != "SAIF":
            return response.Response({"detail": "سيف فقط – صلاحية الاستبعاد"}, status=status.HTTP_403_FORBIDDEN)
        try:
            entry = CostAuditEntry.objects.get(pk=pk)
        except CostAuditEntry.DoesNotExist:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        entry.is_excluded = request.data.get("is_excluded", True)
        entry.save(update_fields=["is_excluded", "updated_at"])
        if entry.upload_id:
            _recalc_chart_balance_from_upload(entry.upload_id)
        return response.Response({"id": entry.id, "is_excluded": entry.is_excluded})


class ManualAdjustmentCreateView(views.APIView):
    """إجراء تسوية محاسبية – SAIF فقط."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.username != "SAIF":
            return response.Response({"detail": "سيف فقط – صلاحية التسويات اليدوية"}, status=status.HTTP_403_FORBIDDEN)
        account_id = request.data.get("account_id")
        amount_val = request.data.get("amount")
        entry_type = request.data.get("entry_type", "credit")
        reason = (request.data.get("reason") or "").strip()
        if not account_id or not reason:
            return response.Response(
                {"detail": "account_id و reason مطلوبان"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            amount = Decimal(str(amount_val))
        except (InvalidOperation, TypeError, ValueError):
            return response.Response({"detail": "amount غير صالح"}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return response.Response({"detail": "المبلغ يجب أن يكون موجباً"}, status=status.HTTP_400_BAD_REQUEST)
        if entry_type not in ("debit", "credit"):
            return response.Response({"detail": "entry_type: debit أو credit"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            acc = ChartAccount.objects.get(pk=account_id, is_active=True)
        except ChartAccount.DoesNotExist:
            return response.Response({"detail": "الحساب غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        balance_before = acc.balance or Decimal("0")
        if entry_type == "debit":
            balance_after = balance_before + amount
        else:
            balance_after = balance_before - amount
        if balance_after < 0:
            balance_after = Decimal("0")
        acc.balance = balance_after
        acc.save(update_fields=["balance", "updated_at"])
        adj = ManualAdjustment.objects.create(
            account=acc,
            amount=amount,
            entry_type=entry_type,
            reason=reason,
            balance_before=balance_before,
            balance_after=balance_after,
            performed_by=request.user,
        )
        return response.Response({
            "id": adj.id,
            "account_id": acc.id,
            "account_code": acc.code,
            "account_name": acc.name_ar,
            "amount": str(amount),
            "entry_type": entry_type,
            "balance_before": str(balance_before),
            "balance_after": str(balance_after),
            "created_at": adj.created_at.isoformat() if adj.created_at else None,
        }, status=status.HTTP_201_CREATED)


class ManualAdjustmentLogView(views.APIView):
    """سجل التسويات – SAIF فقط، لا يُحذف."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.username != "SAIF":
            return response.Response({"detail": "سيف فقط"}, status=status.HTTP_403_FORBIDDEN)
        qs = ManualAdjustment.objects.select_related("account", "performed_by").order_by("-created_at")[:500]
        rows = []
        for a in qs:
            rows.append({
                "id": a.id,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "account_code": a.account.code,
                "account_name": a.account.name_ar,
                "amount": str(a.amount),
                "entry_type": a.entry_type,
                "reason": a.reason,
                "balance_before": str(a.balance_before),
                "balance_after": str(a.balance_after),
                "performed_by": (a.performed_by.username if a.performed_by else "") or "",
            })
        return response.Response({"adjustments": rows})


class ChartAccountDetailView(views.APIView):
    """تعديل / حذف حساب (مع فحص الرصيد). قاعدة سيف: قفل رقم الحساب والأب – منع تغيير الهيكل."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not can_manage_chart_accounts(request.user):
            return response.Response({"detail": "سيف أو المدير العام – تعديل الشجرة"}, status=status.HTTP_403_FORBIDDEN)
        try:
            acc = ChartAccount.objects.get(pk=pk)
        except ChartAccount.DoesNotExist:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        # [Ref: Chart Lock] منع تغيير الرقم التسلسلي أو هيكل الحسابات الأب
        if "code" in request.data and str(request.data.get("code", "")).strip() != str(acc.code):
            return response.Response(
                {"detail": "لا يمكن تغيير رقم الحساب – الشجرة مقفلة"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "parent" in request.data:
            new_parent = request.data.get("parent")
            current_parent = acc.parent_id
            if (new_parent is None and current_parent is not None) or (
                new_parent is not None and int(new_parent) != (current_parent or 0)
            ):
                return response.Response(
                    {"detail": "لا يمكن تغيير الحساب الأب – هيكل الشجرة مقفل"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        ser = ChartAccountSerializer(acc, data=request.data, partial=True)
        if not ser.is_valid():
            return response.Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return response.Response(ser.data)

    def delete(self, request, pk):
        if not can_delete_chart_or_users(request.user):
            return response.Response({"detail": "سيف فقط – صلاحية حذف الحسابات"}, status=status.HTTP_403_FORBIDDEN)
        try:
            acc = ChartAccount.objects.get(pk=pk)
        except ChartAccount.DoesNotExist:
            return response.Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if _chart_account_has_balance(acc):
            return response.Response(
                {"detail": "لا يمكن حذف حساب حقيقي به رصيد أو حركات مالية."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        acc.delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)


class ConsolidatedBalanceSheetView(views.APIView):
    """الميزانية الموحدة - تجميع أرصدة الحسابات من الفروع."""

    def get(self, request):
        from accounting.consolidation_services import get_consolidated_balance_sheet, get_consolidated_income

        org_id = request.query_params.get("organization_id")
        brand_ids = request.query_params.get("brand_ids")
        branch_ids = request.query_params.get("branch_ids")
        as_of = request.query_params.get("as_of")
        from_date = request.query_params.get("from_date")
        to_date = request.query_params.get("to_date")

        oid = int(org_id) if org_id and org_id.isdigit() else None
        bids = None
        if brand_ids:
            try:
                bids = [int(x.strip()) for x in brand_ids.split(",") if x.strip().isdigit()]
            except (ValueError, AttributeError):
                pass
        brids = None
        if branch_ids:
            try:
                brids = [int(x.strip()) for x in branch_ids.split(",") if x.strip().isdigit()]
            except (ValueError, AttributeError):
                pass

        balance_sheet = get_consolidated_balance_sheet(
            organization_id=oid, brand_ids=bids, branch_ids=brids, as_of_date=as_of
        )
        income = get_consolidated_income(
            organization_id=oid, brand_ids=bids, branch_ids=brids,
            from_date=from_date, to_date=to_date,
        )
        return response.Response({
            "balance_sheet": [
                {"code": b.code, "name_ar": b.name_ar, "name_en": b.name_en, "balance": str(b.balance)}
                for b in balance_sheet
            ],
            "income_statement": income,
        })


# ═══════════════════════════════════════════════════════════════════════════
# NEW ACCOUNTING MODULES — ميزان المراجعة / كشف حساب / قيد اليومية
# ═══════════════════════════════════════════════════════════════════════════

class TrialBalanceView(views.APIView):
    """
    ميزان المراجعة — Trial Balance
    يعرض جميع الحسابات مع مجموع المدين والدائن والرصيد.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum
        from accounting.models import JournalEntryLine

        from_date = request.query_params.get("from_date")
        to_date   = request.query_params.get("to_date")
        level_max = request.query_params.get("level", "5")
        stmt      = request.query_params.get("statement")  # optional: "المركز المالي" | "قائمة الدخل"

        try:
            level_max = int(level_max)
        except (ValueError, TypeError):
            level_max = 5

        qs = ChartAccount.objects.filter(is_active=True, level__lte=level_max).order_by("code")
        if stmt:
            qs = qs.filter(statement=stmt)

        # Build account-level movement aggregations (only analytical accounts have lines)
        lines_qs = JournalEntryLine.objects.all()
        if from_date:
            try:
                lines_qs = lines_qs.filter(journal_entry__entry_date__gte=from_date)
            except Exception:
                pass
        if to_date:
            try:
                lines_qs = lines_qs.filter(journal_entry__entry_date__lte=to_date)
            except Exception:
                pass

        # Aggregate by account code
        aggregated = lines_qs.values("account_code").annotate(
            total_debit=Sum("debit_amount"),
            total_credit=Sum("credit_amount"),
        )
        agg_map = {r["account_code"]: r for r in aggregated}

        rows = []
        grand_debit = Decimal("0.00")
        grand_credit = Decimal("0.00")

        for acc in qs:
            agg = agg_map.get(acc.code, {})
            if from_date or to_date:
                # Use journal aggregation
                debit  = Decimal(str(agg.get("total_debit")  or "0.00"))
                credit = Decimal(str(agg.get("total_credit") or "0.00"))
                balance = debit - credit
            else:
                # Use stored balance + any journal movements
                debit  = Decimal(str(agg.get("total_debit")  or "0.00"))
                credit = Decimal(str(agg.get("total_credit") or "0.00"))
                if debit == 0 and credit == 0:
                    # Fall back to stored balance
                    stored = acc.balance
                    if stored >= 0:
                        debit = stored
                    else:
                        credit = abs(stored)
                balance = debit - credit

            if acc.account_type == "تحليلي":
                grand_debit  += debit
                grand_credit += credit

            rows.append({
                "id":           acc.id,
                "code":         acc.code,
                "name_ar":      acc.name_ar,
                "name_en":      acc.name_en,
                "level":        acc.level,
                "account_type": acc.account_type,
                "statement":    acc.statement,
                "debit":        str(debit),
                "credit":       str(credit),
                "balance":      str(balance),
                "is_parent":    acc.account_type == "رئيسي",
            })

        return response.Response({
            "rows":          rows,
            "grand_debit":   str(grand_debit),
            "grand_credit":  str(grand_credit),
            "difference":    str(abs(grand_debit - grand_credit)),
            "is_balanced":   abs(grand_debit - grand_credit) < Decimal("0.01"),
            "from_date":     from_date,
            "to_date":       to_date,
        })


class AccountStatementView(views.APIView):
    """
    كشف حساب — Account Statement
    يعرض حركات حساب معين مع رصيد تراكمي.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum
        from accounting.models import JournalEntry, JournalEntryLine

        account_code = request.query_params.get("account_code", "").strip()
        from_date    = request.query_params.get("from_date")
        to_date      = request.query_params.get("to_date")
        branch_id    = request.query_params.get("branch_id")

        if not account_code:
            return response.Response({"detail": "account_code مطلوب"}, status=400)

        # Get account info
        try:
            acc = ChartAccount.objects.get(code=account_code)
        except ChartAccount.DoesNotExist:
            acc = None

        # Build lines queryset
        lines_qs = JournalEntryLine.objects.filter(
            account_code=account_code
        ).select_related("journal_entry", "journal_entry__branch").order_by(
            "journal_entry__entry_date", "id"
        )
        if from_date:
            lines_qs = lines_qs.filter(journal_entry__entry_date__gte=from_date)
        if to_date:
            lines_qs = lines_qs.filter(journal_entry__entry_date__lte=to_date)
        if branch_id:
            lines_qs = lines_qs.filter(journal_entry__branch_id=branch_id)

        running_balance = Decimal("0.00")
        transactions = []

        for line in lines_qs:
            entry = line.journal_entry
            running_balance += line.debit_amount - line.credit_amount
            transactions.append({
                "id":          line.id,
                "entry_id":    entry.id,
                "date":        str(entry.entry_date),
                "description": entry.description,
                "source_type": entry.source_type,
                "branch":      entry.branch.name if entry.branch else "",
                "debit":       str(line.debit_amount),
                "credit":      str(line.credit_amount),
                "balance":     str(running_balance),
            })

        total_debit  = sum(Decimal(r["debit"])  for r in transactions)
        total_credit = sum(Decimal(r["credit"]) for r in transactions)

        return response.Response({
            "account_code":  account_code,
            "account_name":  acc.name_ar if acc else account_code,
            "account_type":  acc.account_type if acc else "",
            "statement":     acc.statement if acc else "",
            "from_date":     from_date,
            "to_date":       to_date,
            "transactions":  transactions,
            "total_debit":   str(total_debit),
            "total_credit":  str(total_credit),
            "closing_balance": str(total_debit - total_credit),
        })


class JournalEntryListCreateView(views.APIView):
    """
    قيد اليومية — List & Create Journal Entries
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from accounting.models import JournalEntry, JournalEntryLine

        from_date   = request.query_params.get("from_date")
        to_date     = request.query_params.get("to_date")
        source_type = request.query_params.get("source_type")
        branch_id   = request.query_params.get("branch_id")
        page        = int(request.query_params.get("page", 1))
        page_size   = int(request.query_params.get("page_size", 20))

        qs = JournalEntry.objects.select_related("branch", "created_by").prefetch_related("lines__account").order_by("-entry_date", "-id")
        if from_date:
            qs = qs.filter(entry_date__gte=from_date)
        if to_date:
            qs = qs.filter(entry_date__lte=to_date)
        if source_type:
            qs = qs.filter(source_type=source_type)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        total = qs.count()
        start = (page - 1) * page_size
        entries = qs[start: start + page_size]

        rows = []
        for entry in entries:
            lines = []
            total_debit = Decimal("0.00")
            total_credit = Decimal("0.00")
            for line in entry.lines.all():
                total_debit  += line.debit_amount
                total_credit += line.credit_amount
                lines.append({
                    "id":           line.id,
                    "account_code": line.account_code,
                    "account_name": line.account_name_ar or (line.account.name_ar if line.account else ""),
                    "debit":        str(line.debit_amount),
                    "credit":       str(line.credit_amount),
                })
            rows.append({
                "id":          entry.id,
                "entry_date":  str(entry.entry_date),
                "description": entry.description,
                "source_type": entry.source_type,
                "branch":      entry.branch.name if entry.branch else "",
                "created_by":  str(entry.created_by) if entry.created_by else "",
                "total_debit": str(total_debit),
                "is_balanced": abs(total_debit - total_credit) < Decimal("0.01"),
                "lines":       lines,
            })

        return response.Response({
            "count":    total,
            "page":     page,
            "pages":    (total + page_size - 1) // page_size,
            "entries":  rows,
        })

    def post(self, request):
        """إنشاء قيد يومية يدوي."""
        from accounting.models import JournalEntry, JournalEntryLine
        import json
        from django.db import transaction as db_transaction

        if not can_upload_or_modify_data(request.user):
            return response.Response({"detail": "ليس لديك صلاحية إنشاء قيود"}, status=403)

        data = request.data
        entry_date  = data.get("entry_date")
        description = data.get("description", "").strip()
        branch_id   = data.get("branch_id")
        lines_data  = data.get("lines", [])

        if not entry_date or not description:
            return response.Response({"detail": "entry_date و description مطلوبان"}, status=400)
        if len(lines_data) < 2:
            return response.Response({"detail": "القيد يحتاج سطرين على الأقل"}, status=400)

        # Validate balance
        total_debit  = sum(Decimal(str(l.get("debit", 0))) for l in lines_data)
        total_credit = sum(Decimal(str(l.get("credit", 0))) for l in lines_data)
        if abs(total_debit - total_credit) >= Decimal("0.01"):
            return response.Response(
                {"detail": f"القيد غير متوازن: مدين {total_debit} ≠ دائن {total_credit}"},
                status=400
            )

        with db_transaction.atomic():
            entry = JournalEntry.objects.create(
                entry_date=entry_date,
                description=description,
                source_type="manual",
                branch_id=branch_id or None,
                created_by=request.user,
            )
            for line_data in lines_data:
                account_code = str(line_data.get("account_code", "")).strip()
                debit        = Decimal(str(line_data.get("debit", 0)))
                credit       = Decimal(str(line_data.get("credit", 0)))
                account_name = str(line_data.get("account_name", "")).strip()

                # Try to find account
                acc = None
                try:
                    acc = ChartAccount.objects.get(code=account_code)
                    if not account_name:
                        account_name = acc.name_ar
                    # Update account balance
                    acc.balance = acc.balance + debit - credit
                    acc.save(update_fields=["balance"])
                except ChartAccount.DoesNotExist:
                    pass

                JournalEntryLine.objects.create(
                    journal_entry=entry,
                    account=acc,
                    account_code=account_code,
                    account_name_ar=account_name,
                    debit_amount=debit,
                    credit_amount=credit,
                )

        return response.Response({"detail": "تم إنشاء القيد", "id": entry.id}, status=201)


class JournalEntryDetailView(views.APIView):
    """تفاصيل قيد واحد / حذفه."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from accounting.models import JournalEntry
        try:
            entry = JournalEntry.objects.prefetch_related("lines__account").select_related("branch", "created_by").get(pk=pk)
        except JournalEntry.DoesNotExist:
            return response.Response({"detail": "Not found"}, status=404)

        lines = []
        for line in entry.lines.all():
            lines.append({
                "id":           line.id,
                "account_code": line.account_code,
                "account_name": line.account_name_ar or (line.account.name_ar if line.account else ""),
                "debit":        str(line.debit_amount),
                "credit":       str(line.credit_amount),
            })
        return response.Response({
            "id":          entry.id,
            "entry_date":  str(entry.entry_date),
            "description": entry.description,
            "source_type": entry.source_type,
            "branch":      entry.branch.name if entry.branch else "",
            "created_by":  str(entry.created_by) if entry.created_by else "",
            "lines":       lines,
        })

    def delete(self, request, pk):
        from accounting.models import JournalEntry
        if not can_delete_chart_or_users(request.user):
            return response.Response({"detail": "سيف فقط – حذف القيود"}, status=403)
        try:
            entry = JournalEntry.objects.get(pk=pk, source_type="manual")
        except JournalEntry.DoesNotExist:
            return response.Response({"detail": "لم يُعثر على القيد أو هو قيد تلقائي"}, status=404)
        entry.delete()
        return response.Response(status=204)


class CostCenterListView(views.APIView):
    """
    مراكز التكلفة — قائمة الحسابات التحليلية من نوع 'المركز المالي'
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        accounts = ChartAccount.objects.filter(
            is_active=True,
            account_type="تحليلي",
        ).order_by("code")

        rows = []
        for acc in accounts:
            rows.append({
                "id":       acc.id,
                "code":     acc.code,
                "name_ar":  acc.name_ar,
                "name_en":  acc.name_en,
                "level":    acc.level,
                "statement":acc.statement,
                "balance":  str(acc.balance),
            })
        return response.Response({"cost_centers": rows})
