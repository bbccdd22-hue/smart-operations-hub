# Prep List – Master Restore Point [2026-02-13]

**DO NOT MODIFY THIS LOGIC WITHOUT EXPLICIT USER CONSENT.**

This document defines the stabilized data pathway and rules for the Prep List feature. Use it as the authoritative reference for restore or validation.

---

## 1. Stabilized Data Pathway

- The **Prep List** MUST always use the **`ProductSale`** table for historical data.
- Logic MUST EXACTLY match **`DashboardChartView`** in `analytics/views.py` to ensure data consistency.
- Backend: `_product_sales_qs(branch_ids, date_from, date_to)` and fallbacks (brand, date-only).
- Frontend: `fetchProductSalesForPrepList()` → `fetchDashboardChartData()` with `report_type: "product_sales"`, `include_all_products: true`.

---

## 2. Branch Mapping Rules

| Reference Branch     | Database link                          |
|----------------------|----------------------------------------|
| مكة الرصيفة (Makkah) | `branch_code` **B36** in Excel/Foodics |

- Match frontend selection to `branch_id` or `branch_code` in ProductSale.
- In `DashboardChartView`, **`branch_code` takes precedence** over `branch_ids` when both are sent.
- Pass `branch_code` from selected branch (e.g. B36) for correct ProductSale resolution.

---

## 3. Forecasting & Temporal Offset

**Formula:**  
`Forecast Reference Start = (User Selection Start - Offset)`

| Method       | Offset     | Example                                      |
|-------------|------------|----------------------------------------------|
| Last Week   | **-7 days**| Feb 15 → Reference: Feb 8                    |
| Last Month  | **-1 month**| Feb 15 → Reference: Jan 15                   |

- Fetch ProductSale for the **reference period** (refFrom, refTo).
- Displayed **Predicted Qty** = **RAW SUM** of sales from that reference period.
- Example: بودينق الشوكولاته = 62 units for Jan 13 (no averaging).

---

## 4. UI Protection

- **"Search" (بحث) button is mandatory** – API calls run ONLY when the user clicks Search.
- **No auto-fetch** on date, branch, or filter changes to avoid black-screen crashes.
- Debounce/auto-refresh on input change is prohibited.

---

## 5. Display Standards

| Item        | Rule                                                                 |
|-------------|----------------------------------------------------------------------|
| Product     | `[SKU] - [Product Name] \| Qty: [Number]`                            |
| Fallback    | `[Product Name] \| Qty: [Number]` when SKU is null                  |
| Quantities  | Raw integers only – no AI or statistical averaging                  |
| Column label| **الكمية المتوقعة (بناءً على الماضي)** / "Predicted Qty (based on history)" |

---

## 6. Recipe Explosion (تفصيل المكونات)

- Clicking a product triggers ingredient breakdown.
- Use **Predicted Qty** from the table: `Predicted Qty × Ingredient Amount in Recipe = Total Raw Materials`.
- `calculateProductionPlan(branchId, [{ product_id, qty: predictedQty }])` – `qty` is the Predicted Qty.

---

## 7. Key Files

| File                    | Purpose                          |
|-------------------------|----------------------------------|
| `backend/analytics/views.py` | DashboardChartView, _product_sales_qs, branch_code precedence |
| `frontend/src/pages/PrepListPage.tsx` | Temporal offset, loadFromSalesData, display format |
| `frontend/src/lib/api.ts` | fetchProductSalesForPrepList, fetchDashboardChartData |

---

*Last updated: 2026-02-13*
