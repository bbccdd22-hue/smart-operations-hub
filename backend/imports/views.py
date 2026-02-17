from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect

from rest_framework import permissions, response, status, views

from accounting.services import get_daily_reconciliation
from imports.models import DailySale, ExcelReportType, ExcelUpload, ExcelUploadStatus
from imports.parser import ParseError, parse_excel_upload
from imports.serializers import ExcelUploadSerializer
from imports.smart_parser import parse_preview
from org.models import Brand, Branch


def _notify_parse_error(user, filename: str, message: str):
    """Create AdminNotification for SAIF when Excel parse fails (e.g. missing Branch Code)."""
    try:
        from org.models import AdminNotification
        saif = user
        if not saif or saif.username != "SAIF":
            return
        AdminNotification.objects.create(
            user=saif,
            event_type="excel_parse_error",
            title="Excel parse error",
            message=f"File '{filename}': {message[:500]}",
        )
    except Exception:  # noqa: BLE001
        pass


def _notify_excel_upload(user, upload):
    """Create AdminNotification for SAIF on excel upload."""
    try:
        from org.models import AdminNotification
        saif = user
        if not saif or saif.username != "SAIF":
            return
        days = 0
        if upload.report_date_from and upload.report_date_to:
            days = (upload.report_date_to - upload.report_date_from).days + 1
        brand_name = upload.brand.name if upload.brand else None
        if not brand_name:
            for rel in ("daily_rows", "hourly_rows", "product_rows"):
                rows = getattr(upload, rel, None)
                if rows and hasattr(rows, "first"):
                    first_row = rows.first()
                    if first_row and getattr(first_row, "brand", None):
                        brand_name = first_row.brand.name
                        break
        brand_name = brand_name or "sales data"
        title = "Excel sales uploaded"
        msg = f"Successfully parsed {days} days of sales for {brand_name}"
        if upload.report_date_from and upload.report_date_to:
            msg += f" ({upload.report_date_from} to {upload.report_date_to})"
        AdminNotification.objects.create(user=saif, event_type="excel_uploaded", title=title, message=msg)
    except Exception:  # noqa: BLE001
        pass


def _variance_engine(upload) -> list[dict]:
    """
    After Excel upload: compare Foodics data with staff entries.
    Returns categorized mismatches: Cash Shortage, Card Mismatch, App Discrepancy.
    """
    if not upload.report_date_from or not upload.report_date_to:
        return []
    result = []
    d = upload.report_date_from
    while d <= upload.report_date_to:
        rows = get_daily_reconciliation(d, submitted_only=False)
        for r in rows:
            if not r.get("has_variance"):
                continue
            cash_var = r.get("cash_variance") or 0
            card_var = r.get("card_variance") or 0
            categories = []
            if cash_var < 0:
                categories.append("Cash Shortage")
            elif cash_var > 0:
                categories.append("Cash Overage")
            if card_var != 0:
                categories.append("Card Mismatch")
            if categories:
                result.append({
                    "date": str(d),
                    "branch_id": r["branch_id"],
                    "branch_name": r["branch_name"],
                    "brand_name": r["brand_name"],
                    "cash_variance": cash_var,
                    "card_variance": card_var,
                    "categories": categories,
                })
        d += timedelta(days=1)
    return result


