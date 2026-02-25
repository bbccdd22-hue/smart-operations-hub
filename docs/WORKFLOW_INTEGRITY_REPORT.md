# تقرير تكامل سير العمل – Workflow Integrity Report
## Smart Operations Hub – التقرير الفني النهائي

---

## 1. تتبع دورة المبيعات والمخزون (Sales-to-Inventory Lifecycle)

### 1.1 الربط بين ProductSale و StockMovement

**المسار البرمجي:**

1. **رفع ملف مبيعات المنتجات:**
   - `backend/imports/views.py` → استقبال الملف
   - `backend/imports/parser.py::parse_product_sales()` → تحليل Excel واستخراج الصفوف
   - داخل `transaction.atomic()`:
     - `ProductSale.objects.bulk_create(rows)` – حفظ سجلات المبيعات
     - `process_product_sale_depletion(upload)` – استدعاء خصم المخزون

2. **إنشاء StockMovement:**
   - `backend/inventory/depletion_services.py::process_product_sale_depletion(upload)`
   - يجمع المبيعات حسب `(branch_id, product_sku)` من `ProductSale.objects.filter(upload=upload)`
   - ينفّذ `explode_recipe_requirements(sku_to_qty)` لتحويل المنتجات المباعة إلى مكونات
   - لكل مكوّن: ينشئ `StockMovement` مع:
     - `movement_type = DEPLETION`
     - `reference = f"product_sale_upload_{upload.id}_b{branch_id}_i{ingredient_id}"`
     - `qty_delta = -qty_deplete` (قيمة سالبة)

**الربط عبر Reference ID:**

- الحقل `StockMovement.reference` (max 128 chars) يحوي:
  - `product_sale_upload_{upload_id}_b{branch_id}_i{ingredient_id}`
- يتيح تتبع سبب الخصم: رقم الرفع، الفرع، المكوّن
- **لا يوجد FK مباشر** من `StockMovement` إلى `ProductSale` – الربط يتم عبر `reference` + `upload`
- للوصول من حركة مخزنية إلى مصدر المبيعات: استخراج `upload_id` من `reference` ثم `ProductSale.objects.filter(upload_id=...)`

**منع المعالجة المكررة:**

```python
# depletion_services.py:46-50
ref_prefix = f"product_sale_upload_{upload.id}_"
if StockMovement.objects.filter(
    movement_type=StockMovementType.DEPLETION,
    reference__startswith=ref_prefix,
).exists():
    return {"movements_created": 0, ...}  # Already processed
```

---

### 1.2 تحويل الوحدات (UOM Conversion) ودقة الفواصل العشرية

**المسار:**

- `RecipeLine.qty` و `RecipeLine.unit` – الكمية لكل دفعة وصفة بالوحدة المحددة
- `explode_recipe_requirements()` في `inventory/services.py`:
  - `qty_per_product = line.qty / yield_qty` – لكل منتج مباع
  - `total_for_product = qty_per_product * Decimal(count)`
  - `base_qty = _to_base_qty(line.unit, total_for_product, base_unit)` – تحويل لوحدة المكوّن الأساسية
- `_to_base_qty()` في `inventory/services.py`:
  - إذا كانت `unit.base_unit_id == target_base_unit.id`: `qty * (unit.factor_to_base or 1)`
  - مثال: 1 L = 1000 ML → `factor_to_base = 1000`

**دقة الفواصل:**

| النموذج | الحقل | الدقة |
|---------|-------|-------|
| RecipeLine | qty | `Decimal(max_digits=12, decimal_places=4)` |
| Ingredient base_unit | - | عبر Unit |
| Unit | factor_to_base | `Decimal(max_digits=18, decimal_places=6)` |
| StockMovement | qty_delta | `Decimal(max_digits=14, decimal_places=4)` |
| BranchStock | on_hand | `Decimal(max_digits=14, decimal_places=4)` |

