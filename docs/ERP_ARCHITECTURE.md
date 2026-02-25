# بنية المنصة المؤسسية - Enterprise ERP Foundation

## النواة المركزية (Single Source of Truth)

تم بناء أساس متين لتحويل Smart Operations Hub إلى منصة ERP على مستوى المؤسسات.

---

## 1. Multi-Tenancy (تعدد الشركات)

**الهيكل:** `Organization → Brand → Branch`

- **Organization**: المؤسسة الأم - عزل كامل للبيانات
- **Brand**: العلامة التجارية (تابعة للمؤسسة)
- **Branch**: الفرع (تابع للعلامة)

**الملفات:**
- `backend/org/models.py` - نموذج Organization
- `backend/core/tenant_middleware.py` - تخزين الطلب والمؤسسة الحالية
- Migration `0024_create_default_organization` - إنشاء مؤسسة افتراضية وربط العلامات الحالية

**استخدام العزل:**
```python
from core.tenant_middleware import get_current_tenant_org
org_id = get_current_tenant_org()
# استخدم org_id لفلترة الاستعلامات
```

---

## 2. Procurement Hub (نظام المشتريات والموردين)

**السلسلة:** طلب شراء → أمر شراء → استلام بضاعة → فاتورة مورد

**النماذج:**
- `Supplier` - المورد
- `PurchaseRequest` / `PurchaseRequestLine` - طلب الشراء
- `PurchaseOrder` / `PurchaseOrderLine` - أمر الشراء
- `GoodsReceipt` / `GoodsReceiptLine` - استلام البضاعة
- `SupplierInvoice` - فاتورة المورد

**الربط المحاسبي (عند تأكيد الاستلام):**
- قيد: من ح/المخزون (مدين) إلى ح/الموردين (دائن)
- تحديث `BranchStock` و `StockMovement` تلقائياً

**الملفات:**
- `backend/procurement/models.py`
- `backend/procurement/services.py` - `confirm_goods_receipt()`

---

## 3. HR & Payroll Engine (الموارد البشرية والرواتب)

**النماذج:**
- `CostCenter` - مركز تكلفة (مرتبط بفرع)
- `Employee` - موظف
- `EmployeeContract` - عقد (راتب أساسي، بدل سكن، مواصلات)
- `PayrollRun` / `PayrollRunLine` - دفعة رواتب

**الربط المحاسبي:** قيد رواتب شهري مربوط بمراكز التكلفة (يُنفّذ عند الترحيل)

**الملفات:** `backend/hr/models.py`

---

## 4. Asset Management (إدارة الأصول)

**النماذج:**
- `Asset` - أصل (ماكينة، جهاز، سيارة)
- `AssetDepreciation` - سجل إهلاك شهري

**الإهلاك التلقائي:** الخط المستقيم - يُنشئ قيداً محاسبياً شهرياً

**الملفات:** `backend/assets/models.py`

---

## 5. Financial Consolidation (التوحيد المحاسبي)

**الميزانية الموحدة:** تجميع أرصدة الحسابات من جميع الفروع

**الـ API:**
```
GET /api/accounting/consolidated/?organization_id=1&as_of=2025-02-20
```

**يرجع:**
- `balance_sheet`: قائمة الحسابات مع الأرصدة
- `income_statement`: إيرادات، مصروفات، صافي الربح

**الملفات:** `backend/accounting/consolidation_services.py`

---

## 6. Enterprise Security & Audit Trail

### Audit Log (سجل تدقيق لا يُحذف)
- **EnterpriseAuditLog** - من غيّر ماذا؟ متى؟ من أي IP؟
- الحذف مُعطّل (`delete()` يرفع `NotImplementedError`)

### الإشارات (لتسجيل التغييرات):
- `backend/core/audit_signals.py` - ربط بـ `setup_audit_signals()` للنماذج الحساسة

### 2FA للمالك:
- `POST /api/auth/2fa/setup/` - تفعيل 2FA (QR + Secret)
- `POST /api/auth/2fa/verify/` - تأكيد الرمز بعد المسح
- `POST /api/auth/2fa/validate/` - التحقق من رمز عند الدخول
- `GET /api/auth/2fa/status/` - هل 2FA مفعّل؟

**الملفات:**
- `backend/org/models.py` - EnterpriseAuditLog
- `backend/core/two_factor_views.py`
- `backend/core/tenant_middleware.py`

---

## 7. Open API (الربط البرمجي العالمي)

**التوثيق:**
- Schema: `/api/openapi/schema/`
- Swagger UI: `/api/openapi/swagger/`
- ReDoc: `/api/openapi/redoc/`

**الاستخدام:** للتكامل مع بوابات الدفع، شركات التوصيل، أنظمة الضرائب

**الحزمة:** `drf-spectacular`

---

## ملخص التطبيقات الجديدة

| التطبيق       | المسار              | الوظيفة                         |
|---------------|---------------------|----------------------------------|
| procurement   | /api/procurement/   | المشتريات والموردين             |
| hr            | /api/hr/            | الموارد البشرية والرواتب        |
| assets        | /api/assets/        | إدارة الأصول والإهلاك           |

---

## الخطوات التالية المقترحة

1. **واجهات API كاملة** لـ Procurement, HR, Assets (Serializers + ViewSets)
2. **صفحات Frontend** للمشتريات، الموظفين، الأصول
3. **تفعيل Audit Signals** في `CoreConfig.ready()` بعد حل التبعيات الدائرية
4. **ربط تسجيل الدخول بـ 2FA** - عند دخول المالك، التحقق من OTP قبل الوصول للوحة التحكم
5. **تكامل مع بوابات الدفع** - نقاط نهاية موثقة في OpenAPI
