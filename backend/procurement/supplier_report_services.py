"""
Supplier report services - أرصدة الموردين، كشف حساب مورد، أعمار الديون.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum

from procurement.models import Supplier, SupplierInvoice, SupplierInvoiceStatus


def get_supplier_balance(supplier_id: int) -> Decimal:
    """رصيد استحقاق المورد = مجموع الفواتير المرحّلة (ما نستحق عليه)."""
    total = SupplierInvoice.objects.filter(
        supplier_id=supplier_id, status=SupplierInvoiceStatus.POSTED
    ).aggregate(s=Sum("total_amount"))["s"]
    return total or Decimal("0.00")


def get_supplier_balances(brand_id=None, branch_id=None):
    """
    قائمة أرصدة الموردين.
    Returns list of {supplier_id, supplier_name, brand_name, balance, invoices_count}.
    """
    qs = Supplier.objects.filter(is_active=True).select_related("brand")
    if brand_id:
        qs = qs.filter(brand_id=brand_id)

    rows = []
    for sup in qs:
        inv_qs = SupplierInvoice.objects.filter(
            supplier=sup, status=SupplierInvoiceStatus.POSTED
        )
        if branch_id:
            inv_qs = inv_qs.filter(branch_id=branch_id)
        agg = inv_qs.aggregate(total=Sum("total_amount"))
        balance = agg["total"] or Decimal("0.00")
        cnt = inv_qs.count()
        rows.append({
            "supplier_id": sup.id,
            "supplier_name": sup.name,
            "supplier_name_ar": sup.name_ar or sup.name,
            "brand_name": sup.brand.name,
            "balance": str(balance),
            "invoices_count": cnt,
        })
    return rows


def get_supplier_statement(supplier_id: int, from_date=None, to_date=None):
    """
    كشف حساب مورد - قائمة فواتير المورد مع الرصيد التراكمي.
    """
    from procurement.models import Supplier

    try:
        supplier = Supplier.objects.get(pk=supplier_id)
    except Supplier.DoesNotExist:
        return None

    qs = SupplierInvoice.objects.filter(supplier_id=supplier_id).order_by("invoice_date", "id")
    if from_date:
        qs = qs.filter(invoice_date__gte=from_date)
    if to_date:
        qs = qs.filter(invoice_date__lte=to_date)

    transactions = []
    running = Decimal("0.00")
    for inv in qs:
        amt = inv.total_amount
        if inv.status == SupplierInvoiceStatus.POSTED:
            running += amt
        transactions.append({
            "id": inv.id,
            "date": str(inv.invoice_date),
            "invoice_number": inv.invoice_number,
            "description": f"فاتورة {inv.invoice_number}",
            "branch": inv.branch.name if inv.branch else "",
            "amount": str(amt),
            "status": inv.status,
            "balance": str(running),
        })

    total = sum(Decimal(t["amount"]) for t in transactions if t["status"] == SupplierInvoiceStatus.POSTED)
    return {
        "supplier_id": supplier.id,
        "supplier_name": supplier.name,
        "supplier_name_ar": supplier.name_ar or supplier.name,
        "from_date": from_date,
        "to_date": to_date,
        "transactions": transactions,
        "total_amount": str(total),
        "closing_balance": str(total),
    }


def get_supplier_debt_aging(brand_id=None, as_of_date=None):
    """
    أعمار الديون للموردين - تصنيف الفواتير حسب العمر (0-30, 31-60, 61-90, 90+).
    """
    as_of = as_of_date or date.today()
    qs = SupplierInvoice.objects.filter(
        status=SupplierInvoiceStatus.POSTED,
        invoice_date__lte=as_of,
    ).select_related("supplier", "supplier__brand")
    if brand_id:
        qs = qs.filter(supplier__brand_id=brand_id)

    buckets = {
        "0_30": {"label": "0-30 يوم", "days_min": 0, "days_max": 30, "total": Decimal("0.00"), "items": []},
        "31_60": {"label": "31-60 يوم", "days_min": 31, "days_max": 60, "total": Decimal("0.00"), "items": []},
        "61_90": {"label": "61-90 يوم", "days_min": 61, "days_max": 90, "total": Decimal("0.00"), "items": []},
        "90_plus": {"label": "أكثر من 90 يوم", "days_min": 91, "days_max": 9999, "total": Decimal("0.00"), "items": []},
    }

    for inv in qs:
        age_days = (as_of - inv.invoice_date).days
        amt = inv.total_amount
        if age_days <= 30:
            b = buckets["0_30"]
        elif age_days <= 60:
            b = buckets["31_60"]
        elif age_days <= 90:
            b = buckets["61_90"]
        else:
            b = buckets["90_plus"]
        b["total"] += amt
        b["items"].append({
            "supplier_id": inv.supplier_id,
            "supplier_name": inv.supplier.name,
            "invoice_number": inv.invoice_number,
            "invoice_date": str(inv.invoice_date),
            "amount": str(amt),
            "age_days": age_days,
        })

    total_all = sum(b["total"] for b in buckets.values())
    return {
        "as_of_date": str(as_of),
        "buckets": [
            {"key": k, "label": v["label"], "total": str(v["total"]), "items": v["items"], "count": len(v["items"])}
            for k, v in buckets.items()
        ],
        "grand_total": str(total_all),
    }