- استخدام `Decimal` في كل المسارات يقلّل أخطاء الفاصلة العائمة
- التحويل يتم دائمًا إلى الوحدة الأساسية (g، ml، pcs) قبل التجميع ثم الخصم
- **لا يوجد منطق خاص** لتقريب القيم عند الخصم – يتم استخدام القيمة المحسوبة كما هي

**ملاحظة:** لا يوجد حقل `product_sale_id` أو `product_sale_line_id` في `StockMovement` – التجميع يتم على مستوى الرفع/الفرع/المنتج، وليس لكل سطر مبيعات.

---

## 2. تتبع الدورة المحاسبية (Accounting Integrity)

### 2.1 ترتيب العمليات عند اعتماد إقفال الوردية

**مسار Submit (إنشاء أو تحديث مع submit=true):**

`backend/shifts/views.py::ShiftClosingCreateView.post()` و `ShiftClosingSubmitView.post()`:

```
1. تحديث ShiftClosing.status = "submitted"
2. حفظ ShiftClosing (submitted_at, submitted_by)
3. تحديث Shift.status = CLOSED، closed_at، closed_by
4. حفظ Shift
5. إنشاء ShiftSecurityLog
6. استدعاء create_journal_entry_from_shift_closing(closing)
```

القيد المحاسبي يُنشأ **بعد** تغيير حالة الإقفال.

### 2.2 منع التوليد المزدوج (Double Booking)

`backend/accounting/journal_services.py::create_journal_entry_from_shift_closing()`:

```python
# Avoid duplicate – لا ننشئ قيداً إذا وُجد سابقاً لهذا الإقفال
if JournalEntry.objects.filter(shift_closing=closing).exists():
    return JournalEntry.objects.filter(shift_closing=closing).first()
```

- **مستوى التطبيق فقط** – لا يوجد UniqueConstraint على `(shift_closing_id)` في قاعدة البيانات
- في حال طلبين متزامنين: كلاهما قد يرى `exists() = False` ويُنشئ قيدًا – **احتمال سباق (race)**
- للتأكد التام: إضافة قيد فريد في DB، مثلاً:
  ```python
  class Meta:
      constraints = [UniqueConstraint(fields=["shift_closing"], name="unique_je_per_closing")]
  ```

### 2.3 التتبعية (Traceability)

**من القيد إلى الإقفال:**

- `JournalEntry.shift_closing` – ForeignKey إلى `ShiftClosing`
- الوصول: `journal_entry.shift_closing` → نفس الوردية

**من الإقفال إلى القيد:**

- `ShiftClosing.journal_entries` (related_name)
- الوصول: `closing.journal_entries.all()` → القيود المرتبطة

- لا يوجد واجهة API جاهزة تعرض رابطاً مباشراً من واجهة القيد إلى صفحة الإقفال، لكن البيانات متوفرة في النموذج.

---

## 3. منطق التحويلات والمخزون الوسيط (In-Transit Logic Flow)

### 3.1 لحظة إنشاء التحويل

**المسار:** `backend/inventory/views.py::StockTransferCreateView.post()`:

```python
with transaction.atomic():
    transfer = StockTransfer.objects.create(...)
    for ing_id, qty in valid_lines:
        StockTransferLine.objects.create(transfer=transfer, ingredient_id=ing_id, qty=qty)
    process_transfer_departure(transfer)
```

**`process_transfer_departure()` في `transfer_services.py`:**

1. لكل سطر تحويل:
   - **من الفرع المرسل:** 
     - `StockMovement(TRANSFER_OUT, qty_delta=-qty, reference="transfer_{id}_depart")`
     - `BranchStock.on_hand -= qty` (خصم فوري)
   - **إلى مخزون قيد النقل (فرع IN_TRANSIT):**
     - `StockMovement(TRANSFER_IN, qty_delta=+qty, reference="transfer_{id}_transit")`
     - `BranchStock.on_hand += qty` للفرع `branch_code="IN_TRANSIT"`

