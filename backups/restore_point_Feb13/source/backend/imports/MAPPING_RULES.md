# Excel Column Mapping Rules (Permanent)

## Source Separation — NO OVERLAP

**Daily Sales and Payments Report are separate sources. Never mix.**

### 1. DAILY SALES REPORT (تقرير المبيعات اليومية) — ONLY source for:
- **Order Count** (عدد الطلبات): Map strictly to `عدد الطلبات` column.
- **Average Order** (متوسط عدد الطلبات): Read `متوسط الطلب` column directly. DO NOT calculate.

### 2. PAYMENTS REPORT (تقرير المقبوضات) — ONLY source for Financial Summary:
- **Cash Foodics** (كاش فودكس): Sum entries under `كاش` or `Cash`.
- **Span** (سبان): Sum entries under `سبان` or `Span`.
- **Delivery Apps** (تطبيقات التوصيل): Group Jahez, ToYou, Hanger Station, etc.

## Order Count vs Product Quantity — STRICT RULE

**Order Count ≠ Product Quantity.**

| Column (AR)   | Column (EN)     | Use For           | NEVER Use For      |
|---------------|-----------------|-------------------|--------------------|
| عدد الطلبات   | Order Count     | Total Orders      | —                  |
| كمية المبيعات | Sales Quantity  | Items sold        | Total Orders       |

- **Order Count** = Sum of `عدد الطلبات` from **Daily Sales** only.
- **Average Order** = Weighted average of `متوسط الطلب` per row (DO NOT compute from Net Sales ÷ Order Count).

## Report Types

- **Daily Sales**: `عدد الطلبات` → order_count. `متوسط الطلب` → average_order (pre-calculated from Excel).
- **Product Sales**: `كمية المبيعات` → qty (items). Never use for orders.
- **Payments Report**: كاش, سبان, تطبيقات التوصيل → Financial Summary only.
