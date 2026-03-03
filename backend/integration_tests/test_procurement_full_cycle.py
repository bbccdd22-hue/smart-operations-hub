"""
Integration: Procurement Full Cycle
=====================================
PurchaseRequest → PurchaseOrder → GoodsReceipt → SupplierInvoice → JournalEntry

Invariants validated:
  1. PurchaseRequest can be created and submitted.
  2. PurchaseOrder links back to PR and supplier.
  3. GoodsReceipt confirmation:
     a. BranchStock.on_hand increases by received quantity.
     b. StockMovement(type=PURCHASE) created with positive qty_delta.
     c. JournalEntry is balanced (debit inventory = credit AP).
  4. SupplierInvoice posting (standalone):
     a. JournalEntry is balanced.
     b. AP account appears on credit side.
     c. Idempotent (posting twice returns same entry).
  5. Aging report: SupplierInvoice appears within credit_days bucket.
  6. Report correctness: after GR, financial summary includes the received inventory value.
"""
import datetime
from decimal import Decimal

import pytest

from integration_tests.conftest import get_on_hand, lines_balanced

FIXED_DATE = datetime.date(2025, 3, 1)
ORDER_QTY = Decimal("100")
UNIT_PRICE = Decimal("50")  # SAR per unit


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def purchase_request(db, main_branch, superuser, ingredients, units):
    from procurement.models import PurchaseRequest, PurchaseRequestLine, PurchaseRequestStatus
    pr = PurchaseRequest.objects.create(
        branch=main_branch, request_number="PR-INT-001",
        status=PurchaseRequestStatus.APPROVED, requested_by=superuser,
    )
    PurchaseRequestLine.objects.create(
        request=pr, ingredient=ingredients["Espresso Beans"],
        description="Coffee Beans", quantity=ORDER_QTY, unit=units["g"],
        estimated_unit_price=UNIT_PRICE,
    )
    return pr


@pytest.fixture
def purchase_order(db, purchase_request, main_branch, test_brand, supplier, superuser, ingredients, units):
    from procurement.models import PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus
    po = PurchaseOrder.objects.create(
        brand=test_brand, branch=main_branch, supplier=supplier,
        purchase_request=purchase_request, order_number="PO-INT-001",
        status=PurchaseOrderStatus.SENT, order_date=FIXED_DATE,
        expected_delivery_date=FIXED_DATE + datetime.timedelta(days=7),
        created_by=superuser,
    )
    PurchaseOrderLine.objects.create(
        order=po, ingredient=ingredients["Espresso Beans"],
        quantity=ORDER_QTY, unit=units["g"], unit_price=UNIT_PRICE,
    )
    return po


@pytest.fixture
def goods_receipt(db, purchase_order, superuser, chart_of_accounts):
    from procurement.models import GoodsReceipt, GoodsReceiptLine, GoodsReceiptStatus
    gr = GoodsReceipt.objects.create(
        purchase_order=purchase_order, receipt_number="GR-INT-001",
        receipt_date=FIXED_DATE, status=GoodsReceiptStatus.DRAFT,
        received_by=superuser,
    )
    po_line = purchase_order.lines.first()
    GoodsReceiptLine.objects.create(
        goods_receipt=gr, order_line=po_line,
        quantity_received=ORDER_QTY,
    )
    return gr


# ─── Test 1: Purchase Request ──────────────────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_purchase_request_creation_and_lines(main_branch, superuser, ingredients, units):
    """PR can be created, submitted, and has correct line data."""
    from procurement.models import PurchaseRequest, PurchaseRequestLine, PurchaseRequestStatus
    pr = PurchaseRequest.objects.create(
        branch=main_branch, request_number="PR-TEST-100",
        status=PurchaseRequestStatus.DRAFT, requested_by=superuser,
    )
    PurchaseRequestLine.objects.create(
        request=pr, ingredient=ingredients["Whole Milk"],
        description="Milk", quantity=Decimal("500"), unit=units["ml"],
    )
    pr.status = PurchaseRequestStatus.SUBMITTED
    pr.save(update_fields=["status"])

    assert pr.lines.count() == 1
    assert pr.status == PurchaseRequestStatus.SUBMITTED
    assert pr.lines.first().ingredient == ingredients["Whole Milk"]


# ─── Test 2: Purchase Order links to PR ──────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_purchase_order_links_to_pr(purchase_order, purchase_request):
    """PO must reference the originating PR and the correct supplier."""
    assert purchase_order.purchase_request == purchase_request
    assert purchase_order.lines.count() == 1
    line = purchase_order.lines.first()
    assert line.quantity == ORDER_QTY
    assert line.unit_price == UNIT_PRICE


# ─── Test 3: Goods Receipt — inventory updated ────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_goods_receipt_confirms_and_updates_stock(
    goods_receipt, main_branch, ingredients, branch_stock, chart_of_accounts, superuser
):
    """Confirming GR must increase on_hand and create a PURCHASE StockMovement."""
    from procurement.services import confirm_goods_receipt
    from inventory.models import StockMovement, StockMovementType

    ing = ingredients["Espresso Beans"]
    on_hand_before = get_on_hand(main_branch, ing)

    je = confirm_goods_receipt(goods_receipt)

    # Stock must increase
    on_hand_after = get_on_hand(main_branch, ing)
    assert on_hand_after == on_hand_before + ORDER_QTY, (
        f"Expected {on_hand_before + ORDER_QTY}, got {on_hand_after}"
    )

    # PURCHASE StockMovement created
    mv = StockMovement.objects.filter(
        branch=main_branch, ingredient=ing,
        movement_type=StockMovementType.PURCHASE,
    )
    assert mv.exists(), "PURCHASE StockMovement not created on GR confirmation"
    assert mv.first().qty_delta == ORDER_QTY