**قفل الكميات:**

- لا يوجد حقل `reserved` أو `locked` منفصل
- الخصم يُنفّذ مباشرة من الفرع المرسل – الكمية تنتقل فعلياً إلى IN_TRANSIT
- المخزون المرسل يُخصم ولا يمكن بيعه لأنه لم يعد ضمن `on_hand` لذلك الفرع
- الفرع الوسيط (IN_TRANSIT) يحمل المخزون حتى التأكيد

### 3.2 لحظة التأكيد (Confirm)

**`confirm_transfer()` في `transfer_services.py`:**

1. خصم من IN_TRANSIT: `StockMovement(TRANSFER_OUT)` + `BranchStock.on_hand -= qty`
2. إضافة للفرع المستلم: `StockMovement(TRANSFER_IN)` + `BranchStock.on_hand += qty`
3. تحديث `StockTransfer.status = CONFIRMED`

### 3.3 رفض الاستلام أو إلغاء التحويل

- **لا يوجد منطق جاهز** لرفض أو إلغاء التحويل بعد الإنشاء
- بمجرد إنشاء التحويل، المخزون ينتقل إلى IN_TRANSIT
- الخيارات الحالية:
  - إنشاء تحويل عكسي يدوياً (من المستلم إلى المرسل) لاسترجاع الكميات
  - إضافة ميزة جديدة: "رفض التحويل" تُنفّذ حركات عكسية (إرجاع من IN_TRANSIT إلى المرسل)

---

## 4. مركزية الصلاحيات والأمان (Security Architecture)

### 4.1 Branch Scoping على مستوى QuerySet

**آلية `get_user_scope()` في `core/permissions.py`:**

- يرجع `{brand_ids: [int]|None, branch_ids: [int]|None}`
- `None` = لا قيود (Owner, General Manager)
- `branch_ids = [profile.branch_id]` للمشرف الفرعي (Branch Supervisor)
- `brand_ids` لمدير العلامة دون all_brands

**تطبيق Scope في الـ Views:**

| المكوّن | الملف | المنطق |
|---------|-------|--------|
| ShiftClosingCreateView | shifts/views.py | `if scope["branch_ids"] and branch_id not in scope["branch_ids"]` → PermissionDenied |
| ShiftClosingSubmitView | shifts/views.py | نفس الفحص على `closing.shift.branch_id` |
| StockTransferCreateView | inventory/views.py | `from_branch_id not in scope["branch_ids"]` → PermissionDenied |
| StockTransferConfirmView | inventory/views.py | `to_branch_id not in scope["branch_ids"]` → PermissionDenied |
| قائمة التحويلات | inventory/views.py | `qs.filter(Q(from_branch_id__in=scope["branch_ids"]) \| Q(to_branch_id__in=scope["branch_ids"]))` |
| Command Center | analytics/command_center_views.py | `_get_branch_ids()` يطبّق scope على branch_qs قبل الإرجاع |
| Branches list | org/views.py | `qs.filter(id__in=scope["branch_ids"])` عند وجود scope |

**احتمال تجاوز Scope عبر استدعاءات API مباشرة:**

- **Inventory و Shifts:** تطبّق `get_user_scope` وتُرفض الطلبات غير المسموح بها
- **Analytics (OwnerDashboardSummaryView وغيرها):** تستخدم `permissions.AllowAny` ولا تطبّق `get_user_scope`
- هذه الـ Views تعتمد على `branch_ids` و`brand` من الـ query params
- موظف فرع يمكنه تمرير `branch_ids` لفروع أخرى ويحصل على بياناتها
- **توصية:** إضافة فحص `get_user_scope` وتصفية `branch_ids` حسب الصلاحيات في لوحة التحكم والتحليلات

### 4.2 الحذف: Soft Delete و PROTECT

**استخدام on_delete في النماذج:**

