# ملخص جلسة البرمجة – Smart Operations Hub

**التاريخ:** 11 فبراير 2025  
**الحالة:** جاهز للمتابعة لاحقاً

---

## ما تم تنفيذه في هذه الجلسة

### 1️⃣ تحسينات Excel Parser
- **مطابقة الأعمدة الصارمة:** يجمع الأرقام فقط من أعمدة محددة (المبلغ، Amount، المبيعات، المصاريف، رصيد، balance)
- **تجاهل أعمدة ID/IBAN:** استبعاد أرقام الهوية، رقم القيد، آيبان
- **دليل رفع الملفات:** نموذج للأعمدة المطلوبة في صفحة الرفع
- **التنبيه عند عدم التطابق:** رسالة واضحة عند رفع ملف بأعمدة غير معروفة
- **Trim على أسماء الأعمدة:** إزالة المسافات الزائدة

**الملفات:** `frontend/src/lib/excelParser.ts`, `BalanceUploadPage.tsx`, `IncomeStatementPage.tsx`

---

### 2️⃣ مركز تدقيق التكاليف (Cost Audit Center)
- **جدول تفصيلي:** التاريخ، البند، الوصف، القيمة، المصدر، النوع
- **فلتر "إظهار المبالغ غير المنطقية":** ترتيب من الأعلى للأقل
- **فصل COGS عن المصاريف التشغيلية**
- **شريط بحث** مع سجل بحث سابق
- **زر استبعاد من الحساب** (SAIF فقط)

**المسار:** `/finance/cost-audit`  
**Backend:** `CostUpload`, `CostAuditEntry` في `accounting/models.py`

---

### 3️⃣ وحدة التسويات المحاسبية (Manual Adjustments)
- **واجهة إدخال القيد:** الحساب، المبلغ، مدين/دائن، سبب التسوية
- **التأثير اللحظي** على صافي الربح وميزان المراجعة
- **سجل التسويات** (لا يُحذف): التاريخ، قبل/بعد، من قام بها
- **SAIF فقط** – لا يرى المدير العام أو غيره

**المسار:** `/finance/manual-adjustments`  
**Backend:** `ManualAdjustment` في `accounting/models.py`

---

## الملفات المهمة المُعدَّلة

| المسار | الوظيفة |
|--------|----------|
| `backend/accounting/models.py` | CostUpload, CostAuditEntry, ManualAdjustment |
| `backend/accounting/views.py` | ChartAccountImportBalancesView (rows), CostAudit*, ManualAdjustment* |
| `backend/accounting/urls.py` | cost-audit, manual-adjustments |
| `frontend/src/lib/excelParser.ts` | Trim, allowed columns, excluded patterns, CostAuditRow |
| `frontend/src/lib/api.ts` | fetchCostAuditEntries, excludeCostAuditEntry, createManualAdjustment, fetchManualAdjustmentLog |
| `frontend/src/config/financialReports.ts` | FIN-011 (Cost Audit), FIN-012 (Manual Adjustments, saifOnly) |
| `frontend/src/pages/FinanceHubPage.tsx` | فلترة saifOnly حسب المستخدم |
| `frontend/src/pages/reports/CostAuditCenterPage.tsx` | صفحة مركز التدقيق |
| `frontend/src/pages/reports/ManualAdjustmentsPage.tsx` | صفحة التسويات اليدوية |

---

## Migrations المطبقة
- `accounting.0008_add_cost_audit` – CostUpload, CostAuditEntry
- `accounting.0009_add_manual_adjustment` – ManualAdjustment

---

## ملاحظات للمتابعة
- الرفع من الإكسل يرسل الآن `rows` + `source_file` لإنشاء سجل تدقيق تفصيلي
- التسويات اليدوية تُحدّث `ChartAccount.balance` فوراً
- حماية SAIF: Cost Audit exclude، Manual Adjustments، وبطاقة FIN-012 في المركز المالي