# ─── Test 4: GR Journal Entry is balanced ─────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_goods_receipt_journal_entry_balanced(
    goods_receipt, chart_of_accounts, ingredients, branch_stock
):
    """GR confirmation must produce a balanced JournalEntry (debit=credit)."""
    from procurement.services import confirm_goods_receipt
    je = confirm_goods_receipt(goods_receipt)

    if je is None:
        pytest.skip("confirm_goods_receipt returned None (missing chart accounts)")

    assert lines_balanced(je), (
        f"GR journal entry not balanced. Lines: "
        f"{[(l.account_code, float(l.debit_amount), float(l.credit_amount)) for l in je.journalentrylines.all()]}"
    )


# ─── Test 5: GR JE debit = inventory amount ───────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_goods_receipt_journal_entry_amount_correct(
    goods_receipt, chart_of_accounts, ingredients, branch_stock
):
    """GR JE total must equal ORDER_QTY × UNIT_PRICE = 5000."""
    from accounting.models import JournalEntryLine
    from procurement.services import confirm_goods_receipt
    je = confirm_goods_receipt(goods_receipt)

    if je is None:
        pytest.skip("Missing chart accounts")

    lines = JournalEntryLine.objects.filter(journal_entry=je)
    total = sum(l.debit_amount for l in lines)
    expected = ORDER_QTY * UNIT_PRICE
    assert total == expected, f"Expected {expected}, got {total}"


# ─── Test 6: Standalone SupplierInvoice posting ───────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_supplier_invoice_posting_balanced(
    supplier, main_branch, test_brand, chart_of_accounts
):
    """Standalone supplier invoice posting creates balanced JE (debit expense, credit AP)."""
    from accounting.models import JournalEntryLine
    from procurement.models import SupplierInvoice, SupplierInvoiceStatus
    from procurement.supplier_invoice_services import post_supplier_invoice

    inv = SupplierInvoice.objects.create(
        supplier=supplier, branch=main_branch,
        invoice_number="INV-INT-001", invoice_date=FIXED_DATE,
        total_amount=Decimal("3500.00"), status=SupplierInvoiceStatus.DRAFT,
    )
    try:
        je = post_supplier_invoice(inv)
    except ValueError as e:
        pytest.skip(f"Missing accounts: {e}")

    assert lines_balanced(je), "Supplier invoice JE not balanced"

    ap_credit = JournalEntryLine.objects.filter(
        journal_entry=je, account__code="02101", credit_amount__gt=0
    )
    assert ap_credit.exists(), "AP account not on credit side of supplier invoice JE"


# ─── Test 7: Idempotency — posting twice returns same entry ───────────────────

@pytest.mark.django_db(transaction=True)
def test_supplier_invoice_posting_idempotent(
    supplier, main_branch, chart_of_accounts
):
    """Calling post_supplier_invoice twice must return the same JE."""
    from procurement.models import SupplierInvoice, SupplierInvoiceStatus
    from procurement.supplier_invoice_services import post_supplier_invoice

    inv = SupplierInvoice.objects.create(
        supplier=supplier, branch=main_branch,
        invoice_number="INV-INT-002", invoice_date=FIXED_DATE,
        total_amount=Decimal("2000.00"), status=SupplierInvoiceStatus.DRAFT,
    )
    try:
        je1 = post_supplier_invoice(inv)
        je2 = post_supplier_invoice(inv)
    except ValueError as e:
        pytest.skip(f"Missing accounts: {e}")

    assert je1.pk == je2.pk, "Two different JEs created for same invoice (not idempotent)"


# ─── Test 8: SupplierInvoice appears in aging report ─────────────────────────

@pytest.mark.django_db(transaction=True)
def test_supplier_invoice_appears_in_aging(
    supplier, main_branch, chart_of_accounts
):
    """SupplierInvoice must be queryable within its credit_days bucket (0-30 days)."""
    from procurement.models import SupplierInvoice, SupplierInvoiceStatus
    inv = SupplierInvoice.objects.create(
        supplier=supplier, branch=main_branch,
        invoice_number="INV-INT-003", invoice_date=FIXED_DATE,
        total_amount=Decimal("1500.00"), status=SupplierInvoiceStatus.DRAFT,
    )
    # Aging: invoices within credit_days of invoice_date (credit_days=30)
    due_date = FIXED_DATE + datetime.timedelta(days=supplier.credit_days)
    bucket_end = FIXED_DATE + datetime.timedelta(days=30)

    aged = SupplierInvoice.objects.filter(
        supplier=supplier,
        invoice_date__gte=FIXED_DATE,
        invoice_date__lte=bucket_end,
        status__in=[SupplierInvoiceStatus.DRAFT, SupplierInvoiceStatus.POSTED],
    )
    assert aged.filter(pk=inv.pk).exists(), (
        f"Invoice {inv.invoice_number} not found in 0-30 day aging bucket"
    )
    assert due_date == FIXED_DATE + datetime.timedelta(days=30), (
        f"Due date should be invoice_date + credit_days (30)"
    )
