# التفتيش الممل والنهائي - The Final Exhaustive Audit
## تقرير استدامة نظام سيف لـ 10 سنوات

---

## 1. متانة قاعدة البيانات وتكامل المراجع (Referential Integrity)

### 1.1 البيانات اليتيمة (Orphaned Data)

| الكيان | الحماية | التفاصيل |
|--------|---------|----------|
| **StockMovement** | ✅ PROTECT | `ingredient` و `branch` → `on_delete=PROTECT` (inventory/models.py:189-190) |
| **RecipeLine** | ✅ PROTECT | `ingredient` → `on_delete=PROTECT` (models.py:143) |
| **BranchStock** | ✅ PROTECT | `ingredient`, `branch` → PROTECT (models.py:161-162) |
| **StockTransferLine** | ✅ PROTECT | `ingredient` → PROTECT (models.py:247-248) |
| **WasteLog** | ✅ PROTECT | `ingredient`, `branch` → PROTECT (models.py:269, 276) |

**النتيجة:** عند محاولة حذف مكوّن أو منتج له حركات مخزنية أو سطور وصفة، يُرفع `ProtectedError` ويمنع الحذف. لا توجد بيانات يتيمة.

**استثناء:** `Recipe` → `FoodicsProduct` يستخدم `CASCADE`، لكن `RecipeLine.ingredient` يستخدم `PROTECT`، لذلك حذف المنتج ينجح فقط إن لم يكن هناك `RecipeLine` مرتبط بمكوّن له سجلات أخرى محمية.

### 1.2 UUIDs مقابل IDs

| البند | الحالة | التفاصيل |
|-------|--------|----------|
| **المفاتيح الأساسية** | ⚠️ Integer | جميع النماذج تستخدم `BigAutoField` (IDs عددية) |
| **تعرض IDs في الواجهات** | ⚠️ مخاطرة | `/api/org/branches/<pk>/`, `/api/inventory/ingredients/<pk>/`, `branch_id`, `ingredient_id` في query params |
| **تخمين الروابط (ID Guessing)** | ⚠️ ممكن | طلبات من جهة iPad يمكن تعديل `branch_id=5` إلى `branch_id=1` وتجاوز النطاق إن لم يُفلتر في الـ Backend |

**التوصية:** إضافة UUIDs للكيانات الحساسة (Branch, Ingredient, ShiftClosing) واستخدامها في الواجهات العامة بدل الـ ID العددي.

---

## 2. دقة الحسابات في الحالات الشاذة (Edge Case Calculation)

### 2.1 معالجة الصفر (Zero Division)

| الموقع | الحماية | الكود |
|--------|---------|-------|
| **explode_recipe_requirements** | ✅ | `yield_qty = recipe.yield_qty if recipe.yield_qty and recipe.yield_qty > 0 else Decimal("1")` (inventory/services.py:138) |
| **depletion_services** | ✅ | `if qty_deplete <= 0: continue` (depletion_services.py:94-95) |
| **transfer_services** | ✅ | `if qty <= 0: continue` (transfer_services.py:62-63, 107-108) |
| **calculate_workable_units** | ✅ | `if conversion_factor <= 0:` يرجع قيمة آمنة (services.py:63) |
| **RecipeLine.qty = 0** | ✅ | `qty_per_product = line.qty / yield_qty` → 0/1=0، ثم `total_for_product=0`، لا خصم |

**النتيجة:** إدخال كمية صفر في مكوّن الوصفة لا يسبب `ZeroDivisionError` ولا انهيار نظام الخصم.

### 2.2 الفوارق الضئيلة (Decimal vs Float)

