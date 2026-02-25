# تقرير المراجعة الفنية الشاملة – Smart Operations Hub

**التاريخ:** 20 فبراير 2025  
**النطاق:** نظام محاسبي، مخزون، ومبيعات متكامل

---

## 1. هيكلة قاعدة البيانات (Database Schema)

### 1.1 العلاقات بين الجداول وتماسك البيانات (Data Integrity)

#### نقاط القوة:
- **Foreign Keys مع `on_delete=PROTECT`** في معظم الجداول (Branch, Brand, Ingredient) تمنع الحذف العشوائي وتعزز التكامل المرجعي.
- **قيود فريدة معقولة:**
  - `FoodicsSettlement`: `unique_together = [branch, report_date]`
  - `BranchStock`: `UniqueConstraint(branch, ingredient)`
  - `WasteLog`: `UniqueConstraint(ingredient, date)`
  - `RecipeLine`: `UniqueConstraint(recipe, ingredient)`
- **Indexes** على الأعمدة المستخدمة كثيراً في الاستعلامات (branch, date, brand, product_sku).

#### نقاط الضعف الحرجة:

| المشكلة | التفاصيل | التأثير |
|---------|----------|---------|
| **تكرار بيانات المبيعات** | `DailySale` و `ProductSale` مرتبطان بـ `ExcelUpload` فقط. لا يوجد `unique_together` على (branch, date) بعد إزالة القيد في migration 0002. رفع نفس التقرير مرتين ينشئ صفوفاً مكررة. | عند استخدام `Sum()` يتم جمع جميع الصفوف → **مضاعفة المبيعات بشكل خاطئ**. |
| **ProductSale مكرر** | نفس product_sku + branch + date يمكن أن يكون له عدة صفوف من رفوع مختلفة. | التقارير، التحضير، والأرباح تعطي أرقاماً مبالغاً فيها. |
| **WasteLog بدون branch** | القيد `uniq_waste_log_ingredient_date` يشمل ingredient + date فقط. النظام متعدد الفروع ولكن الهدر مسجَّل بشكل عام. | لا يمكن تتبع الهدر لكل فرع على حدة. |

#### التوصيات الفورية:
1. **استعادة أو إعادة تعريف قيد عدم التكرار:**
   - إما `unique_together = [("branch", "date")]` لـ `DailySale` مع آلية دمج/استبدال عند الرفع المكرر.
   - أو جدول `DailySaleSnapshot` يمثل «النسخة النهائية» لكل branch/date، والـ ETL يحدثه بدلاً من الإضافة.
2. **لـ ProductSale:** اختيار استراتيجية (مثلاً: آخر رفع يفوز، أو دمج حسب upload_id) وتطبيق قيد أو منطق منطقي.
3. **لـ WasteLog:** إضافة حقل `branch` وتعديل `UniqueConstraint` إلى `(ingredient, date, branch)` لدعم عدة فروع.

---

### 1.2 قابلية التوسع (Scalability) – 100 فرع

#### التحليل:
- **Branch** مرتبط بـ Brand, City, District, BranchType – العلاقات سليمة.
- **Indexes موجودة** على `branch_id`, `date`, `brand_id` في جداول المبيعات والإقفالات.
- **استعلامات الـ Dashboard** تجري `filter(branch_id__in=branch_ids)` ثم `aggregate(Sum(...))` – مع الفهرس صحيح.

#### نقاط القلق:
| البند | الوضع | التوصية |
|-------|-------|---------|
| **N+1 Queries** | بعض الـ views تستخدم `select_related` و `prefetch_related` بشكل جيد، لكن ليست كل الاستعلامات محسَّنة. | مراجعة كل View مع أكثر من 3 جداول. |
| **تحميل JSON كبير** | لوحة التحكم تُرجع بيانات كثيرة دفعة واحدة (by_brand, alerts, financial_summary، إلخ). | تقسيم الـ API إلى endpoints أصغر أو lazy-load للرسوم. |
| **Session/CSRF** | جلسات Django الافتراضية قد تصبح عبئاً مع عدد كبير من المستخدمين المتزامنين. | التفكير في Redis للـ session store عند النمو. |
| **ملفات Excel** | `ExcelUpload.file` يُخزَّن محلياً. مع 100 فرع ورفعات يومية، التخزين ينمو بسرعة. | S3 أو Object Storage خارجي + سياسة أرشفة. |

**الخلاصة:** الهيكل الحالي يتحمل توسعاً معقولاً حتى ~50–100 فرع، مع مراعاة التوصيات أعلاه.

