# ملخص الترقيات – رفع القيمة السوقية للمنصة

تم تنفيذ المهام الخمس التالية بدقة احترافية:

---

## 1. الهندسة العشرية المتقدمة (مكتمل مسبقاً)

- تطبيق `currencies` مع نماذج `Currency` و `ExchangeRate`
- `Decimal(20, 10)` في `config.constants`
- أمر: `python manage.py update_exchange_rates --from USD --to SAR --rate 3.75 --create-currencies`

---

## 2. نظام الصلاحيات المجهرية ✅

### صلاحيات جديدة

| المفتاح | الوصف |
|--------|-------|
| `view_cost_price` | عرض سعر التكلفة والربح |
| `cancel_invoice` | إلغاء الفاتورة |
| `view_customer_phone` | عرض رقم جوال العميل |

### التعديلات

- **Backend**: `ROLE_PERMISSION_DEFAULTS`، `core.views`، `org.views`، `core.permissions` (دوال `can_view_cost_price`, `can_cancel_invoice`, `can_view_customer_phone`)
- **Frontend**: `PermissionsModal`، `AuthContext`، `i18n`، ربط `canUseProfitVisibility` بصلاحية `view_cost_price`
- **APIs**: فلترة بيانات التكلفة في `ProfitSummaryView` و `FinancialSummaryView` حسب الصلاحية

### الافتراضات

- **owner**: الثلاثة ✓
- **general_manager**: view_cost_price ✓, cancel_invoice ✓, view_customer_phone ✗
- **brand_manager**: view_cost_price ✓, cancel_invoice ✗, view_customer_phone ✗
- **branch_supervisor**: الثلاثة ✗
- **external_accountant**: view_cost_price ✓, cancel_invoice ✗, view_customer_phone ✗

---

## 3. محرك التنبيهات الذكي ✅

### التطبيق الجديد: `notifications`

- **NotificationRule**: قواعد (shift_not_opened_within_minutes، shift_not_closed_by_deadline، إلخ)
- **NotificationDelivery**: سجل الإرسال
- **القنوات**: Push (AdminNotification)، Email (SMTP)، WhatsApp (placeholder للتكامل)
- **تشغيل**: `python manage.py run_notification_rules [--dry-run]`

### API

- `GET/POST /api/notifications/rules/` – قائمة وإنشاء قواعد
- `PATCH/DELETE /api/notifications/rules/<id>/` – تعديل/حذف
- `POST /api/notifications/rules/trigger/` – تشغيل يدوي

### مثال قاعدة افتراضية

إنشاء قاعدة "وردية لم تُفتح خلال 10 دقائق":

```json
POST /api/notifications/rules/
{
  "name": "تنبيه وردية الصباح",
  "rule_type": "shift_not_opened_within_minutes",
  "params": {"minutes": 10, "shift_type": "morning"},
  "channels": ["push", "email"],
  "recipient_type": "owner"
}
```

### Cron مثال

```bash
# كل 5 دقائق
*/5 * * * * cd /path/to/backend && python manage.py run_notification_rules
```

---

## 4. تحسين أداء شاشة الكاشير ✅

- **React.memo** لـ `ProductCard` و `POSGridCell`
- **شبكة افتراضية** باستخدام `react-window` Grid لدعم ~10,000 منتج بأداء جيد
- قياس حجم الحاوية عبر `ResizeObserver` وتعديل أبعاد الشبكة تلقائياً

---

## 5. توثيق OpenAPI/Swagger ✅

- إعداد `SPECTACULAR_SETTINGS` مع وصف وتصنيفات (tags)
- `@extend_schema(tags=[...])` على واجهات الاختيار

### الروابط

- **Schema**: `/api/openapi/schema/`
- **Swagger UI**: `/api/openapi/swagger/`
- **ReDoc**: `/api/openapi/redoc/`

جاهز للربط مع أي نظام خارجي أو تطبيق موبايل.
