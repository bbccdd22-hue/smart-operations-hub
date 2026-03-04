# Oracle Legacy Schema Alignment — Proposals

This document proposes Django model extensions to align with the Oracle BRWBLD60/schema_reference design. Implement only what your product needs.

---

## 1. Already Mapped (no change required)

| Oracle | Current model |
|--------|----------------|
| LOCATION | org.Branch (per Brand) |
| DEPARTMENT | hr.CostCenter (per Branch/Brand) |
| JOB | org.UserProfile.role, hr.Employee |
| EMPLOYEE | hr.Employee |
| PRODUCT (catalog) | inventory.Ingredient, inventory.FoodicsProduct |
| SALES_ORDER “concept” (aggregated sales) | shifts.ShiftClosing, pos (sales by shift/channel) |

---

## 2. Optional: Product list/min price and validity (PRICE)

**Oracle:** PRICE(PRODUCT_ID, LIST_PRICE, MIN_PRICE, START_DATE, END_DATE).

**Proposal:** Add a new model (e.g. under `inventory` or `pos`):

- **ProductPrice:** product (FK to Ingredient or FoodicsProduct), list_price, min_price, start_date, end_date; unique (product, start_date). Use for “price at time of sale” and margin checks.

---

## 3. Optional: Customer master (CUSTOMER)

**Oracle:** CUSTOMER_ID, NAME, ADDRESS, CITY, STATE, ZIP_CODE, AREA_CODE, PHONE_NUMBER, SALESPERSON_ID, CREDIT_LIMIT, COMMENTS.

**Proposal:** Add `crm.Customer` or `sales.Customer`:

- **Customer:** brand (FK), name, name_ar, address, city, state, zip_code, phone, salesperson_id (FK to User or HR.Employee), credit_limit, comments. Optional: link to Branch for “default branch”.

Use when you need explicit B2B customers and credit limits; not required for pure POS/shift-based sales.

---

## 4. Optional: Explicit sales order header + lines (SALES_ORDER / ITEM)

**Oracle:** SALES_ORDER(ORDER_ID, ORDER_DATE, CUSTOMER_ID, SHIP_DATE, TOTAL); ITEM(ORDER_ID, ITEM_ID, PRODUCT_ID, ACTUAL_PRICE, QUANTITY, TOTAL).

**Proposal:** Add `sales.SalesOrder` and `sales.SalesOrderLine`:

- **SalesOrder:** branch (FK), customer (FK, nullable), order_date, ship_date (nullable), total (Decimal), status, reference.
- **SalesOrderLine:** sales_order (FK), line_number, product/ingredient (FK), actual_price, quantity, total (or compute as actual_price * quantity).

**Rules (from Oracle movement logic):**

- `SalesOrder.total` must equal `SUM(SalesOrderLine.total)` for that order (validate on save).
- `SalesOrderLine.total` = actual_price * quantity (set or validate on save).

Implement when you need formal “orders” (e.g. B2B, wholesale) in addition to shift-based sales.

---

## 5. Validation helper (any header + lines)

Use a small helper wherever you have “header total” and “line totals”:

```python
def validate_header_total(header_total: Decimal, line_totals: list[Decimal], tolerance: Decimal = Decimal("0.01")) -> bool:
    return abs(header_total - sum(line_totals)) < tolerance
```

Use in:

- Journal entry (already: total debit = total credit).
- Procurement (e.g. GRN/Purchase order) if header has a total.
- Future SalesOrder/SalesOrderLine.

---

## 6. Summary

- **No mandatory new tables** for the current codebase; Branch, CostCenter, Employee, Ingredient, ShiftClosing already cover much of the Oracle scope.
- **Optional:** ProductPrice, Customer, SalesOrder + SalesOrderLine for full Oracle-style sales and pricing.
- **Always:** Enforce “header total = sum(line totals)” and “line total = price × quantity” in services that manage orders or movements.

See **ORACLE_LEGACY_INTEGRATION.md** for movement logic and reporting alignment.
