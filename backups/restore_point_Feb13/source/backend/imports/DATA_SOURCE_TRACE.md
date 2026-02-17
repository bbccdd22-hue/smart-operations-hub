# Data Source Trace: عدد الطلبات (Order Count)

## 1. End-to-End Flow

### Upload Path
1. User uploads Excel via `ExcelUploadView` or Smart Upload
2. `report_type` is set by user or `suggested_report_type` from `parse_preview()`
3. `parse_excel_upload(upload, report_type=ExcelReportType.DAILY_SALES, column_mapping=...)` is called

### parse_excel_upload() [parser.py:947]
```python
# Step 1: Read Excel
df = pd.read_excel(file, header=0)

# Step 2: Normalize column names (CRITICAL)
def _norm_col(c):
    s = str(c).strip().strip("\ufeff")
    return " ".join(s.lower().split())  # Arabic unchanged
df.columns = [_norm_col(c) for c in df.columns]
# "عدد الطلبات" stays "عدد الطلبات" (Arabic has no case)

# Step 3: Auto-detect or use provided mapping
mapping = column_mapping or detect_columns(df)
# detect_columns matches "عدد الطلبات" -> order_count

# Step 4: Rename columns for parser
df = apply_column_mapping(df, mapping)
# Renames "عدد الطلبات" -> "Order Count" (FIELD_TO_PARSER_COL["order_count"])

# Step 5: Parse
meta = parse_daily_sales(df, upload, ...)
```

### parse_daily_sales() [parser.py:537]
**Function responsible for finding عدد الطلبات:**

```python
order_col = _get_col(
    df, ORDER_COUNT_COLS + list(ORDER_COUNT_CONTAINS),
    required=False,
    contains_match=True,
)
# ORDER_COUNT_COLS = ["Order Count", "عدد الطلبات"]
# Fallback: scan df.columns for "عدد" + "طلبات" if _get_col returns None

# Exact mapping to DB (per row):
order_raw = _scalar(order_col, idx)
order_cnt = int(float(order_raw)) if order_raw is not None else 0
# Stored in DailySale.order_count
rows.append(DailySale(..., order_count=order_cnt, ...))
```

## 2. ROOT CAUSE: Summary Row Skipped

**The bug:** `_branch_or_brand_is_summary()` [parser.py:292] skips rows where Branch or Brand contains "المجموع", "مجموع", or "total".

In Foodics Daily Sales, **the row with 35,985 is often the TOTAL row** (الفرع = "المجموع" or "الإجمالي"). We skip it before reading order_count:

```python
# Line 596-598 - WE SKIP HERE
if _branch_or_brand_is_summary(br_val, b_val):
    continue  # Never reads order_count from this row!
```

**Result:** 35,985 is never read because it lives in the row we discard.

## 3. Why كاش فودكس & سبان Show But Orders Don't

| Metric | Source Report | Source Table | Column |
|--------|---------------|--------------|--------|
| كاش فودكس | **Payments Report** (تقرير المقبوضات) | FoodicsPaymentRecord | طريقة الدفع = كاش |
| سبان | **Payments Report** | FoodicsPaymentRecord | طريقة الدفع = سبان |
| عدد الطلبات | **Daily Sales Report** (تقرير المبيعات اليومية) | DailySale | عدد الطلبات |
| متوسط عدد الطلبات | **Daily Sales Report** | DailySale | متوسط الطلب |

**They are from DIFFERENT Excel reports.** Payments Report does not have عدد الطلبات. Daily Sales does. If Daily Sales has 0 (due to summary row skip), Orders cards stay 0.

## 4. Report Type Confusion

- If file is classified as **Product Sales** (has المنتج column), we run `parse_product_sales()` which **never reads عدد الطلبات**.
- Daily Sales and Product Sales are different Foodics exports.
- Ensure you select "Daily Sales" (تقرير المبيعات اليومية) when uploading.

## 5. Reconciliation Audit: Why كاش فودكس & سبان Show But Orders Don't

| Data | Excel Report | Parser Function | Model |
|------|--------------|-----------------|-------|
| كاش فودكس | **Payments Report** (تقرير المقبوضات) | parse_payments_report() | FoodicsPaymentRecord |
| سبان | **Payments Report** | parse_payments_report() | FoodicsPaymentRecord |
| عدد الطلبات | **Daily Sales Report** (تقرير المبيعات اليومية) | parse_daily_sales() | DailySale |
| متوسط عدد الطلبات | **Daily Sales Report** | parse_daily_sales() | DailySale |

**They are NOT from the same file.** Payments Report has columns: يوم، الفرع، طريقة الدفع، المبلغ الصافي. It has no عدد الطلبات. Daily Sales has: يوم، الفرع، صافي المبيعات، عدد الطلبات، متوسط الطلب. You must upload BOTH reports. كاش فودكس and سبان come from Payments; Orders come from Daily Sales.

**If Orders show 0:** Either (a) Daily Sales was not uploaded, (b) the file was classified as Product Sales, or (c) the 35,985 was in the المجموع row which we previously skipped (now fixed).