| الحقل / العملية | النوع | الدقة |
|-----------------|------|-------|
| **BranchStock.on_hand** | `DecimalField(max_digits=14, decimal_places=4)` | ✅ |
| **StockMovement.qty_delta** | `DecimalField(max_digits=14, decimal_places=4)` | ✅ |
| **StockTransferLine.qty** | `DecimalField(max_digits=14, decimal_places=4)` | ✅ |
| **عمليات التحويل** | `stock_from.on_hand - qty` (Decimal) | ✅ |
| **transfer_services** | استخدام `Decimal("0")` و `line.qty` مباشرة | ✅ |

**النتيجة:** حسابات "قيد النقل" تُنفّذ كاملةً بـ `Decimal`، ولا يحدث فقدان دقة بسبب float.

---

## 3. أمن الجلسات والاختراق (Hardened Security)

### 3.1 تصعيد الصلاحيات (Privilege Escalation)

| الواجهة | الفلترة | الملف |
|---------|---------|-------|
| **ProductionPlanRequirementsView** | ✅ `get_user_scope` + فحص `branch_id in scope["branch_ids"]` | inventory/views.py:67 |
| **StockTransferCreateView** | ✅ فحص `from_branch_id in scope["branch_ids"]` | inventory/views.py:543 |
| **TransferConfirmView** | ✅ فحص `to_branch_id in scope["branch_ids"]` | inventory/views.py:627 |
| **TransferRejectView** | ✅ فحص `to_branch_id in scope["branch_ids"]` | inventory/views.py:656 |
| **StockTransferListView** | ✅ `qs.filter(from_branch_id__in=scope) | to_branch_id__in=scope` | inventory/views.py:477-480 |
| **OwnerDashboardSummaryView** | ✅ `_apply_branch_scope(request, branch_qs)` | analytics/views.py:137 |
| **ProfitSummaryView** | ❌ **لا يُطبَّق** | inventory/views.py:279 |

**ثغرة:** `ProfitSummaryView` يستخدم `AllowAny` ولا يستدعي `_apply_branch_scope`. مدير فرع يمكنه إرسال `branch_ids=1,2,3,4,5` والحصول على بيانات الربح لفروع أخرى.

**التوصية:** إضافة `_apply_branch_scope` أو ما يعادلها لـ `ProfitSummaryView` لتصفية `branch_qs` حسب صلاحيات المستخدم.

### 3.2 تأمين ملفات الرفع (CSV/Excel Injection)

| البند | الحالة | التفاصيل |
|-------|--------|----------|
| **فحص CSV Injection** | ❌ غير موجود | لا يوجد تنظيف لخلايا تبدأ بـ `=`, `+`, `-`, `@` |
| **فحص ملفات خبيثة** | ❌ غير موجود | لا فحص لـ Magic Bytes أو نوع الملف الحقيقي |
| **المعالجة** | pandas | `pd.read_excel`, `pd.read_csv` – تحميل كامل للملف |

**مخاطر CSV Injection:** خلايا مثل `=cmd|'/c calc'!A1` يمكن أن تُنفَّذ في Excel عند فتح الملف المُصدَّر. يلزم تنظيف القيم أو تحويلها إلى نص آمن قبل التصدير/العرض.

---

## 4. استقرار النظام تحت الضغط (Scalability & Concurrency)

### 4.1 قفل الجداول ومنع التعارض (Deadlock)

| العملية | ترتيب القفل | الملف |
|---------|-------------|-------|
| **process_transfer_departure** | `from_branch` → `in_transit` (لكل مكوّن) | transfer_services.py:66, 78 |
| **confirm_transfer** | `in_transit` → `to_branch` | transfer_services.py:112, 124 |
| **reject_transfer** | `in_transit` → `from_branch` | (عكس الحركة) |

**ترتيب ثابت:** `from_branch < in_transit < to_branch`. عند تحويل A→B و B→A في نفس الوقت، كلا الطلبين يلتزمان بهذا الترتيب؛ لا تحدث حلقة انتظار (cycle) وبالتالي لا deadlock.

### 4.2 إدارة الذاكرة وملفات الرفع

