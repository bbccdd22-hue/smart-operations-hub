from datetime import datetime
from decimal import Decimal

from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from shifts.models import ShiftClosing, ShiftClosingAttachment, ShiftSecurityLog, Shift, ShiftStatus, ShiftType
from shifts.serializers import (
    ShiftClosingAttachmentSerializer,
    ShiftClosingCreatePayloadSerializer,
    ShiftClosingSerializer,
)
from core.permissions import get_user_scope, has_financial_auditor_access
from org.models import Branch


class ShiftClosingListForAuditorView(APIView):
    """List submitted shift closings for Financial Auditor – filter by brand, date range."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not has_financial_auditor_access(request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Financial Auditor access only")
        brand_slug = request.query_params.get("brand")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        qs = ShiftClosing.objects.filter(
            status="submitted",
        ).select_related("shift", "shift__branch", "shift__branch__brand", "submitted_by")
        if brand_slug:
            qs = qs.filter(shift__branch__brand__slug=brand_slug)
        if date_from:
            from datetime import datetime
            try:
                df = datetime.fromisoformat(date_from).date()
                qs = qs.filter(shift__opened_at__date__gte=df)
            except ValueError:
                pass
        if date_to:
            from datetime import datetime
            try:
                dt = datetime.fromisoformat(date_to).date()
                qs = qs.filter(shift__opened_at__date__lte=dt)
            except ValueError:
                pass
        from django.db.models import Count
        qs = qs.annotate(attachments_count=Count("attachments")).order_by("-submitted_at", "shift__branch__name")
        closings = []
        for c in qs[:200]:  # limit for performance
            closings.append({
                "id": c.id,
                "date": str(c.shift.opened_at.date()),
                "branch_name": c.shift.branch.name,
                "brand_name": c.shift.branch.brand.name,
                "brand_slug": c.shift.branch.brand.slug,
                "shift_type": c.shift.shift_type,
                "submitted_by": (c.submitted_by.username if c.submitted_by else ""),
                "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
                "actual_cash": float(c.manual_cash_total()),
                "system_cash": float(c.system_cash or 0),
                "variance_cash": float(c.variance_cash or 0),
                "attachments_count": c.attachments_count,
            })
        return Response({"closings": closings})


class ShiftClosingByBranchDateView(APIView):
    """Get existing closing for branch/date/shift_type."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        branch_id = request.query_params.get("branch_id")
        date_str = request.query_params.get("date")
        shift_type = request.query_params.get("shift_type", ShiftType.MORNING)
        if not branch_id or not date_str:
            return Response({"detail": "branch_id and date required"}, status=400)
        try:
            dt = datetime.fromisoformat(date_str).date()
        except ValueError:
            return Response({"detail": "Invalid date"}, status=400)

        closing = ShiftClosing.objects.filter(
            shift__branch_id=int(branch_id),
            shift__opened_at__date=dt,
            shift__shift_type=shift_type,
        ).select_related("shift", "shift__branch").first()
        if not closing:
            return Response({"closing": None, "is_submitted": False})
        return Response({
            "closing": ShiftClosingSerializer(closing).data,
            "is_submitted": closing.status == "submitted",
        })


