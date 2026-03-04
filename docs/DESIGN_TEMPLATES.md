# تطبيق خاصية تصميم القالب على الحركات والتقارير
# Design Template Feature — Apply to Any Movement or Report

جميع القوالب التي تحتوي جدولاً (إنشاء حركة أو تقرير) يمكن أن تدعم **تصميم القالب**: ترتيب الأعمدة، عرض كل عمود، ارتفاع الصف. الأعمدة الثابتة لا تُحذف لكن يمكن تغيير ترتيبها وعرضها.

---

## القوالب المفعّلة حالياً

| مفتاح القالب       | الصفحة / التقرير           |
|--------------------|----------------------------|
| `journal_entry`    | قيد اليومية (مع أعمدة مخصصة من API) |
| `cost_audit`       | مركز تدقيق التكاليف        |
| `trial_balance`    | ميزان المراجعة             |
| `income_statement` | قائمة الدخل                |
| `account_statement`| كشف الحساب                 |
| `profit_loss`      | تقرير الأرباح والخسائر     |
| `daily_revenue`    | تقرير الإيراد اليومي (جاهز للتوصيل) |
| `stock_balance`    | أرصدة المخزون (جاهز للتوصيل) |
| `activity_log`     | سجل الرقابة (جاهز للتوصيل) |

---

## خطوات إضافة تصميم القالب لصفحة جديدة

### 1) تعريف القالب في `templateTableConfig.ts`

في `TEMPLATE_REGISTRY` أضف مفتاحاً جديداً، مثلاً `my_report`:

```ts
my_report: {
  fixedColumns: [
    { id: "index", labelAr: "رقم", labelEn: "#", defaultWidth: 40 },
    { id: "date", labelAr: "التاريخ", labelEn: "Date", defaultWidth: 110 },
    { id: "name", labelAr: "الاسم", labelEn: "Name", defaultWidth: 200 },
    { id: "amount", labelAr: "المبلغ", labelEn: "Amount", defaultWidth: 110 },
  ],
  defaultColumnOrder: (customNames) => {
    const fixed = ["index", "date", "name", "amount"];
    return [...fixed, ...customNames];
  },
},
```

- **fixedColumns**: أعمدة ثابتة (لا تُحذف)، يمكن تغيير ترتيبها وعرضها فقط.
- **defaultColumnOrder**: ترتيب افتراضي (ثابتة + أعمدة مخصصة إن وُجدت).

### 2) في الصفحة (مكوّن التقرير / الحركة)

- استيراد الدوال وشريط التصميم:

```ts
import TemplateLayoutToolbar from "../../components/TemplateLayoutToolbar";
import {
  loadLayout,
  getDisplayColumnOrder,
  getColumnWidth,
  getColumnLabel,
  type TemplateLayout,
} from "../../config/templateTableConfig";

const TEMPLATE_KEY = "my_report";
```

- حالة التخطيط وترتيب العرض:

```ts
const [tableLayout, setTableLayout] = useState<TemplateLayout | null>(() =>
  loadLayout(TEMPLATE_KEY)
);
const displayColumnOrder = getDisplayColumnOrder(TEMPLATE_KEY, tableLayout, []);
```

- في واجهة الجدول: زر التصميم:

```tsx
<TemplateLayoutToolbar
  templateKey={TEMPLATE_KEY}
  onLayoutChange={(layout) => setTableLayout(layout)}
  isRTL={isRTL}
  T={(ar, en) => (isRTL ? ar : en)}
/>
```

- رأس الجدول: اعتماد `displayColumnOrder` و`getColumnLabel` و`getColumnWidth`:

```tsx
<thead>
  <tr>
    {displayColumnOrder.map((colId) => (
      <th
        key={colId}
        style={{
          width: getColumnWidth(TEMPLATE_KEY, tableLayout, colId, false),
          minWidth: getColumnWidth(TEMPLATE_KEY, tableLayout, colId, true),
        }}
      >
        {getColumnLabel(TEMPLATE_KEY, colId, undefined, isRTL)}
      </th>
    ))}
  </tr>
</thead>
```

- جسم الجدول: نفس ترتيب `displayColumnOrder` لكل صف، وارتفاع الصف من `tableLayout.rowHeight` إن وُجد.

### 3) حفظ التخطيط

التخطيط يُحفظ تلقائياً في `localStorage` عند الضغط على **«تطبيق القالب»** في شريط التصميم. المفتاح: `template_layout_<TEMPLATE_KEY>`.

---

## قيد اليومية (استثناء)

صفحة **قيد اليومية** تستخدم مكوّن **SchemaEditor** (أعمدة مخصصة من API + قالب محلي) وملف `journalEntryTableConfig.ts`. التخطيط المحلي لجدول القيد يُخزَن في `journal_entry_table_layout`. لا تستخدم قيد اليومية `TemplateLayoutToolbar` لأن لديها أعمدة مخصصة قابلة للحفظ في الخادم.

---

## ملخص

- **أي حركة أو تقرير بجدول**: يمكن إضافة تصميم القالب بتعريف قالب في `TEMPLATE_REGISTRY` ثم استخدام `TemplateLayoutToolbar` و`getDisplayColumnOrder` / `getColumnWidth` / `getColumnLabel` في الصفحة.
- **الأعمدة الثابتة**: لا تُحذف ولا تُغيّر تسميتها؛ يمكن فقط تغيير **الترتيب** و**العرض** و**ارتفاع الصف**.