---

## 2. النظام المحاسبي (Accounting Core)

### 2.1 القيود المحاسبية الآلية عند إقفال الورديات

**الموقع:** `backend/shifts/report_services.py` – `get_journal_entry_report()`

#### الآلية الحالية:
- القيود **تُحسب وتُعرض فقط** (report)، ولا تُخزَّن في جدول `JournalEntry` أو ما شابه.
- يتم اشتقاقها من `ShiftClosing`: نقد، شبكة، توصيل، مصروفات.
- الحسابات المستخدمة **نصوص ثابتة** (hardcoded):
  - صندوق فرعي، بنك - بطاقات، بنك - توصيل، إيرادات المبيعات، مصروفات تشغيلية.

#### المشاكل:
| المشكلة | التفاصيل |
|---------|----------|
| **عدم الربط بدليل الحسابات** | الحسابات مثل "صندوق فرعي" و "إيرادات المبيعات" غير مربوطة بـ `ChartAccount`. لو تغير كود الحساب في الشجرة، التقرير يبقى يعرض النص الثابت. |
| **لا يوجد قيد فعلي في قاعدة البيانات** | القيود لا تُسجَّل في جدول `JournalEntry`. لا أثر محاسبي دائم. |
| **لا ميزان مراجعة** | لا يوجد نموذج `JournalEntry` مع debit/credit يمكن التحقق من توازنه. |

### 2.2 دعم القيد المزدوج (Double-Entry)

- **ManualAdjustment** يطبق القيد المزدوج: `entry_type` (debit/credit)، `balance_before`، `balance_after`، وربط واضح بـ `ChartAccount`.
- **القيود التلقائية من إقفال الورديات** لا تطبق القيد المزدوج في قاعدة البيانات؛ التقرير يعرض صفوفاً بصيغة قيد لكنها غير مخزَّنة.
- **ChartAccount.balance** يُحدَّث من الرفع اليدوي والتسويات، وليس من إقفال الورديات.

#### التوصيات:
1. إنشاء نموذج `JournalEntry` و `JournalEntryLine` (حساب، مدين، دائن، مرجع للـ ShiftClosing).
2. عند اعتماد (submit) الـ ShiftClosing، توليد قيود تلقائية وحفظها في قاعدة البيانات.
3. ربط أسماء الحسابات في `get_journal_entry_report` بأكواد من `ChartAccount` (مثلاً باستخدام `chart_rev_prefix` للعلامة).
4. إضافة فحص توازن (debit = credit) عند الحفظ مع رفع استثناء إذا لم يتوازن.

---

## 3. نظام المخزون (Inventory & Supply Chain)

### 3.1 خصم الكميات عند البيع

**الوضع الحالي:** لا يوجد خصم تلقائي للمخزون عند البيع.

- `ProductSale` يسجل المبيعات فقط (من رفع Excel).
- `StockMovement` يدعم `DEPLETION` لكن **لا يوجد مكان في الكود ينشئ** `StockMovement` من نوع depletion عند معالجة المبيعات.
- `BranchStock.on_hand` يُحدَّث يدوياً (شراء، تعديل) وليس من المبيعات.

#### العواقب:
- المخزون لا ينعكس تلقائياً مع المبيعات.
- Prep List يعتمد على `BranchStock.on_hand` و `ProductSale` للطلب المتوقع، بدون خصم فعلي عند البيع.
- **لا يوجد نظام real-time** لمنع البيع عند نفاذ الكمية؛ البيع يُسجَّل من Excel بعد وقوعه.

#### التوصيات:
1. **عند معالجة Product Sales (ETL):** بعد تحميل `ProductSale`، تفجير الوصفات (recipes) وحساب المكونات المطلوبة، ثم إنشاء `StockMovement` من نوع depletion لكل ingredient وبranch، وتحديث `BranchStock.on_hand`.
2. **في حالة التكامل المباشر مع Foodics/POS:** إذا أُضيفت واجهة لاستقبال الطلبات فورية، تطبيق خصم فوري مع التحقق من `on_hand` قبل تأكيد البيع (مع التعامل مع التوصيلات والتأخير إن وجد).
3. **للوضع الحالي (Excel فقط):** على الأقل توليد `StockMovement` (depletion) عند كل رفع Product Sales ليكون لديك أثر حركة، حتى لو تأخر عن وقت البيع الفعلي.

---

### 3.2 التحويل بين الفروع (Inter-Branch Transfer)

**الوضع:** لا يوجد نموذج أو منطق لتحويل المخزون بين الفروع.