class ShiftClosingCreateView(APIView):
    """
    Create or update Shift + ShiftClosing. Optionally submit.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = ShiftClosingCreatePayloadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        branch_id = data["branch_id"]
        target_date = data["date"]
        shift_type = data["shift_type"]

        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None and branch_id not in (scope["branch_ids"] or []):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only close shifts for your assigned branch.")

        try:
            branch = Branch.objects.get(id=branch_id)
        except Branch.DoesNotExist:
            return Response({"detail": "Branch not found"}, status=status.HTTP_404_NOT_FOUND)
        opened_at = datetime.combine(target_date, datetime.min.time())

        shift = Shift.objects.filter(
            branch=branch,
            opened_at__date=target_date,
            shift_type=shift_type,
        ).first()
        if not shift:
            shift = Shift.objects.create(
                branch=branch,
                status=ShiftStatus.OPEN,
                shift_type=shift_type,
                opened_at=opened_at,
                opened_by=request.user,
                opening_petty_cash=data.get("opening_petty_cash") or Decimal("0"),
            )
        if shift.closed_at:
            return Response({"detail": "Shift already closed"}, status=400)

        closing, created = ShiftClosing.objects.get_or_create(
            shift=shift,
            defaults={
                "status": "draft",
                "bills_500": data["bills_500"],
                "bills_200": data["bills_200"],
                "bills_100": data["bills_100"],
                "bills_50": data["bills_50"],
                "bills_20": data["bills_20"],
                "bills_10": data["bills_10"],
                "bills_5": data["bills_5"],
                "bills_1": data["bills_1"],
                "manual_cash_override": data.get("manual_cash_override"),
                "mada": data["mada"],
                "visa": data["visa"],
                "master_card": data["master_card"],
                "hungerstation": data["hungerstation"],
                "jahez": data["jahez"],
                "lugmety": data["lugmety"],
                "the_chefz": data["the_chefz"],
                "toyou": data["toyou"],
                "expenses_vouchers": data["expenses_vouchers"],
                "staff_drinks": data["staff_drinks"],
                "system_cash": data["system_cash"],
                "system_network": data["system_network"],
                "system_delivery": data["system_delivery"],
                "system_total_sales": data["system_total_sales"],
            },
        )

        if not created:
            if closing.status == "submitted":
                return Response({"detail": "Shift already submitted"}, status=400)
            closing.bills_500 = data["bills_500"]
            closing.bills_200 = data["bills_200"]
            closing.bills_100 = data["bills_100"]
            closing.bills_50 = data["bills_50"]
            closing.bills_20 = data["bills_20"]
            closing.bills_10 = data["bills_10"]
            closing.bills_5 = data["bills_5"]
            closing.bills_1 = data["bills_1"]
            closing.manual_cash_override = data.get("manual_cash_override")
            closing.mada = data["mada"]
            closing.visa = data["visa"]
            closing.master_card = data["master_card"]
            closing.hungerstation = data["hungerstation"]
            closing.jahez = data["jahez"]
            closing.lugmety = data["lugmety"]
            closing.the_chefz = data["the_chefz"]
            closing.toyou = data["toyou"]
            closing.expenses_vouchers = data["expenses_vouchers"]
            closing.staff_drinks = data["staff_drinks"]
            closing.system_cash = data["system_cash"]
            closing.system_network = data["system_network"]
            closing.system_delivery = data["system_delivery"]
            closing.system_total_sales = data["system_total_sales"]

        shift.notes = data.get("notes", "")
        shift.save(update_fields=["notes", "updated_at"])

        v_cash, v_network = closing.compute_variances()
        closing.variance_cash = v_cash
        closing.variance_network = v_network
        closing.reconciled_at = timezone.now()
        closing.system_cash = data["system_cash"]
        closing.system_network = data["system_network"]
        closing.system_delivery = data["system_delivery"]
        closing.system_total_sales = data["system_total_sales"]
        closing.save()

        if data.get("submit"):
            closing.status = "submitted"
            closing.submitted_at = timezone.now()
            closing.submitted_by = request.user
            closing.save(update_fields=["status", "submitted_at", "submitted_by", "updated_at"])
            shift.status = ShiftStatus.CLOSED
            shift.closed_at = timezone.now()
            shift.closed_by = request.user
            shift.save(update_fields=["status", "closed_at", "closed_by", "updated_at"])
            ShiftSecurityLog.objects.create(
                shift=shift,
                user=request.user,
                action="shift_submitted",
                branch=shift.branch,
                notes=f"Approved & Submitted: cash var={v_cash}, network var={v_network}",
            )
            # إنشاء القيد المحاسبي المزدوج تلقائياً
            try:
                from accounting.journal_services import create_journal_entry_from_shift_closing
                create_journal_entry_from_shift_closing(closing, created_by=request.user)
            except Exception as exc:
                from core.error_logging import log_system_error
                log_system_error(
                    "other", f"Failed to create journal entry for shift closing {closing.id}",
                    user=request.user, context={"closing_id": closing.id}, exc=exc,
                )

        return Response({
            "closing": ShiftClosingSerializer(closing).data,
            "is_submitted": closing.status == "submitted",
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ShiftClosingSubmitView(APIView):
    """Submit an existing draft closing."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            closing = ShiftClosing.objects.select_related("shift").get(pk=pk)
        except ShiftClosing.DoesNotExist:
            return Response({"detail": "Shift closing not found"}, status=status.HTTP_404_NOT_FOUND)
        if closing.status == "submitted":
            return Response({"detail": "Already submitted"}, status=400)
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None and closing.shift.branch_id not in (scope["branch_ids"] or []):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Access denied")
        closing.status = "submitted"
        closing.submitted_at = timezone.now()
        closing.submitted_by = request.user
        closing.save(update_fields=["status", "submitted_at", "submitted_by", "updated_at"])
        shift = closing.shift
        shift.status = ShiftStatus.CLOSED
        shift.closed_at = timezone.now()
        shift.closed_by = request.user
        shift.save(update_fields=["status", "closed_at", "closed_by", "updated_at"])
        ShiftSecurityLog.objects.create(
            shift=shift,
            user=request.user,
            action="shift_submitted",
            branch=shift.branch,
        )
        # إنشاء القيد المحاسبي المزدوج تلقائياً
        try:
            from accounting.journal_services import create_journal_entry_from_shift_closing
            create_journal_entry_from_shift_closing(closing, created_by=request.user)
        except Exception as exc:
            from core.error_logging import log_system_error
            log_system_error(
                "other", f"Failed to create journal entry for shift closing {closing.id}",
                user=request.user, context={"closing_id": closing.id}, exc=exc,
            )
        return Response({
            "closing": ShiftClosingSerializer(closing).data,
            "is_submitted": True,
        })


