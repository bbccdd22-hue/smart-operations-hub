"""
Kitchen Display System (KDS) API
==================================

KDS shows kitchen staff the live queue of orders with statuses:
  pending → cooking → ready → delivered

Uses standard HTTP polling (no WebSocket dependency needed):
  GET  /api/pos/kds/?branch_id=<id>              → all active orders
  POST /api/pos/kds/                             → create KDS order manually
  POST /api/pos/kds/<order_id>/advance/          → advance to next status
  PATCH /api/pos/kds/<order_id>/status/          → set explicit status
  GET  /api/pos/kds/stats/?branch_id=<id>        → kitchen throughput stats
"""
from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from org.models import Branch
from .models import KDSOrder, KDSOrderStatus


class KDSOrderListView(APIView):
    """
    GET  /api/pos/kds/   → active orders (pending, cooking, ready)
    POST /api/pos/kds/   → create manual KDS order (dine-in without POS)
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        status_filter = request.query_params.get("status", "pending,cooking,ready")
        statuses = [s.strip() for s in status_filter.split(",") if s.strip()]
        branch_id = request.query_params.get("branch_id")

        qs = KDSOrder.objects.filter(kds_status__in=statuses).select_related("branch", "sale")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        return Response([_kds_dict(o) for o in qs])

    def post(self, request):
        branch_id = request.data.get("branch_id")
        if not branch_id:
            return Response({"detail": "branch_id required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            branch = Branch.objects.get(pk=branch_id)
        except Branch.DoesNotExist:
            return Response({"detail": "Branch not found"}, status=status.HTTP_404_NOT_FOUND)

        from django.utils import timezone
        order_number = request.data.get("order_number") or f"KDS-{timezone.now().strftime('%H%M%S')}"

        kds_order = KDSOrder.objects.create(
            branch=branch,
            order_number=order_number,
            table_number=request.data.get("table_number", ""),
            items=request.data.get("items", []),
            priority=request.data.get("priority", 0),
            notes=request.data.get("notes", ""),
        )
        return Response(_kds_dict(kds_order), status=status.HTTP_201_CREATED)


class KDSOrderStatusView(APIView):
    """
    POST  /api/pos/kds/<pk>/advance/   → advance to next status
    PATCH /api/pos/kds/<pk>/status/    → set explicit status
    """
    permission_classes = [permissions.AllowAny]

    def _get_order(self, pk):
        try:
            return KDSOrder.objects.get(pk=pk)
        except KDSOrder.DoesNotExist:
            return None

    def post(self, request, pk):
        """Advance order: pending→cooking→ready→delivered."""
        order = self._get_order(pk)
        if not order:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        new_status = order.advance_status()
        return Response({**_kds_dict(order), "advanced_to": new_status})

    def patch(self, request, pk):
        """Set an explicit KDS status."""
        order = self._get_order(pk)
        if not order:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("kds_status")
        valid = [s.value for s in KDSOrderStatus]
        if new_status not in valid:
            return Response(
                {"detail": f"Invalid status. Choose: {valid}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.utils import timezone
        now = timezone.now()
        order.kds_status = new_status
        if new_status == KDSOrderStatus.COOKING and not order.cooking_started_at:
            order.cooking_started_at = now
        elif new_status == KDSOrderStatus.READY and not order.ready_at:
            order.ready_at = now
        elif new_status == KDSOrderStatus.DELIVERED and not order.delivered_at:
            order.delivered_at = now
        order.save()
        return Response(_kds_dict(order))


class KDSStatsView(APIView):
    """GET /api/pos/kds/stats/?branch_id=<id>"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        from django.db.models import Count

        branch_id = request.query_params.get("branch_id")
        today = timezone.now().date()

        qs = KDSOrder.objects.filter(created_at__date=today)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        total = qs.count()
        by_status = dict(qs.values_list("kds_status").annotate(n=Count("id")))

        delivered = qs.filter(
            kds_status=KDSOrderStatus.DELIVERED,
            cooking_started_at__isnull=False,
            ready_at__isnull=False,
        )
        avg_cooking_seconds = None
        if delivered.exists():
            durations = [
                (o.ready_at - o.cooking_started_at).total_seconds()
                for o in delivered
                if o.ready_at and o.cooking_started_at
            ]
            if durations:
                avg_cooking_seconds = int(sum(durations) / len(durations))

        return Response({
            "date": str(today),
            "branch_id": branch_id,
            "total_orders": total,
            "by_status": by_status,
            "avg_cooking_time_seconds": avg_cooking_seconds,
            "pending":   by_status.get("pending", 0),
            "cooking":   by_status.get("cooking", 0),
            "ready":     by_status.get("ready", 0),
            "delivered": by_status.get("delivered", 0),
        })


# ── Helper ────────────────────────────────────────────────────────────────────

def _kds_dict(o: KDSOrder) -> dict:
    from django.utils import timezone
    elapsed_seconds = None
    if o.cooking_started_at and o.kds_status == KDSOrderStatus.COOKING:
        elapsed_seconds = int((timezone.now() - o.cooking_started_at).total_seconds())

    return {
        "id": o.pk,
        "order_number": o.order_number,
        "table_number": o.table_number,
        "branch_id": o.branch_id,
        "branch_name": o.branch.name,
        "kds_status": o.kds_status,
        "kds_status_display": o.get_kds_status_display(),
        "items": o.items,
        "priority": o.priority,
        "notes": o.notes,
        "created_at": o.created_at.isoformat(),
        "cooking_started_at": o.cooking_started_at.isoformat() if o.cooking_started_at else None,
        "ready_at": o.ready_at.isoformat() if o.ready_at else None,
        "delivered_at": o.delivered_at.isoformat() if o.delivered_at else None,
        "elapsed_cooking_seconds": elapsed_seconds,
        "sale_id": o.sale_id,
    }