- `StockMovement` له: purchase, adjustment, depletion فقط – لا يوجد `TRANSFER`.
- لا توجد جداول مثل `TransferOrder` أو `TransferLine`.

#### التوصية:
1. إضافة نوع `TRANSFER` في `StockMovementType`.
2. إنشاء نموذج `StockTransfer` (من فرع، إلى فرع، تاريخ، حالة) مع `StockTransferLine` (ingredient، كمية).
3. عند تأكيد التحويل: إنشاء `StockMovement(depletion)` للفرع المصدر و`StockMovement(purchase)` للفرع المستلم، وتحديث `BranchStock` لكلا الفرعين.
4. ربط التحويل محاسبياً (خروج من مخزون فرع، دخول لمخزون فرع آخر) إذا تم تطبيق القيود التلقائية على المخزون.

---

## 4. التكامل والربط (Integration & API)

### 4.1 أخطاء "Failed to fetch" وجودة الـ API

#### الأسباب المحتملة لـ Failed to fetch:
| السبب | التفاصيل |
|-------|----------|
| **CORS** | الـ backend يخدّم من منفذ مختلف. في dev يُستخدم Vite proxy (`/api` → backend) مما يقلل المشكلة. في الإنتاج يجب التأكد من CORS الصحيح. |
| **شبكة غير مستقرة** | ZeroTier أو شبكة خاصة – انقطاع يؤدي لـ fetch failure. |
| **Timeout** | لا يوجد timeout صريح في معظم استدعاءات `fetch`. الطلبات الثقيلة (تقرير كبير) قد تعلق. |
| **CSRF** | إذا انتهت صلاحية الجلسة أو فشل CSRF، الاستجابة 403 ولا يصل للواجهة رسالة واضحة. |
| **دوران الخادم** | إعادة تشغيل Django أثناء طلب يؤدي لفقدان الاتصال. |

#### معالجة الأخطاء في الواجهة:
- **api.ts:** معظم الدوال ترمي `throw new Error(...)` عند `!res.ok` أو عند فشل `res.json()`.
- **لا يوجد:**
  - طبقة موحَّدة (interceptor) للتعامل مع أخطاء الشبكة (NetworkError, TypeError من fetch).
  - إعادة محاولة (retry) للطلبات الفاشلة.
  - تمييز بين أخطاء 401 (تنتهي الجلسة) و 500 (خلل في الخادم) و network error.
- **المكوّنات:** تستخدم `try/catch` و `setError` أحياناً، لكن لا يوجد Error Boundary على مستوى التطبيق – خطأ غير مُعالج قد يعطّل الصفحة بالكامل.

#### التوصيات:
1. **في api.ts:**
   - التعرف على `Failed to fetch` و `NetworkError` وتقديم رسالة عربية واضحة ("تحقق من الاتصال بالشبكة").
   - إضافة timeout و retry (مثلاً 2 محاولات) للطلبات الحرجة.
   - فصل 401 في دالة مشتركة وتوجيه المستخدم لتسجيل الدخول مجدداً.
2. **في Backend:**
   - تحسين رسائل الخطأ (مثلاً `{"detail": "..."}` بتفاصيل مفهومة).
   - إضافة health check endpoint سريع (`/api/health/`) للتحقق من صلاحية الاتصال.
3. **في React:**
   - استخدام `ErrorBoundary` حول المسارات الرئيسية لتفادي تعطيل الواجهة وتقديم زر إعادة تحميل أو العودة للوحة التحكم.

---

### 4.2 الربط بين لوحة المالك ومدخلات الفروع

- **المصادر:** DailySale (Excel)، ShiftClosing (إدخال الفروع)، FoodicsPaymentRecord (مرجع).
- **التوفيق:** `accounting/services.py` – `get_daily_reconciliation()` يدمج المصادر بشكل صحيح.
- **التسلسل:** رفع Excel → DailySale؛ إدخال الإقفال → ShiftClosing؛ المطابقة تتم عبر branch + date.
- **استقرار الربط:** يعتمد على تطابق `branch_id` و `branch_code` بين Excel والفرع في النظام. توجد fallbacks (branch_code, branch name) في بعض الـ views لمعالجة عدم التطابق.
- **نقطة ضعف:** إذا كان Excel يستخدم معرف فرع مختلف عن `branch_id` أو `branch_code`، قد لا تُربط البيانات بشكل صحيح.

**التوصية:** توثيق دليل الربط (Excel branch code ↔ Branch.branch_code) وتفعيل تحذير عند رفع ملف لا يتطابق فيه أي فرع.

