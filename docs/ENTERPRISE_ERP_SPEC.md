# مواصفات منصة Enterprise ERP الشاملة

## الهيكل العام (Single Source of Truth)

```
Organization → Brand → Branch
       ↓           ↓        ↓
   Chart of Accounts | SystemErrorLog | Tenant Isolation
```

---

# 1. منظومة الكاشير المتكاملة (Omni-Channel POS)

## 1.1 واجهة البيع الذكية
- **Layout:** iPad Portrait/Landscape مع شبكة منتجات (Grid)
- **Categories:** شريط جانبي/علوي - فلترة فورية
- **Touch targets:** حد أدنى 44px
- **التصميم:** مطابق لفودكس (خلفية داكنة، لون أخضر)

## 1.2 محرك الخيارات (Modifiers)
| الحقل | الربط |
|-------|-------|
| Modifier.ingredient | خصم مخزني عند اختيار الإضافة (مثل حليب إضافي) |
| Modifier.price_add | تكلفة إضافية للعميل |
| ModifierGroup.modifier_type | إضافة | درجة حرارة | نوع حليب |
| ProductModifierOption | ربط المنتج بمجموعات الخيارات |

**تدفق:** اختيار منتج → نافذة Modifiers → اختيار (حليب، حرارة، سكر) → كل إضافة تخصم من المخزون وتضاف للسعر

## 1.3 العمل أوفلاين
- **IndexedDB** للفواتير المحفوظة
- **Queue:** عند العودة للمزامنة → POST /pos/sync-offline/
- **Conflict resolution:** Timestamp + Sale number

## 1.4 تعدد طرق الدفع
- **SplitPayment:** فاتورة واحدة، دفعات متعددة (كاش 50، شبكة 30)
- **PaymentTerminal:** حقل terminal_reference لربط أجهزة الشبكة لاحقاً

---

# 2. نظام الموارد البشرية والرواتب (HRMS)

## 2.1 إدارة الموظفين
| النموذج | الحقول |
|---------|--------|
| Employee | عقد، هوية، تأمين طبي، تاريخ مهني (JSON) |
| EmployeeDocument | مرفقات (عقد، هوية) |
| EmployeeCareerHistory | سجل الوظائف السابقة |

## 2.2 الحضور والانصراف الذكي
- **AttendanceRecord.source:** pos | biometric | manual
- **AttendanceRecord.clock_in_location:** (lat, lng) من Geo-fencing
- **Branch.geo_fence:** polygon أو (lat, lng, radius_m) للتحقق من الموقع

## 2.3 محرك الرواتب
- **PayrollCalculation:** راتب أساسي + بدلات - غياب - جزاءات - سلف
- **JournalEntry:** عند ترحيل الرواتب → من ح/مصروف رواتب إلى ح/موردين (موظفون)

## 2.4 بوابة الخدمة الذاتية
- **API:** /hr/self-service/leaves, advances, payslips
- **صلاحيات:** الموظف يرى بياناته فقط

---

# 3. نظام إدارة الولاء والعملاء (CRM)

## 3.1 الهوية الرقمية
| الحقل | الوصف |
|------|-------|
| Customer.tier | gold | silver | bronze | standard |
| Customer.total_spent | إجمالي الصرف (يُحدّث من المبيعات) |
| Customer.preferences | JSON: مشروبات مفضلة، حساسية |

## 3.2 محرك النقاط والعروض
| النوع | مثال |
|-------|------|
| points_per_sar | 1 نقطة لكل 10 ر.س |
| buy_x_get_y | اشترِ 5 واحصل على 1 مجاناً |
| birthday_offer | عرض عيد ميلاد |

## 3.3 المحفظة الإلكترونية
- **WalletTransaction.txn_type:** topup | spend
- **ربط محاسبي:** عند الشحن → من ح/نقدية إلى ح/التزامات (محافظ العملاء)

---

# 4. المطبخ المركزي والتصنيع

## 4.1 أوامر التصنيع
- **ProductionOrder.total_cost:** مجموع تكلفة المواد الخام
- **ProductionOrder.output_cost_per_unit:** للتسعير الداخلي
- **ربط مخزون:** استهلاك مواد خام → إنتاج منتج وسيط (Ingredient.linked_product)

## 4.2 طلبات الفروع (Internal Indent)
- **Indent → DeliveryNote:** عند الموافقة يُصدر إذن خروج
- **StockTransfer:** ربط بمخزون قيد النقل (in_transit)
- **إذن استلام:** تأكيد الاستلام عند الوصول

---

# 5. المشتريات والموردين

## 5.1 إدارة الموردين
- **Supplier.credit_days:** فترة الائتمان (أيام)
- **Supplier.payment_terms:** نقدي | 30 يوم | 60 يوم

## 5.2 دورة المشتريات
طلب شراء → تعميد/أمر شراء → استلام → فاتورة شراء (موجود)

## 5.3 إعادة الطلب التلقائي
- **AutoReorderRule.consumption_based:** استخدام متوسط الاستهلاك الأخير
- **معدل الاستهلاك:** من StockMovement (نوع depletion) آخر 30 يوم

---

# 6. إدارة الأصول والصيانة (EAM)

## 6.1 سجل الأصول
- **Asset:** تاريخ شراء، ضمان، قيمة (موجود)
- **AssetWarranty:** تاريخ انتهاء الضمان

## 6.2 الإهلاك
- **AssetDepreciation:** شهري تلقائي (موجود)

## 6.3 إدارة الصيانة
- **MaintenanceSchedule:** كل X وحدة (مثلاً 1000 كوب) أو كل X يوم
- **MaintenanceTask:** مهمة صيانة - حالة (مجدول | منفذ | مؤجل)
- **تنبيه للفني:** AdminNotification عند استحقاق الصيانة

---

# 7. الجودة والتفتيش

## 7.1 نماذج التفتيش
- **BranchVisitItem.photo:** دعم الصور (موجود)
- **ChecklistTemplate:** قوالب قابلة لإعادة الاستخدام

## 7.2 تقييم الأداء
- **BranchQualityScore:** فرع، شهر، درجة (0-100)
- **ربط بالحوافز:** EmployeeIncentive.quality_factor

---

# 8. لوحة التحكم والذكاء الاصطناعي

## 8.1 تقارير الربحية
صافي المبيعات - تكلفة المواد - الرواتب - الإيجار - الكهرباء - الإهلاك = الربح الصافي الفعلي

## 8.2 التنبؤ بالطلب
- **DemandForecast:** صنف، فرع، أسبوع، كمية متوقعة
- **المدخلات:** ProductSale تاريخي، موسمية، الطقس (اختياري)

## 8.3 مركز المراقبة
- **API:** /bi/control-center/ → مبيعات لحظية، حالة الفروع، تنبيهات
- **WebSocket** (اختياري) للبث المباشر
