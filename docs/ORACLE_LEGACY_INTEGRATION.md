# تكامل نظام Oracle القديم (saif_new) مع Smart Operations Hub

مرجع: `C:\Users\kings\Desktop\saif_new` — استخراج كامل من Oracle Developer 6i (orant).

---

## 1. ملخص من README.md و INDEX_FULL.md

### محتوى المجلد المرجعي
- **database/** — سكربتات SQL: DEMOBLD (EMP/DEPT)، BRWBLD60 (نظام مبيعات كامل)، schema_reference (هيكل فقط).
- **sql/** — سكربتات Reports، Forms، أمان، OLAP، Query Builder.
- **connection/** — TNSNAMES.ORA وملفات .ora (اتصال GOLD: Host=ACCSAIF, Port=1521, Service=orcl).
- **config/** — SQLNET.ORA، PREFS.ORA، إعدادات أدوات.
- **documentation/** — 01_database_schema.md، 02_movements_and_reports.md، 03_connection_info.md.
- **docs/** — وثائق Oracle (Developer Guide، Reports Builder، النشر).
- **samples_xml/** — videosales.xml (تقرير مبيعات: Quarter, Region, City, Product Category, Sales/Cost/Profit).

### هيكل Oracle BRWBLD60 (نظام مبيعات)
- **LOCATION** → مواقع (REGIONAL_GROUP). **مقابلنا:** Branch + Brand.
- **DEPARTMENT** → أقسام (NAME, LOCATION_ID). **مقابلنا:** CostCenter (HR) مرتبط بـ Branch.
- **JOB** → وظائف (FUNCTION). **مقابلنا:** يمكن ربطه بـ Employee/UserProfile.
- **EMPLOYEE** → موظفون (JOB_ID, MANAGER_ID, SALARY, COMMISSION, DEPARTMENT_ID). **مقابلنا:** HR.Employee + UserProfile.
- **SALARY_GRADE** → درجات رواتب (LOWER_BOUND, UPPER_BOUND). **مقابلنا:** يمكن إضافته في HR.
- **PRODUCT** → منتجات (DESCRIPTION). **مقابلنا:** Ingredient، FoodicsProduct.
- **PRICE** → أسعار (PRODUCT_ID, LIST_PRICE, MIN_PRICE, START_DATE, END_DATE). **مقابلنا:** غير موجود — يُقترح إضافة تسعير تاريخي للمنتجات.
- **CUSTOMER** → عملاء (NAME, ADDRESS, CITY, STATE, ZIP, SALESPERSON_ID, CREDIT_LIMIT, COMMENTS). **مقابلنا:** غير موجود كجدول عملاء — يُقترح للـ CRM/مبيعات B2B.
- **SALES_ORDER** → رأس أمر (ORDER_ID, ORDER_DATE, CUSTOMER_ID, SHIP_DATE, TOTAL). **مقابلنا:** حركات المبيعات حالياً عبر ShiftClosing/POS — يُقترح نموذج صريح لأوامر المبيعات إذا لزم.
- **ITEM** → بنود أمر (ORDER_ID, ITEM_ID, PRODUCT_ID, ACTUAL_PRICE, QUANTITY, TOTAL). **مقابلنا:** تفاصيل الإقفال/بنود المبيعات.
- **SALES** (View) — تجميع مبيعات حسب (SALESPERSON_ID, CUSTOMER_ID, PRODUCT_ID, SUM(TOTAL)).

### منطق الحركات (02_movements_and_reports.md)
- رأس + تفاصيل: SALES_ORDER ← ITEM بربط ORDER_ID.
- إجمالي الأمر: TOTAL = SUM(ITEM.TOTAL) WHERE ORDER_ID = ...
- إجمالي البند: ITEM.TOTAL = ACTUAL_PRICE × QUANTITY.
- ربط العميل والمندوب عبر CUSTOMER_ID و SALESPERSON_ID.

### الاتصال (03_connection_info.md و TNSNAMES.ORA)
- **GOLD:** HOST=ACCSAIF, PORT=1521, SERVICE_NAME=orcl, PROTOCOL=TCP.
- للهجرة المستقبلية أو جلب بيانات: استخدام نفس الاسم GOLD أو سلسلة اتصال مكافئة.

---

## 2. محاذاة الهيكل (ما تم تنفيذه/مقترح)

| Oracle | الحالة في المشروع | إجراء |
|--------|-------------------|--------|
| LOCATION / REGIONAL_GROUP | Branch + Brand | موجود — لا تغيير. |
| DEPARTMENT | CostCenter (HR) مربوط بـ Branch | موجود. |
| JOB | — | اختياري: حقل job أو role في Employee/UserProfile. |
| SALARY_GRADE | — | اختياري: جدول HR لدرجات الرواتب. |
| PRICE (تاريخي) | — | مقترح: ProductPrice أو PricingTier لاحقاً. |
| CUSTOMER + CREDIT_LIMIT + SALESPERSON | — | مقترح: جدول Customer/Account عند تفعيل مبيعات B2B. |
| SALES_ORDER / ITEM | ShiftClosing، بنود إقفال، POS | منطق الرأس/تفاصيل مطبّق في الإقفال والمشتريات؛ تقارير مبيعات تُبنى من نفس المنطق. |

---

## 3. منطق الحركات المعزّز

- التحقق عند حفظ أي حركة «رأس + تفاصيل»: **إجمالي الرأس = مجموع إجماليات البنود** (مع تسامح عشرية).
- تطبيق ذلك في: إنشاء قيود يومية، أوامر شراء/استلام، وأي نموذج أوامر مبيعات مستقبلي.

---

## 4. التقارير والتحليلات

- **عينة videosales.xml:** Quarter، Sales Region، City، Product Category، Total Sales/Cost/Profit، هوامش ربح.
- **تم تنفيذه في المشروع:**
  - **API:** `GET /api/dashboard/sales-summary/?from_date=&to_date=&branch_id=&group_by=branch|product` — يرجع `total_sales`, `by_branch`, `by_product` (أسلوب Oracle SALES view).
  - **واجهة React:** صفحة **ملخص المبيعات** (`SalesSummaryPage.tsx`) — فلتر تاريخ، تجميع حسب فرع أو منتج، جدول وجداول ملخصة.

---

## 5. التشغيل البيني للبيانات

- الإعدادات المحفوظة كمرجع: **docs/ORACLE_GOLD_CONNECTION_REFERENCE.md** — لاستخدامها عند الهجرة من Oracle أو جلب بيانات من خدمة GOLD.

---

*آخر تحديث: من تكامل مرجع saif_new.*
