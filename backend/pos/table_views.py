"""
Table Management API Views
===========================

GET  /api/pos/tables/?branch_id=<id>           → list all tables
POST /api/pos/tables/                           → create table
GET  /api/pos/tables/<pk>/                      → table detail
PATCH /api/pos/tables/<pk>/                     → update (position, section, capacity)
DELETE /api/pos/tables/<pk>/                    → deactivate table

POST /api/pos/tables/<pk>/status/               → change status
  body: { status: "available"|"occupied"|"reserved"|"paid"|"cleaning" }

POST /api/pos/tables/merge/                     → merge two tables
  body: { primary_table_id, secondary_table_id, sale_id? }

POST /api/pos/tables/<pk>/transfer/             → transfer to another table
  body: { target_table_id }
"""
from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import RestaurantTable, TableStatus, TableMerge, SaleTransaction


def _table_dict(t: RestaurantTable) -> dict:
    return {
        "id": t.pk,
        "branch_id": t.branch_id,
        "number": t.number,
        "capacity": t.capacity,
        "status": t.status,
        "status_display": t.get_status_display(),
        "section": t.section,
        "pos_x": t.pos_x,
        "pos_y": t.pos_y,
        "is_active": t.is_active,
        "notes": t.notes,
        "current_sale_id": t.current_sale_id,
        "current_sale_number": t.current_sale.sale_number if t.current_sale else None,
        "current_sale_total": float(t.current_sale.total) if t.current_sale else None,
    }


class TableListCreateView(APIView):
    """GET /api/pos/tables/  |  POST /api/pos/tables/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        branch_id = request.query_params.get("branch_id")
        qs = RestaurantTable.objects.filter(is_active=True).select_related(
            "branch", "current_sale"
        ).order_by("section", "number")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return Response([_table_dict(t) for t in qs])

    def post(self, request):
        data = request.data
        branch_id = data.get("branch_id")
        number = data.get("number")
        if not branch_id or not number:
            return Response({"detail": "branch_id and number are required."}, status=400)

        table, created = RestaurantTable.objects.get_or_create(
            branch_id=branch_id,
            number=str(number),
            defaults={
                "capacity": data.get("capacity", 4),
                "section": data.get("section", ""),
                "pos_x": data.get("pos_x", 0),
                "pos_y": data.get("pos_y", 0),
                "notes": data.get("notes", ""),
            },
        )
        if not created:
            return Response({"detail": "Table number already exists for this branch."}, status=400)

        return Response(_table_dict(table), status=201)


class TableDetailView(APIView):
    """GET/PATCH/DELETE /api/pos/tables/<pk>/"""
    permission_classes = [permissions.IsAuthenticated]

    def _get(self, pk):
        try:
            return RestaurantTable.objects.select_related("branch", "current_sale").get(pk=pk)
        except RestaurantTable.DoesNotExist:
            return None

    def get(self, request, pk):
        t = self._get(pk)
        if not t:
            return Response({"detail": "Not found."}, status=404)
        return Response(_table_dict(t))

    def patch(self, request, pk):
        t = self._get(pk)
        if not t:
            return Response({"detail": "Not found."}, status=404)
        allowed = ["capacity", "section", "pos_x", "pos_y", "notes"]
        for field in allowed:
            if field in request.data:
                setattr(t, field, request.data[field])
        t.save()
        return Response(_table_dict(t))

    def delete(self, request, pk):
        t = self._get(pk)
        if not t:
            return Response({"detail": "Not found."}, status=404)
        t.is_active = False
        t.save(update_fields=["is_active"])
        return Response({"detail": "Deactivated."})


class TableStatusView(APIView):
    """POST /api/pos/tables/<pk>/status/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            table = RestaurantTable.objects.select_related("current_sale").get(pk=pk)
        except RestaurantTable.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        new_status = request.data.get("status")
        valid = [s.value for s in TableStatus]
        if new_status not in valid:
            return Response({"detail": f"Invalid status. Valid: {valid}"}, status=400)

        sale_id = request.data.get("sale_id")
        if sale_id and new_status == TableStatus.OCCUPIED:
            try:
                sale = SaleTransaction.objects.get(pk=sale_id)
                table.open_for_sale(sale)
            except SaleTransaction.DoesNotExist:
                return Response({"detail": "Sale not found."}, status=404)
        elif new_status == TableStatus.AVAILABLE:
            table.clear()
        elif new_status == TableStatus.PAID:
            table.mark_paid()
        else:
            table.status = new_status
            table.save(update_fields=["status"])

        return Response(_table_dict(table))


class TableMergeView(APIView):
    """POST /api/pos/tables/merge/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        primary_id = request.data.get("primary_table_id")
        secondary_id = request.data.get("secondary_table_id")
        sale_id = request.data.get("sale_id")

        if not primary_id or not secondary_id:
            return Response({"detail": "primary_table_id and secondary_table_id required."}, status=400)
        if primary_id == secondary_id:
            return Response({"detail": "Cannot merge a table with itself."}, status=400)

        try:
            primary = RestaurantTable.objects.get(pk=primary_id)
            secondary = RestaurantTable.objects.get(pk=secondary_id)
        except RestaurantTable.DoesNotExist:
            return Response({"detail": "One or both tables not found."}, status=404)

        sale = None
        if sale_id:
            try:
                sale = SaleTransaction.objects.get(pk=sale_id)
            except SaleTransaction.DoesNotExist:
                pass

        merge = TableMerge.objects.create(
            primary_table=primary,
            secondary_table=secondary,
            merged_sale=sale,
        )
        secondary.status = TableStatus.OCCUPIED
        secondary.save(update_fields=["status"])

        return Response({
            "merge_id": merge.pk,
            "primary_table": _table_dict(primary),
            "secondary_table": _table_dict(secondary),
        }, status=201)


class TableTransferView(APIView):
    """POST /api/pos/tables/<pk>/transfer/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        target_id = request.data.get("target_table_id")
        if not target_id:
            return Response({"detail": "target_table_id required."}, status=400)
        if int(target_id) == pk:
            return Response({"detail": "Cannot transfer to the same table."}, status=400)

        try:
            source = RestaurantTable.objects.select_related("current_sale").get(pk=pk)
            target = RestaurantTable.objects.get(pk=target_id)
        except RestaurantTable.DoesNotExist:
            return Response({"detail": "Table not found."}, status=404)

        if target.status != TableStatus.AVAILABLE:
            return Response({"detail": "Target table is not available."}, status=400)

        if source.current_sale:
            target.open_for_sale(source.current_sale)

        source.current_sale = None
        source.status = TableStatus.CLEANING
        source.save(update_fields=["current_sale", "status"])

        return Response({
            "source_table": _table_dict(source),
            "target_table": _table_dict(target),
        })
