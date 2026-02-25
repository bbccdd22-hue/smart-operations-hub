# تقرير التدقيق الشامل – Enterprise Grade Audit
## Smart Operations Hub – مراجعة نهائية على مستوى الأنظمة العالمية

---

## 1. النزاهة المحاسبية والمالية (Financial Integrity)

### 1.1 تتبع الهللة (Penny Tracking)

**البنية الحالية:**

| الطبقة | النموذج | الحقل | الدقة |
|--------|---------|-------|-------|
| المبيعات | ProductSale | total_sales, qty | `Decimal(max_digits=14, decimal_places=2)` |
| المبيعات | DailySale | total_sales, cash, network | `Decimal(max_digits=14, decimal_places=2)` |
| إقفال الوردية | ShiftClosing | جميع الحقول المالية | `Decimal(max_digits=12, decimal_places=2)` |
| القيود | JournalEntryLine | debit_amount, credit_amount | `Decimal(max_digits=18, decimal_places=2)` |

**مسار البيانات:**
- Excel → `Decimal(str(val))` في `_parse_date_cell` والتحويلات
- لا يُستخدم `float` في المسارات المالية – الاعتماد على `Decimal` يقلّل أخطاء الفاصلة العائمة
- القيد المحاسبي يُبنى من `closing.manual_cash_total()` و `manual_network_total()` – قيم محفوظة كما هي بدون تقريب إضافي

**التقريب في الضرائب والخصومات:**
- النظام يقرأ **صافي المبيعات** (Net Sales) من Foodics – القيمة النهائية بعد الخصم والضريبة
- لا يوجد حساب داخلي للضرائب أو الخصومات – يتم استيراد القيم الجاهزة
- `ProductSale.total_sales` = صافي المبيعات لكل منتج (بعد الخصم)
- لا توجد نقطة تقريب في السلسلة – البيانات تُنسخ كما وردت من Excel

**مطابقة القيود مع Foodics:**
- القيد المحاسبي مبني من **إقفال الوردية** (ShiftClosing) وليس من تقرير المبيعات مباشرة
- مصدر القيد: المدخلات اليدوية (عد الفئات، MADA، Visa، إلخ) + قيم النظام (system_cash، system_network)
- لا يوجد ربط تلقائي بين `ProductSale` و `JournalEntry` – المساران منفصلان
- **توصية:** إذا كان الهدف إثبات تطابق القيد مع Foodics: إضافة تحقق يطابق `sum(JournalEntry lines)` مع `ProductSale/DailySale` للفترة نفسها في تقرير المصالحة

---

### 1.2 التدقيق العكسي (Audit Trail) وتسلسل الربط

**المسار من جرام مخصوم إلى مصدره:**

```
StockMovement (id, reference, qty_delta, branch_id, ingredient_id)
    ↓ reference = "product_sale_upload_{upload_id}_b{branch_id}_i{ingredient_id}"
ExcelUpload (id)
    ↓
ProductSale (upload_id, branch_id, product_sku, qty, total_sales)
```

- **من StockMovement إلى ProductSale:** استخراج `upload_id` من `reference`، ثم `ProductSale.objects.filter(upload_id=...)`
- **من ProductSale إلى ExcelUpload:** `ProductSale.upload` (FK)

**من القيد إلى الإقفال:**
```
JournalEntry (shift_closing_id) → ShiftClosing (id)
ShiftClosing (shift_id) → Shift (branch, opened_at)
```

**ما لا يوجد حاليًا:**
- ربط مباشر من `ProductSale` (سطر مبيعات) إلى `StockMovement` – التجميع يتم على مستوى (branch, ingredient) وليس على مستوى سطر المبيعات
- رقم فاتورة Foodics (order_id) غير مخزن في ProductSale – التقرير Excel لا يحتوي عادة على معرّف الطلب لكل سطر
- **توصية:** إذا كان Excel يحوي عمود order_id أو transaction_id، إضافة حقول اختيارية لربط كل سطر بمعرّف الفاتورة

**جدول تسلسل الربط (ID Mapping):**

| من | إلى | آلية الربط |
|----|-----|------------|
| StockMovement | ExcelUpload | `reference` → استخراج upload_id |
| StockMovement | ProductSale (مجمع) | نفس upload + branch + ingredient |
| JournalEntry | ShiftClosing | FK `shift_closing_id` |
| ShiftClosing | Shift | FK `shift_id` |
| WasteLog | BranchStock | branch_id, ingredient_id, date |

---