class ShiftClosingUpsertView(generics.CreateAPIView):
    """
    Legacy: Create ShiftClosing (expects shift in payload).
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ShiftClosingSerializer

    def perform_create(self, serializer):
        shift = serializer.validated_data.get("shift")
        scope = get_user_scope(self.request.user)
        if scope["branch_ids"] is not None and shift and shift.branch_id not in (scope["branch_ids"] or []):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only close shifts for your assigned branch.")
        closing: ShiftClosing = serializer.save()
        shift = closing.shift
        v_cash, v_network = closing.compute_variances()
        closing.variance_cash = v_cash
        closing.variance_network = v_network
        closing.reconciled_at = timezone.now()
        closing.save(update_fields=["variance_cash", "variance_network", "reconciled_at", "updated_at"])
        shift.status = ShiftStatus.CLOSED
        shift.closed_at = timezone.now()
        shift.closed_by = self.request.user
        shift.save(update_fields=["status", "closed_at", "closed_by", "updated_at"])
        ShiftSecurityLog.objects.create(
            shift=shift,
            user=self.request.user,
            action="shift_closed",
            branch=shift.branch,
            notes=f"Reconciled: cash var={v_cash}, network var={v_network}",
        )


class ShiftClosingDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ShiftClosingSerializer
    queryset = ShiftClosing.objects.select_related("shift", "shift__branch", "shift__branch__brand", "submitted_by")

    def get_queryset(self):
        qs = ShiftClosing.objects.all().select_related(
            "shift", "shift__branch", "shift__branch__brand", "submitted_by"
        )
        if has_financial_auditor_access(self.request.user):
            return qs
        scope = get_user_scope(self.request.user)
        if scope["branch_ids"] is None:
            return qs
        return qs.filter(shift__branch_id__in=(scope["branch_ids"] or []))


class ShiftClosingAttachmentListCreateView(APIView):
    """List and create attachments for a shift closing."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, closing_pk):
        try:
            closing = ShiftClosing.objects.get(pk=closing_pk)
        except ShiftClosing.DoesNotExist:
            return Response({"detail": "Shift closing not found"}, status=status.HTTP_404_NOT_FOUND)
        scope = get_user_scope(request.user)
        can_view = (
            has_financial_auditor_access(request.user)
            or scope["branch_ids"] is None
            or closing.shift.branch_id in (scope["branch_ids"] or [])
        )
        if not can_view:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Access denied")
        attachments = closing.attachments.all()
        ser = ShiftClosingAttachmentSerializer(attachments, many=True, context={"request": request})
        return Response(ser.data)

    def post(self, request, closing_pk):
        try:
            closing = ShiftClosing.objects.get(pk=closing_pk)
        except ShiftClosing.DoesNotExist:
            return Response({"detail": "Shift closing not found"}, status=status.HTTP_404_NOT_FOUND)
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None and closing.shift.branch_id not in (scope["branch_ids"] or []):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Access denied")
        if closing.status == "submitted":
            return Response({"detail": "Cannot add attachments to submitted closing"}, status=400)
        ser = ShiftClosingAttachmentSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save(closing=closing)
        return Response(ser.data, status=status.HTTP_201_CREATED)