| البند | الحالة | التفاصيل |
|-------|--------|----------|
| **ملفات Excel المُرفوعة** | ⚠️ تُحفظ | تُخزَّن في `FileField` (media) ولا تُحذف تلقائياً |
| **معالجة بالخلفية** | ✅ | product_sales الكبيرة تُعالَج في thread مع `progress_pct` |
| **تنظيف مؤقتات** | ❌ غير مؤكد | لا يوجد آلية واضحة لمسح ملفات قديمة أو مؤقتة |
| **Disk Bloat** | ⚠️ مخاطرة | رفع ملفات كبيرة ومتكررة قد يملأ القرص بمرور الوقت |

**التوصية:** إضافة مهمة دورية لحذف ملفات الرفع الأقدم من X شهر، أو نقلها إلى تخزين بارد (S3، إلخ).

---

## 5. التوثيق الذاتي والتعافي (Self-Healing & Logs)

### 5.1 وضوح سجل الأخطاء (SystemErrorLog)

| الحقل | الغرض |
|-------|-------|
| `error_type` | depletion_failed, upload_failed, transfer_failed, other |
| `message` | نص الخطأ (حتى 4000 حرف) |
| `traceback` | تتبع الاستثناء (حتى 8000 حرف) |
| `context` | JSON: `branch_id`, `ingredient_id`, `upload_id`, `on_hand_before`, `qty_depleted`, `transfer_id`, `from_branch_id`, `to_branch_id` |
| `user` | المستخدم عند حدوث الخطأ |

**أمثلة من الكود:**
```python
# depletion_services.py:121
context={"branch_id": branch_id, "ingredient_id": req.ingredient_id, "on_hand_before": str(stock.on_hand), "qty_depleted": str(qty_deplete), "upload_id": getattr(upload, "id", None)}

# imports/views.py:31
context={"filename": filename, "upload_id": upload_id}

# inventory/views.py:598
context={"from_branch_id": from_branch_id, "to_branch_id": to_branch_id}
```

**النتيجة:** السجل كافٍ لإعادة تمثيل الخطأ (Replicate) باستخدام الـ context و traceback.

### 5.2 تنبيهات الانحراف ونبض المهام (Heartbeat)

| البند | الحالة | التفاصيل |
|-------|--------|----------|
| **Cafe Heartbeat** | ✅ موجود | `analytics/heartbeat_services.py` – مبيعات، burn rate، waste |
| **مراقبة المهام الخلفية** | ❌ غير موجود | لا يوجد heartbeat يتحقق من عمل التنبيهات التلقائية |
| **مراقبة run_daily_reconciliation** | ❌ | لا آلية للتأكد من تنفيذ الأمر بشكل دوري |
| **مراقبة notify_stale_transfers** | ❌ | نفس الأمر |

**التوصية:** إضافة جدول أو سجل "آخر تشغيل" للمهام الحرجة (مثل reconciliation، التنبيهات)، واستخدام Cron أو Celery Beat لتسجيل تشغيلها، مع تنبيه لسيف عند توقف المهمة لأكثر من X ساعة.

---

## ملخص التوصيات ذات الأولوية

| الأولوية | التوصية |
|----------|----------|
| **عالية** | إصلاح ثغرة تصعيد الصلاحيات في `ProfitSummaryView` بإضافة `_apply_branch_scope` |
| **عالية** | إضافة تنظيف خلايا Excel/CSV من صيغ تبدأ بـ `=`, `+`, `-`, `@` (CSV Injection) |
| **متوسطة** | إضافة سياسة حذف أو أرشفة ملفات الرفع القديمة لتجنب امتلاء القرص |
| **متوسطة** | إدراج UUIDs للكيانات الحساسة (Branch, Ingredient) في الواجهات العامة |
| **منخفضة** | إضافة نظام heartbeat لمهام الخلفية (reconciliation، التنبيهات) |

---

*تقرير التدقيق النهائي – Smart Operations Hub – فبراير 2026*