---

## 5. تجربة المستخدم والأمان (UX & Security)

### 5.1 نظام الصلاحيات (RBAC)

**الموقع:** `backend/core/permissions.py`, `org/models.py` (RolePermissionConfig, ROLE_PERMISSION_DEFAULTS)

#### الأدوار:
- **SAIF (سيف):** حساب خاص بـ `username == "SAIF"` – صلاحيات كاملة.
- **Owner, General Manager, Brand Manager, Branch Supervisor, External Accountant:** صلاحيات قابلة للتعديل عبر `RolePermissionConfig`.

#### نقاط القوة:
- فصل واضح بين المالك (SAIF) وغيره.
- `RoleScopedPermission` يطبّق فلترة على مستوى الـ object (brand_ids, branch_ids).
- `can_delete_chart_or_users` محصور في سيف فقط.

#### نقاط الضعف:
| المشكلة | التفاصيل |
|---------|----------|
| **التحقق من الصلاحيات في الـ Frontend** | `RoutePermissionGuard` و `user?.permissions` يخفيان أزراراً أو مسارات، لكن الـ Backend هو المرجع الوحيد. أي خلل في المزامنة قد يعرض بيانات للمستخدم دون صلاحية. | **ضرورة:** التحقق من الصلاحية في كل View/Serializer. |
| **صلاحيات الـ API غير متسقة** | بعض الـ views تستخدم `IsAuthenticated` فقط، والبعض يستخدم `RoleScopedPermission` أو `IsAuthenticatedWithRole`. | مراجعة كل endpoint والتأكد من تطبيق الصلاحية المناسبة. |
| **صلاحية financial_auditor** | `has_financial_auditor_access` تسمح بعرض الإقفالات؛ يجب التأكد أن المراجع لا يستطيع تعديل أو حذف إقفالات. | التحقق من أن كتابة الإقفال محصورة بالموظفين المصرّح لهم. |

**التوصية:** تنفيذ جدول (audit matrix) يربط كل endpoint بالصلاحية المطلوبة وإجراء فحص شامل للـ views.

---

### 5.2 الواجهة على iPad والمتصفحات

- **الشريط السفلي للموبايل:** موجود ويحتوي أزراراً أساسية.
- **زر تسجيل الخروج:** في `AppShellLayout` – على الشاشات الصغيرة (`lg:hidden`) موجود داخل قائمة المستخدم المنسدلة (userMenuRef) مع الاسم.
- **دعم اللمس:** بعض الصفحات (مثل FinancialAuditorPage) تضيف `touch-manipulation` و `min-h-[44px]` للأزرار.
- **RTL:** مدعوم عبر `dir={isRTL ? "rtl" : "ltr"}`.

#### نقاط للمراجعة:
- التأكد أن القائمة المنسدلة للمستخدم تفتح بشكل سليم على Safari/iPad (قد تظهر مشاكل في الـ z-index أو الـ Portal).
- التحقق من ظهور زر تسجيل الخروج في كل الأوضاع (سطح المكتب، جوال، iPad).
- مراجعة الصفحات الثقيلة (مثل التقارير الكبيرة) على أجهزة محدودة الذاكرة.

---

## 6. التقرير الفني – قائمة الأخطاء المحتملة ونقاط الضعف

### أخطاء حرجة (P0)

| # | الوصف | الملف / المنطقة | الخطوة البرمجية المقترحة |
|---|-------|-----------------|---------------------------|
| 1 | تكرار DailySale و ProductSale عند رفع نفس التقرير مرتين يؤدي لمضاعفة الأرقام | imports/models.py, analytics views | إعادة `unique_together` أو آلية upsert؛ أو جدول snapshot نهائي لكل branch/date. |
| 2 | لا يوجد خصم مخزون تلقائي من المبيعات | inventory (بدون مكان لـ StockMovement depletion من البيع) | في ETL الـ Product Sales، تفجير الوصفات وإنشاء StockMovement(depletion) وتحديث BranchStock. |
| 3 | القيود المحاسبية من إقفال الورديات غير مخزَّنة وليست مربوطة بدليل الحسابات | shifts/report_services.py | إنشاء JournalEntry/JournalEntryLine، ربط بالـ ChartAccount، وتوليد القيود عند submit الإقفال. |
| 4 | WasteLog بدون branch – لا يدعم تتبع الهدر لكل فرع | inventory/models.py | إضافة حقل branch و تعديل UniqueConstraint. |
| 5 | لا يوجد Error Boundary – خطأ غير مُعالج يعطّل الصفحة | App.tsx, layouts | إحاطة المسارات الرئيسية بـ ErrorBoundary مع رسالة تعبئة وزر إعادة تحميل. |