## 2. هندسة المخزون المتقدمة (Inventory Engineering)

### 2.1 التزامن والسباق (Race Conditions)

**الوضع الحالي:**
- **لا يوجد** `select_for_update()` أو قفل صفوف في أي عملية مخزنية
- التحويلات والتحديثات تُنفَّذ داخل `transaction.atomic()` بدون قفل صريح

**سؤال: موظفان في فرعين مختلفين يحوّلان نفس الصنف في نفس اللحظة**

- الفرعان مختلفان → كل تحويل يخصم من `BranchStock` لفرع مختلف (branch_id مختلف)
- لا يوجد تعارض لأن `BranchStock` مقيّد بـ `(branch, ingredient)` – كل فرع له سجل منفصل
- **لا Double Spending** في هذه الحالة – التحويلات مستقلة

**سؤال: نفس الفرع – تحويلان لنفس المكوّن في نفس اللحظة**

- إذا أرسل الفرع A تحويلين لنفس المكوّن في وقت واحد:
  - `process_transfer_departure` يخصم من `stock_from.on_hand`
  - بدون `select_for_update` قد يحدث:
    1. Transaction 1: يقرأ on_hand = 100
    2. Transaction 2: يقرأ on_hand = 100 (قبل حفظ 1)
    3. Transaction 1: يحسب 100 - 20 = 80، يحفظ
    4. Transaction 2: يحسب 100 - 30 = 70، يحفظ → **فقدان 10 وحدات** (التحويل الثاني يكتب فوق الأول)

**توصية حرجة:**
```python
# في transfer_services.py و depletion_services.py
stock_from = BranchStock.objects.select_for_update().get(...)
# أو
BranchStock.objects.select_for_update().filter(
    branch=..., ingredient=...
).first()
```
إضافة قفل صف على `BranchStock` عند أي خصم أو تحويل لتجنّب Race Conditions.

---

### 2.2 إدارة الوصفات المعقدة (Nested Recipes)

**البنية الحالية:**
- `Recipe` مرتبط بـ `FoodicsProduct` (منتج نهائي)
- `RecipeLine` يربط `Recipe` بـ `Ingredient` + Unit + qty
- `Ingredient` = مواد خام (raw materials) فقط – لا يوجد نموذج "نصف مصنع" أو مكوّن فرعي

**استنتاج:**
- النظام **لا يدعم** وصفات متداخلة (nested recipes)
- إذا كان "الصوص" منتجاً وسيطاً (Product) له وصفة: يجب إنشاء FoodicsProduct للصوص + Recipe يربطه بمكونات خام
- إذا كان "الصوص" مكوّناً (Ingredient): يُعتبر مادة خام ولا تُحسب من وصفة أخرى
- المسار الحالي: `Product → Recipe → RecipeLine → Ingredient` (مستوى واحد فقط)

**توصية للمستقبل:**
- إضافة نموذج `SemiFinished` أو دعم `Ingredient` أن يكون له `Recipe` فرعية
- توسيع `explode_recipe_requirements` لإعادة الاستدعاء عند مواجهة مكوّن له وصفة

---

## 3. استقرار السيرفر والأداء (System Resilience)

### 3.1 اختبار التحمل – 50 فرع × 10,000 سطر/يوم

**الحجم:**
- 500,000 سطر ProductSale/يوم
- ~15 مليون سطر/شهر

**نقاط الضعف المحتملة:**

| المكوّن | التقييم | التفاصيل |
|---------|---------|----------|
| **Database** | معرّض | ProductSale له index (branch, date) – استعلامات النطاق كفؤة. لكن `bulk_create` دفعات 1000 قد تستغرق وقتاً مع حجم كبير |
| **Memory** | معرّض | `pd.read_excel` يحمّل الملف بالكامل في الذاكرة. ملف 10K سطر × 50 فرع ≈ 500K سطر – قد يصل لـ 100–200 MB |
| **Parser** | متوسّط | الحلقات في Python قد تكون أبطأ من C. التفكير في `chunksize` أو معالجة متوازية |
| **Transaction** | معرّض | `transaction.atomic()` يحتوي bulk_create + process_product_sale_depletion – وقت القفل طويل وقد يؤخر الطلبات الأخرى |

**الفهارس الحالية (ملخص):**
- ProductSale: `(branch, date)`, `(product_name)`
- DailySale, HourlySale: `(branch, date)`
- StockMovement: لا يوجد index مركّب – الاستعلامات على `reference__startswith` قد تكون كلفة أعلى
- StockTransfer: `status`, `requested_at` عبر db_index