class ShiftClosingAuditorListView(APIView):
    """List submitted shift closings for Financial Auditor – filter by brand, all brands visible."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from core.permissions import is_super_admin
        from django.db.models import Count

        if not is_super_admin(request.user):
            # Check perm_financial_auditor from profile
            profile = getattr(request.user, "profile", None)
            if not profile or not getattr(profile, "has_financial_auditor", lambda: False)():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Financial Auditor permission required")

        brand_slug = request.query_params.get("brand", "").strip()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        qs = ShiftClosing.objects.filter(
            status="submitted",
        ).select_related(
            "shift",
            "shift__branch",
            "shift__branch__brand",
            "submitted_by",
        ).prefetch_related("attachments").annotate(attachment_count=Count("attachments"))

        if brand_slug:
            qs = qs.filter(shift__branch__brand__slug=brand_slug)
        if date_from:
            try:
                from datetime import datetime
                qs = qs.filter(shift__opened_at__date__gte=datetime.fromisoformat(date_from).date())
            except ValueError:
                pass
        if date_to:
            try:
                from datetime import datetime
                qs = qs.filter(shift__opened_at__date__lte=datetime.fromisoformat(date_to).date())
            except ValueError:
                pass

        qs = qs.order_by("-shift__opened_at")

        rows = []
        for c in qs[:200]:  # Limit for UI
            rows.append({
                "id": c.id,
                "date": str(c.shift.opened_at.date()),
                "branch_name": c.shift.branch.name,
                "brand_name": c.shift.branch.brand.name,
                "brand_slug": c.shift.branch.brand.slug,
                "shift_type": c.shift.shift_type,
                "submitted_by": (c.submitted_by.username if c.submitted_by_id else None),
                "manual_cash": float(c.manual_cash_total()),
                "system_cash": float(c.system_cash or 0),
                "variance_cash": float(c.variance_cash or 0),
                "attachment_count": c.attachment_count,
                "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
            })
        return Response({"closings": rows})


class ShiftClosingAttachmentDestroyView(APIView):
    """Delete a shift closing attachment."""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        try:
            att = ShiftClosingAttachment.objects.select_related("closing__shift").get(pk=pk)
        except ShiftClosingAttachment.DoesNotExist:
            return Response({"detail": "Attachment not found"}, status=status.HTTP_404_NOT_FOUND)
        scope = get_user_scope(request.user)
        if scope["branch_ids"] is not None and att.closing.shift.branch_id not in (scope["branch_ids"] or []):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Access denied")
        if att.closing.status == "submitted":
            return Response({"detail": "Cannot delete attachments from submitted closing"}, status=400)
        att.file.delete(save=False)
        att.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