### أخطاء متوسطة (P1)

| # | الوصف | الخطوة البرمجية المقترحة |
|---|-------|---------------------------|
| 6 | أخطاء "Failed to fetch" تظهر كـ "Failed" دون تمييز | api.ts | التعرف على network errors ورسائل 401/500 وتقديم رسائل واضحة للمستخدم. |
| 7 | لا توجد إعادة محاولة للطلبات الفاشلة | api.ts | إضافة retry (2–3 محاولات) مع exponential backoff للطلبات الحرجة. |
| 8 | لا يوجد تحويل بين الفروع (Inter-branch transfer) | inventory | إضافة StockTransfer و StockMovement(TRANSFER). |
| 9 | حسابات القيود التلقائية hardcoded وليست مربوطة بـ ChartAccount | report_services.py | ربط بأكواد ChartAccount أو بجدول mapping. |
| 10 | صلاحيات بعض الـ API endpoints غير متسقة | backend views | مراجعة وتوحيد استخدام Permission classes. |
| 11 | ProductSale.product_sku قد يكون فارغاً – ربط الوصفات يفشل | profit_services.py, inventory/services.py | استكمال الربط بـ product_name إذا كان product_sku فارغاً، مع تسجيل تحذير. |
| 12 | توقيت الـ API (timeout) غير محدد – طلبات ثقيلة قد تعلق | api.ts | تحديد timeout (مثلاً 30 ثانية) واستثناء مفهوم عند انتهائه. |

### أخطاء منخفضة (P2)

| # | الوصف | الخطوة البرمجية المقترحة |
|---|-------|---------------------------|
| 13 | N+1 queries محتملة في بعض التقارير | analytics, financials views | إضافة select_related/prefetch_related واستخدام query profiling. |
| 14 | تخزين ملفات Excel محلياً – صعوبة التوسع | settings, ExcelUpload | تكوين تخزين الملفات على S3 أو نظام تخزين خارجي. |
| 15 | Session store افتراضي – قد لا يناسب بيئة multi-worker | settings | استخدام Redis للـ session عند زيادة التحميل. |
| 16 | Health check بسيط أو غير موجود | config/urls | إضافة `/api/health/` يعيد 200 عند جاهزية النظام. |
| 17 | Branch/Excel mapping غير موثّق – أخطاء ربط صامتة | docs, upload flow | توثيق وتفعيل تحذيرات عند عدم تطابق الفرع. |
| 18 | عدم وضوح رسائل الخطأ للمستخدم النهائي (عربية) | api.ts, frontend | توحيد رسائل الخطأ وترجمتها في i18n. |

---

## 7. خارطة طريق لاستقرار 100%

### المرحلة 1 – أسبوعان (أساسي)

1. إصلاح تكرار DailySale/ProductSale (P0-1).
2. إضافة Error Boundary ورسائل واضحة للأخطاء (P0-5, P1-6).
3. توحيد معالجة أخطاء الـ API (P1-6, P1-7).
4. مراجعة صلاحيات الـ API الحرجة (P1-10).

### المرحلة 2 – 3–4 أسابيع (محاسبة ومخزون)

5. خصم المخزون التلقائي من المبيعات (P0-2).
6. نموذج JournalEntry وتوليد القيود من إقفال الورديات (P0-3).
7. ربط القيود بدليل الحسابات (P1-9).
8. إضافة branch لـ WasteLog (P0-4).

### المرحلة 3 – 4–6 أسابيع (توسع وجودة)

9. التحويل بين الفروع (P1-8).
10. تحسين الاستعلامات (P2-13) وضبط الـ indexes.
11. تكوين التخزين الخارجي للوثائق (P2-14).
12. توثيق الربط بين Excel والفرع (P2-17).
13. Health check ومراقبة الأداء (P2-15, P2-16).

### اختبارات موصى بها

- **Unit tests** لوظائف التوفيق (reconciliation) وحساب الربح.
- **Integration tests** لـ ETL الـ Excel (تحميل مكرر، تعدد فروع).
- **Load test** مع ~100 فرع واستعلامات لوحة التحكم.
- **Security audit** للصلاحيات ونقاط التعرض في الـ API.

---

*تم إعداد هذا التقرير بناءً على مراجعة الكود المصدري في فبراير 2025.*