| النماذج | on_delete | الغرض |
|---------|-----------|-------|
| ProductSale, DailySale, HourlySale → ExcelUpload | CASCADE | حذف الرفع يحذف السجلات التابعة (محاذرة) |
| BranchStock, StockMovement → Branch/Ingredient | PROTECT | منع حذف فرع/مكوّن مرتبط بمخزون |
| ShiftClosing → Shift | CASCADE | حذف الوردية يحذف الإقفال (نادر) |
| JournalEntry → ShiftClosing | PROTECT | حفاظاً على القيود التاريخية |
| StockTransfer → Branch | PROTECT | منع حذف فروع لديها تحويلات |
| CostAuditEntry, ManualAdjustment | PROTECT | حماية السجلات المحاسبية |
| SystemErrorLog → User | SET_NULL | عدم فقدان السجلات عند حذف المستخدم |
| ActivityLog → User | SET_NULL | نفس المنطق |

- **لا يوجد Soft Delete رسمي** (حقل `is_deleted` أو `deleted_at`) في النماذج الأساسية
- الاعتماد على `PROTECT` لمنع حذف السجلات ذات الأثر على التقارير والمحاسبة
- التبعيات الأرشيفية (مثل ExcelUpload → ProductSale) تستخدم CASCADE لضمان اتساق البيانات عند حذف الرفوعات

---

## 5. تحليل سجل الأخطاء (Error Logging Analysis)

### 5.1 تمييز خطأ المستخدم عن خطأ النظام

**نموذج SystemErrorLog (`org/models.py`):**

```python
ERROR_TYPES = [
    ("depletion_failed", "فشل خصم المخزون"),
    ("upload_failed", "فشل رفع ملف"),
    ("transfer_failed", "فشل التحويل"),
    ("other", "أخرى"),
]
```

- التمييز يعتمد على **error_type** وليس على صنف "مستخدم/نظام"
- التصنيف الحالي حسب نوع العملية:
  - `depletion_failed`: خصم مخزون فاشل (قد يكون بيانات خاطئة أو نقص مخزون)
  - `upload_failed`: فشل رفع ملف
  - `transfer_failed`: فشل تحويل
  - `other`: غير محدّد
- حقل `user` يشير لمن كان مسجلاً عند حدوث الخطأ

**استدعاء log_system_error:**

- `core/error_logging.py::log_system_error()` – يُستدعى من:
  - `depletion_services.py`: عند مخزون سالب بعد الخصم
  - `inventory/views.py`: عند فشل التحويل
- لا يوجد تصنيف صريح "user_error" vs "system_error"

**توصية للتمييز:**

- إضافة حقل `error_origin` مثل: `("user", "system", "unknown")`
- أو `error_type` إضافية مثل: `validation_error`, `insufficient_stock`, `system_exception`

### 5.2 تنبيهات تراكم الأخطاء غير المعالجة

- حقل `resolved` في `SystemErrorLog` – يميز الأخطاء المعالجة من غير المعالجة
- لوحة تحكم المالك (`OwnerCommandCenterView`) تعرض:
  - `errors_unresolved_count` – عدد الأخطاء غير المعالجة
  - `latest_errors` – أحدث 5 سجلات أخطاء
- مصدر البيانات: `SystemErrorLog.objects.filter(resolved=False).count()` وأحدث السجلات

---

## ملخص التوصيات

| # | البند | التوصية |
|---|-------|---------|
| 1 | Double booking للقيد | إضافة `UniqueConstraint` على `JournalEntry.shift_closing` |
| 2 | رفض التحويل | بناء منطق "رفض التحويل" مع حركات عكسية من IN_TRANSIT للمرسل |
| 3 | Branch scoping في Analytics | تطبيق `get_user_scope` على لوحات التحكم والـ analytics |
| 4 | تصنيف الأخطاء | إضافة `error_origin` أو توسيع `error_type` لتمييز خطأ المستخدم عن خطأ النظام |

---

*تم إعداد هذا التقرير بناءً على تحليل الكود حتى فبراير 2026.*