@method_decorator(csrf_protect, name="dispatch")
class BatchUploadView(views.APIView):
    """
    Upload multiple files. Processes each with auto branch/brand routing.
    Returns: { results: [{ file, status, upload_id?, error? }], summary: { success, failed, total_sales_sar, brands } }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        files = request.FILES.getlist("files") or request.FILES.getlist("file")
        if not files:
            return response.Response({"detail": "No files provided"}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        total_sales_sar = 0
        brands_seen = set()

        for f in files:
            name = (getattr(f, "name", "") or "").lower()
            if not name or (not name.endswith(".xlsx") and not name.endswith(".csv") and not name.endswith(".pdf")):
                results.append({
                    "file": getattr(f, "name", "unknown"),
                    "status": "skipped",
                    "error": "Unsupported format. Use .xlsx, .csv, or .pdf",
                })
                continue

            try:
                preview = parse_preview(f, getattr(f, "name", ""))
            except Exception as e:
                results.append({"file": getattr(f, "name", "unknown"), "status": "error", "error": str(e)[:200]})
                continue

            report_type = preview.suggested_report_type or "daily_sales"
            if hasattr(f, "seek"):
                f.seek(0)
            serializer = ExcelUploadSerializer(data={"file": f, "report_type": report_type})
            try:
                serializer.is_valid(raise_exception=True)
            except Exception as e:
                results.append({"file": getattr(f, "name", "unknown"), "status": "error", "error": str(e)[:200]})
                continue

            upload = serializer.save(uploaded_by=request.user if request.user.is_authenticated else None)
            brand_id = request.data.get("brand_id") or request.data.get("brand")
            branch_id = request.data.get("branch_id") or request.data.get("branch")
            if brand_id:
                try:
                    upload.brand = Brand.objects.get(pk=brand_id)
                except (Brand.DoesNotExist, ValueError, TypeError):
                    pass
            elif preview.detected_brand:
                b = Brand.objects.filter(slug=preview.detected_brand).first()
                if b:
                    upload.brand = b
            if branch_id:
                try:
                    upload.branch = Branch.objects.get(pk=branch_id)
                except (Branch.DoesNotExist, ValueError, TypeError):
                    pass
            if upload.brand_id or upload.branch_id:
                upload.save(update_fields=["brand", "branch"])
            upload.status = ExcelUploadStatus.PROCESSING
            upload.save(update_fields=["status"])

            try:
                parse_excel_upload(upload, report_type=report_type, column_mapping=preview.mapping)
                upload.status = ExcelUploadStatus.PROCESSED
                upload.processed_at = timezone.now()
                upload.error_message = ""
                upload.save(update_fields=["status", "processed_at", "error_message"])

                _notify_excel_upload(request.user, upload)

                # Aggregate (Payments Report has no DailySale rows)
                if report_type == "payments_report":
                    results.append({
                        "file": getattr(f, "name", "unknown"),
                        "status": "success",
                        "upload_id": upload.id,
                        "rows": 0,
                    })
                else:
                    days = DailySale.objects.filter(upload=upload).aggregate(
                        total=Sum("total_sales"), cnt=Count("id")
                    )
                    sales = float(days["total"] or 0)
                    total_sales_sar += sales
                    for row in DailySale.objects.filter(upload=upload).select_related("brand").values_list("brand__name", flat=True).distinct():
                        if row:
                            brands_seen.add(row)
                    results.append({
                        "file": getattr(f, "name", "unknown"),
                        "status": "success",
                        "upload_id": upload.id,
                        "rows": days["cnt"] or 0,
                    })
            except ParseError as exc:
                upload.status = ExcelUploadStatus.FAILED
                msg = str(exc)
                upload.error_message = msg[:2000]
                upload.save(update_fields=["status", "error_message"])
                _notify_parse_error(request.user, getattr(f, "name", "unknown"), msg)
                results.append({"file": getattr(f, "name", "unknown"), "status": "error", "error": msg[:200]})
            except Exception as exc:
                upload.status = ExcelUploadStatus.FAILED
                upload.error_message = str(exc)[:2000]
                upload.save(update_fields=["status", "error_message"])
                results.append({
                    "file": getattr(f, "name", "unknown"),
                    "status": "error",
                    "error": str(exc)[:200],
                })

        success_count = sum(1 for r in results if r.get("status") == "success")
        return response.Response({
            "results": results,
            "summary": {
                "success": success_count,
                "failed": len(results) - success_count,
                "total_sales_sar": round(total_sales_sar, 2),
                "brands": list(brands_seen),
            },
        }, status=status.HTTP_200_OK)


class ParsePreviewView(views.APIView):
    """
    Upload file, get preview (first 5 rows) + column mapping.
    No DB save. Supports .xlsx, .csv, .pdf.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        file = request.FILES.get("file")
        if not file:
            return response.Response({"detail": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = parse_preview(file, file.name)
            return response.Response({
                "rows": result.rows,
                "columns": result.columns,
                "mapping": result.mapping,
                "detected_brand": result.detected_brand,
                "suggested_report_type": result.suggested_report_type,
                "error_rows": result.error_rows,
                "total_rows": result.total_rows,
            })
        except Exception as exc:  # noqa: BLE001
            return response.Response(
                {"detail": str(exc)[:500]},
                status=status.HTTP_400_BAD_REQUEST,
            )


@method_decorator(csrf_protect, name="dispatch")
class ExcelUploadView(views.APIView):
    """
    ETL: Parse Excel once → save to DB models → mark PROCESSED.
    Auto-discovery: runs variance engine post-upload to highlight mismatches.
    Accepts optional column_mapping override from smart preview.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        def _first(v):
            """Coerce list to first element (Django QueryDict can return lists)."""
            if isinstance(v, list):
                return v[0] if v else None
            return v

        file_obj = request.FILES.get("file")
        if not file_obj:
            return response.Response(
                {"detail": "No file received. Ensure the form uses multipart/form-data and the field name is 'file'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        report_type_raw = _first(request.data.get("report_type"))
        if isinstance(report_type_raw, (list, tuple)):
            report_type_raw = report_type_raw[0] if report_type_raw else None
        report_type_raw = str(report_type_raw).strip() if report_type_raw else None
        brand_id = _first(request.data.get("brand_id")) or _first(request.data.get("brand"))
        branch_id = _first(request.data.get("branch_id")) or _first(request.data.get("branch"))
        if isinstance(brand_id, (list, tuple)):
            brand_id = brand_id[0] if brand_id else None
        if isinstance(branch_id, (list, tuple)):
            branch_id = branch_id[0] if branch_id else None

        data = {
            "report_type": report_type_raw,
            "file": file_obj,
        }
        if brand_id is not None:
            try:
                data["brand"] = int(brand_id)
            except (ValueError, TypeError):
                return response.Response(
                    {"detail": "Invalid brand_id"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if branch_id is not None:
            try:
                data["branch"] = int(branch_id)
            except (ValueError, TypeError):
                pass
        serializer = ExcelUploadSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        upload: ExcelUpload = serializer.save(
            uploaded_by=request.user if request.user.is_authenticated else None
        )

        column_mapping = request.data.get("column_mapping")
        if isinstance(column_mapping, str):
            import json
            try:
                column_mapping = json.loads(column_mapping)
            except json.JSONDecodeError:
                column_mapping = None
        if not isinstance(column_mapping, dict):
            column_mapping = None

        if upload.status == ExcelUploadStatus.PROCESSED:
            variances = _variance_engine(upload)
            data = ExcelUploadSerializer(upload).data
            data["variances"] = variances
            return response.Response(data, status=status.HTTP_200_OK)

        upload.status = ExcelUploadStatus.PROCESSING
        upload.save(update_fields=["status"])

        try:
            meta = parse_excel_upload(upload, report_type=upload.report_type, column_mapping=column_mapping)
            upload.status = ExcelUploadStatus.PROCESSED
            upload.processed_at = timezone.now()
            upload.error_message = ""
            upload.save(update_fields=["status", "processed_at", "error_message", "updated_at"])

            # Notify SAIF if excel upload notifications enabled
            _notify_excel_upload(request.user, upload)

        except ParseError as exc:
            upload.status = ExcelUploadStatus.FAILED
            msg = str(exc)
            upload.error_message = msg[:2000]
            upload.save(update_fields=["status", "error_message", "updated_at"])
            _notify_parse_error(request.user, getattr(upload.file, "name", "unknown"), msg)
            return response.Response(
                {"detail": msg, "upload_id": upload.id},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:  # noqa: BLE001
            upload.status = ExcelUploadStatus.FAILED
            upload.error_message = str(exc)[:2000]
            upload.save(update_fields=["status", "error_message", "updated_at"])
            return response.Response(
                {"detail": f"Failed to parse Excel: {exc}", "upload_id": upload.id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        variances = _variance_engine(upload)
        data = ExcelUploadSerializer(upload).data
        data["variances"] = variances
        if upload.report_type == "product_sales" and meta.new_products_count > 0:
            data["new_products_count"] = meta.new_products_count
        return response.Response(data, status=status.HTTP_201_CREATED)


class UploadAnalyticsView(views.APIView):
    """
    Get chart-ready analytics for a processed upload.
    Returns: daily_sales, branch_performance, payment_split
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, upload_id, *args, **kwargs):
        from django.db.models import Sum

        try:
            upload = ExcelUpload.objects.get(pk=upload_id, status=ExcelUploadStatus.PROCESSED)
        except ExcelUpload.DoesNotExist:
            return response.Response({"detail": "Upload not found"}, status=status.HTTP_404_NOT_FOUND)

        daily = (
            DailySale.objects.filter(upload=upload)
            .values("date")
            .annotate(total=Sum("total_sales"), cash=Sum("cash_amount"), network=Sum("network_amount"))
            .order_by("date")
        )
        cash_total = 0
        network_total = 0
        daily_series = []
        for r in daily:
            cash_total += float(r["cash"] or 0)
            network_total += float(r["network"] or 0)
            daily_series.append({
                "date": str(r["date"]),
                "sales": float(r["total"]),
                "cash": float(r["cash"] or 0),
                "network": float(r["network"] or 0),
            })

        branch_totals = (
            DailySale.objects.filter(upload=upload)
            .values("branch__name", "branch__brand__name")
            .annotate(total=Sum("total_sales"))
        )
        branch_performance = [
            {"branch": r["branch__name"] or "—", "brand": r["branch__brand__name"] or "—", "sales": float(r["total"])}
            for r in branch_totals
        ]

        payment_split = [
            {"name": "Cash", "value": cash_total, "key": "cash"},
            {"name": "Cards/Network", "value": network_total, "key": "network"},
        ]

        return response.Response({
            "daily_series": daily_series,
            "branch_performance": branch_performance,
            "payment_split": payment_split,
            "date_from": str(upload.report_date_from) if upload.report_date_from else None,
            "date_to": str(upload.report_date_to) if upload.report_date_to else None,
        })


class SystemCashLookupView(views.APIView):
    """
    Given brand, branch, date, and shift type, return 'system cash' from Daily Sales.
    Frontend can call this to populate the System Cash column on Shift Closing.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        branch_id = request.query_params.get("branch_id")
        date_str = request.query_params.get("date")
        if not branch_id or not date_str:
            return response.Response(
                {"detail": "branch_id and date are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from datetime import datetime

        try:
            dt = datetime.fromisoformat(date_str).date()
        except ValueError:
            return response.Response({"detail": "Invalid date"}, status=status.HTTP_400_BAD_REQUEST)

        qs = DailySale.objects.filter(branch_id=branch_id, date=dt)
        row = qs.order_by("-created_at").first()
        system_cash = row.cash_amount if row else 0

        return response.Response({"branch_id": branch_id, "date": dt.isoformat(), "system_cash": str(system_cash)})
