# دورة الإمداد (Supply Cycle)

## 1. شاشة المطبخ المركزي

**المسار:** `/central-kitchen`

- عرض طلبات التحويل الواردة من الفروع إلى المطبخ المركزي
- تأكيد الاستلام أو رفض التحويل
- **التفعيل:** ضع علامة على الفرع في `Branch.is_central_kitchen = True` (من لوحة الإدارة أو Django Admin)

## 2. التنبؤ الذكي للشراء

**المسار:** `/smart-purchase`

- API: `GET /api/procurement/purchase-suggestions/?branch_id=X&horizon_days=7&lookback_days=90`
- يعتمد على مبيعات المنتجات (Product Sale) من الكاشير
- يفكك الوصفات (Recipe) ويقارن بالرصيد الحالي
- يُرجع اقتراح كميات الشراء لكل مكوّن

**متطلبات:** رفع تقارير مبيعات المنتجات (Product Sales) للفرع من Excel

## 3. بوابة الموردين

**المسار:** `POST /api/procurement/supplier-portal/invoice/`

### المصادقة
```
X-Supplier-API-Key: <portal_api_key>
```
أو
```
Authorization: Bearer <portal_api_key>
```

### إنشاء المفتاح
- في Django Admin: `Procurement > Suppliers > [المورد]` → حقل `portal_api_key`
- أو عبر shell: `Supplier.objects.filter(id=X).update(portal_api_key="SECRET_KEY_HERE")`

### طلب تسجيل فاتورة
```json
{
  "invoice_number": "INV-2026-001",
  "invoice_date": "2026-02-20",
  "total_amount": 1500.50,
  "branch_id": 5,
  "notes": "فاتورة شهر فبراير",
  "auto_post": true
}
```

- `auto_post: true` (افتراضي): يرفع القيد مباشرة في الحسابات الدائنة (02101)
- فاتورة قائمة: قيد مدين مصروف، دائن الموردين
- فاتورة مرتبطة بـ `goods_receipt_id`: تكتفي بربط الفاتورة (الاستحقاق تم عند الاستلام)