**توصيات للأداء:**
1. إضافة فهرس مركّب لـ StockMovement: `(branch_id, movement_type, created_at)` للتقارير
2. تقسيم الرفع إلى ملفات أصغر (فرع/يوم) أو معالجة chunk-by-chunk
3. تحويل عملية الرفع إلى مهمة خلفية (Celery) لتجنّب timeout
4. مراقبة حجم الجلسات (Sessions) – استخدام Redis للـ session store عند زيادة عدد المستخدمين

---

### 3.2 التعافي من الكوارث (Failure Recovery)

**مسار رفع Product Sales:**
```python
with transaction.atomic():
    ProductSale.objects.bulk_create(rows, batch_size=1000)
    process_product_sale_depletion(upload)
```

- عند **نجاح** `transaction.atomic()`: كل العمليات تُحفظ أو لا يُحفظ شيء
- عند **فشل** (انقطاع، exception): يتم rollback تلقائي – لا تبقى سجلات يتيمة

**سيناريو انقطاع في منتصف bulk_create:**
- PostgreSQL/MySQL يطبق الـ transaction كلها أو لا يطبقها
- في حالة انقطاع الاتصال: القسم الذي تم تنفيذه قد يلتزم (commit) اعتماداً على نقطة الفشل
- Django `transaction.atomic()` يستخدم savepoint عند الحاجة؛ إذا وقع الخطأ قبل الـ commit، يتم الـ rollback

**استثناء محتمل:**
- إذا انقطع الاتصال بعد `bulk_create` وقبل انتهاء `process_product_sale_depletion`:
  - الفشل سيرمي exception → rollback للـ atomic block بالكامل
  - لن يتبقى ProductSale دون depletion لأنهما ضمن نفس الـ transaction

**توصية:** التأكد من أن إعدادات قاعدة البيانات (statement_timeout، lock_timeout) معقولة حتى لا تبقى transactions معلقة لفترة طويلة.

---

## 4. أمن المعلومات والتحكم (Security & Governance)

### 4.1 CSRF و XSS

**CSRF:**
- `CsrfViewMiddleware` مفعّل في settings
- الواجهة الأمامية ترسل `X-CSRFToken` مع الطلبات المعدّلة
- نقطة CSRF token: `/api/auth/csrf/` مع `@ensure_csrf_cookie`
- **استثناء:** `ProductsWithRecipesView` يستخدم `@csrf_exempt` – تعليق يشير إلى أنه مؤقت للاختبار. **يجب إزالته في الإنتاج.**

**XSS:**
- React يقوم بعمل escape تلقائي للنصوص في JSX
- `dangerouslySetInnerHTML` – البحث في الكود: لا يُستخدم في عرض مدخلات المستخدم
- تمثيل البيانات يأتي من API بصيغة JSON – لا يتم تضمين HTML من المستخدم مباشرة في الصفحة بدون تنظيف

---

### 4.2 عزل صلاحيات المالك (SAIF) في الـ Backend

**آلية التحقق:**
- `is_super_admin(user)` = `user.username == "SAIF"` (حرفي، بأحرف كبيرة)
- التحقق يتم دائماً في طبقة الـ Backend (views) قبل تنفيذ العمليات الحساسة

**أمثلة:**
- CityClearView, UserDelete, RolePermissionConfig, AdminNotification, SystemErrorLog, ChartOfAccounts delete: كلها تفحص `is_super_admin` أو `username == "SAIF"`
- صلاحيات المستخدمين تُحدّد من `UserProfile.role` و `RolePermissionConfig` – لا يمكن للموظف تعديل صلاحيات نفسه

**السؤال: هل يمكن لمستخدم مخترق (موظف) الوصول لصلاحيات SAIF؟**
- لا – صلاحية SAIF مرتبطة بـ `username == "SAIF"` وليست flag يمكن تزويره
- تعديل username يتطلب صلاحيات Django admin أو وصولاً مباشراً لقاعدة البيانات
- واجهات تعديل المستخدم تمنع تغيير username لـ SAIF: `if user.username == "SAIF":` لا يسمح بالتعديل/الحذف

---

### 4.3 حماية البيانات التاريخية – منع تعديل الإقفالات القديمة

**الحماية الحالية:**
- عند إنشاء/تحديث إقفال: `if shift.closed_at: return 400`
- عند التحديث: `if closing.status == "submitted": return 400 "Shift already submitted"`
- بمجرد اعتماد الإقفال، لا يمكن تعديله عبر `ShiftClosingCreateView`

