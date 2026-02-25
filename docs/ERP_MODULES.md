# الأنظمة المعيارية - Enterprise ERP

جميع الأنظمة مربوطة بـ:
- **شجرة الحسابات** (Chart of Accounts)
- **سجل الأخطاء المركزي** (SystemErrorLog)
- **النواة** (Organization → Brand → Branch)

---

## تفعيل/إطفاء الوحدات (Modular)

```python
# core.module_config
from org.models import ModuleConfig

# تفعيل وحدة عالمياً
ModuleConfig.objects.update_or_create(
    module_key="crm_loyalty", brand=None,
    defaults={"is_enabled": True}
)

# إطفاء وحدة لعلامة معينة
ModuleConfig.objects.update_or_create(
    module_key="central_kitchen", brand_id=1,
    defaults={"is_enabled": False}
)
```

**API:** `GET /api/system/modules/?brand_id=1` يرجع حالة كل وحدة.

---

## 1. CRM & الولاء (`crm`)

| النموذج | الوظيفة |
|---------|---------|
| Customer | ملف عميل - تصنيف tier (ذهبي/فضي/برونزي)، تفضيلات، إجمالي المشتريات |
| LoyaltyPointsTransaction | حركة نقاط (اكتساب/استبدال) |
| LoyaltyReward | مكافأة قابلة للاستبدال بنقاط |
| LoyaltyOffer | عروض (اشترِ X واحصل على Y) أو نقاط لكل ريال |
| WalletBalance | رصيد المحفظة المسبقة الدفع |
| WalletTransaction | شحن أو استهلاك المحفظة |

**الربط:** SaleTransaction (pos) ← نقاط ومحفظة. payment_method=wallet يدعم Split Bill.

---

## 2. المطبخ المركزي & MRP (`central_kitchen`)

| النموذج | الوظيفة |
|---------|---------|
| ProductionOrder | أمر إنتاج + total_cost (تكلفة الإنتاج) |
| InternalIndent → DeliveryNote | طلب فرع → مذكرة تسليم → StockTransfer |

---

## 2b. POS المتكامل (`pos`)

| النموذج/الميزة | الوظيفة |
|----------------|---------|
| ProductModifier | ربط بـ Ingredient + qty_per_use للخصم المخزني، modifier_type (addon/temp/milk) |
| SplitPayment | تقسيم الفاتورة (كاش + بطاقة + محفظة) |
| SaleTransaction | customer_id, terminal_reference |
| payment_method | cash, card, wallet |

**API إنشاء بيع:** يدعم `split_payments: [{amount, method, terminal_reference}]` وخصم modifiers من المخزون.

---

## 2c. إدارة الأصول (`assets`)

| النموذج | الوظيفة |
|---------|---------|
| MaintenanceSchedule | جدولة صيانة (by_usage: كل 1000 كوب، by_days: كل 30 يوم) |
| MaintenanceTask | مهمة صيانة مجدولة أو منجزة |

---

## 3. الموارد البشرية المتقدمة (`hr` - ممتد)

| النموذج | الوظيفة |
|---------|---------|
| Employee | امتداد: insurance_provider, career_history (JSON) |
| AttendanceRecord | حضور/انصراف - location_lat/lng, within_geo_fence |
| LeaveRequest | طلب إجازة - الخدمة الذاتية |
| SalaryAdvance | سلفة - تُخصم من قيد الرواتب |
| EmployeePenalty | جزاء - خصم من الراتب |

**Branch:** geo_fence_lat, geo_fence_lng, geo_fence_radius_m للتحقق من موقع الحضور.  
**محرك الرواتب:** `hr.payroll_services.calculate_payroll_run(brand_id, month, year)` - غياب، سلف، جزاءات.

---

## 4. المشتريات الإلكترونية (`procurement` - ممتد)

| النموذج | الوظيفة |
|---------|---------|
| Supplier | credit_days, payment_terms (فترة الائتمان) |
| SupplierPortalUser | بوابة الموردين - رفع فواتير ومتابعة مستحقات |
| AutoReorderRule | إعادة الطلب: نقطة ثابتة أو use_consumption + lookback_days |

**الأمر:** `python manage.py run_auto_reorder [--brand BRAND_ID]`  
مع use_consumption: يستخدم معدل depletion التاريخي للتنبؤ وإصدار طلب.

---

## 5. الجودة والتفتيش (`quality`)

| النموذج | الوظيفة |
|---------|---------|
| BranchQualityScore | درجة جودة شهرية للفرع (0-100) - للحوافز |
| AuditChecklist | قائمة فحص |
| BranchVisit | زيارة فرع - مع صور |
| IoTDevice, IoTReading, IoTAlert | حساسات وتنبيهات |

---

## 6. التقارير الذكية (`bi`)

**الخدمات:**
- `get_advanced_profit_report()` - الربحية المتقدمة (مواد خام، رواتب، إيجار، كهرباء، إهلاك)
- `forecast_sales_next_week()` - التنبؤ بالمبيعات
- `get_control_center_data()` - مركز المراقبة (مبيعات لحظية، حالة الفروع، تنبيهات)

**API:**
- `GET /api/bi/profit-report/?from_date=...&to_date=...`
- `GET /api/bi/forecast/?branch_id=...`
- `GET /api/bi/control-center/?brand_id=...` - مبيعات اليوم، آخر معاملات، تنبيهات IoT ورصيد سالب

---

## الخطوات التالية

1. واجهات API كاملة لكل وحدة (Serializers, ViewSets)
2. صفحات Frontend للوحدة
3. ربط POS بتسجيل الحضور (Attendance) عند تسجيل الدخول
4. ربط الولاء بمعاملات POS (نقاط ومحفظة)
5. تكامل IoT - استقبال قراءات من حسّاسات خارجية