**السؤال: هل يمكن إعادة فتح وردية مغلقة؟**
- لا يوجد endpoint لـ "إعادة فتح" أو تغيير status من submitted إلى draft
- التحقق `shift.closed_at` يمنع إنشاء إقفال جديد لنفس الوردية

**ثغرة محتملة:**
- واجهة تعديل ShiftClosing (إن وُجدت) قد تسمح بتعديل الحقول إذا لم يكن هناك فحص `status == "submitted"`
- الكود الحالي: عند `created=False` و `closing.status == "submitted"` يتم الرفض فوراً – لا يمكن تحديث أي حقل

**توصية:** إضافة `read_only` أو حذف إمكانية التحديث بالكامل للإقفالات المعتمدة من الواجهة.

---

## 5. التكامل النهائي – 3 نقاط ضعف محتملة وحلول استباقية

### 5.1 ضعف 1: تضارب المخزون عند التزامن (Inventory Race)

**الوصف:** طلبان تحويل أو خصم متزامنان لنفس (فرع، مكوّن) قد ينتجان رصيداً خاطئاً.

**الحل الاستباقي:**
- استخدام `select_for_update()` على `BranchStock` في:
  - `transfer_services.process_transfer_departure`
  - `transfer_services.confirm_transfer`
  - `transfer_services.reject_transfer`
  - `depletion_services.process_product_sale_depletion`
- إضافة UniqueConstraint على التحويلات المعلقة لنفس (from_branch, to_branch, ingredient) إذا كان منطق الأعمال يمنع التكرار.

---

### 5.2 ضعف 2: تدهور أداء الرفع مع النمو

**الوصف:** رفع ملف مبيعات كبير (مثلاً 500K سطر) قد يفشل أو يتسبب في timeout أو استهلاك ذاكرة عالٍ.

**الحل الاستباقي:**
1. تحديد حد أقصى لحجم الملف (مثلاً 50K سطر) مع رفض الملفات الأكبر
2. تحويل الرفع إلى مهمة خلفية (Celery + Redis) مع إرجاع job_id وتتبع التقدّم
3. معالجة chunk-by-chunk باستخدام `pd.read_excel(..., chunksize=5000)` إن أمكن
4. إضافة قائمة انتظار (queue) للرفوعات لتفادي الحمل على السيرفر

---

### 5.3 ضعف 3: انزياح البيانات بين المصادر (Data Drift)

**الوصف:** بعد أشهر من التشغيل قد تظهر فروق بين ProductSale و DailySale و ShiftClosing لنفس اليوم/الفرع، دون آلية اكتشاف تلقائي.

**الحل الاستباقي:**
1. إضافة تقرير مصالحة يومي يوضح:
   - sum(ProductSale.total_sales) vs sum(DailySale.total_sales) vs ShiftClosing.system_total_sales
   - التنبيه عند تجاوز فرق معيّن (مثلاً 1 SAR أو 0.01%)
2. إنشاء Audit Table يحفظ لقطات دورية للمجاميع الرئيسية
3. استخدام checksum أو hash لمجموع السجلات للتحقق من سلامة البيانات

---

## خلاصة التقييم

| المجال | الحالة | الملاحظة |
|--------|--------|----------|
| النزاهة المحاسبية | ✅ جيدة | استخدام Decimal، قيد مزدوج متوازن. لا ربط مباشر بين ProductSale والقيود. |
| التدقيق العكسي | ⚠️ جزئي | reference يربط StockMovement بـ upload. لا ربط بمعرّف فاتورة. |
| التزامن المخزوني | ⚠️ معرّض | لا يوجد select_for_update. إضافة أقفال ضرورية. |
| الوصفات المتداخلة | ❌ غير مدعومة | مسار واحد فقط: Product → Recipe → Ingredient. |
| أداء الرفع | ⚠️ معرّض | bulk في ذاكرة واحدة. يُفضّل chunking ومهام خلفية. |
| التعافي من الفشل | ✅ جيد | transaction.atomic يمنع السجلات المتفرقة. |
| CSRF | ✅ مفعّل | استثناء csrf_exempt في view واحد يجب إزالته. |
| XSS | ✅ محمي | React + عدم استخدام dangerouslySetInnerHTML للمدخلات. |
| عزل SAIF | ✅ محكم | التحقق في Backend فقط، ولا يمكن تزوير الصلاحيات. |
| حماية الإقفالات | ✅ جيدة | لا تعديل بعد submitted. |

---

*تاريخ التقرير: فبراير 2026*
