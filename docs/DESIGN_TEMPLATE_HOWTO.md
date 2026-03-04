# تطبيق خاصية تصميم القالب على أي حركة أو تقرير

جميع القوالب التي تحتوي جدولاً (إنشاء حركة أو تقرير) يمكنها استخدام نفس خاصية **تصميم القالب**: ترتيب الأعمدة، عرض كل عمود، ارتفاع الصف.

## الصفحات المفعّلة حالياً

| القالب | المفتاح | الصفحة |
|--------|---------|--------|
| قيد اليومية | (يستخدم SchemaEditor + journalEntryTableConfig) | `/finance/journal-entry` |
| مركز تدقيق التكاليف | `cost_audit` | `/finance/cost-audit` |
| ميزان المراجعة | `trial_balance` | `/finance/trial-balance` |
| كشف الحساب | `account_statement` | `/finance/account-statement` |
| تقرير الأرباح والخسائر | `profit_loss` | `/finance/profit-loss` |
| قائمة الدخل | `income_statement` | `/finance/income-statement` |

## إضافة التصميم لصفحة جديدة (جدول)

### 1. تسجيل القالب في `frontend/src/config/templateTableConfig.ts`

- عرّف مصفوفة أعمدة ثابتة (مثل `MY_PAGE_FIXED`) بنفس تنسيق `TemplateFixedColumnDef`:  
  `id`, `labelAr`, `labelEn`, `defaultWidth`, `minWidth?`
- أضف عنصراً في `TEMPLATE_REGISTRY`:

```ts
export const TEMPLATE_REGISTRY: Record<string, TemplateDef> = {
  // ...
  my_page: {
    key: "my_page",
    fixedColumns: MY_PAGE_FIXED,
    defaultColumnOrder: (custom) => {
      const fixed = MY_PAGE_FIXED.map((c) => c.id);
      return [...fixed.slice(0, 1), ...custom, ...fixed.slice(1)];
    },
  },
};
```

### 2. في الصفحة (مكوّن React)

- استورد:  
  `TemplateLayoutToolbar`, `loadLayout`, `saveLayout`, `getDisplayColumnOrder`, `getColumnWidth`, `getColumnLabel`, ونوع `TemplateLayout` من `templateTableConfig`.
- اختر مفتاحاً ثابتاً، مثلاً:  
  `const TEMPLATE_KEY = "my_page";`
- حالة التخطيط وترتيب العرض:

```ts
const [tableLayout, setTableLayout] = useState<TemplateLayout | null>(() => loadLayout(TEMPLATE_KEY));
const displayColumnOrder = useMemo(
  () => getDisplayColumnOrder(TEMPLATE_KEY, tableLayout, []),
  [tableLayout]
);
```

- في واجهة الجدول: ضع زر التصميم (مثلاً بجانب عنوان الجدول):

```tsx
<TemplateLayoutToolbar
  templateKey={TEMPLATE_KEY}
  onLayoutChange={(l) => setTableLayout(l)}
  isRTL={isRTL}
  T={(ar, en) => (isRTL ? ar : en)}
/>
```

- في `<thead>`: اعرض الرؤوس حسب `displayColumnOrder` مع عرض من التخطيط:

```tsx
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
```

- في `<tbody>`: لكل صف اعرض الخلايا بنفس ترتيب `displayColumnOrder`، واستخدم `getColumnWidth(TEMPLATE_KEY, tableLayout, colId, false)` لعرض العمود. يمكنك استخدام دالة `renderCell(colId, row, index)` ترجع المحتوى حسب `colId`.

### 3. حفظ التخطيط عند "تطبيق القالب"

عند الضغط على "تطبيق القالب" داخل `TemplateLayoutToolbar` يتم استدعاء `onLayoutChange(layout)`. التخطيط يُحفظ تلقائياً في `localStorage` تحت المفتاح `template_layout_<TEMPLATE_KEY>`. يكفي أن تحدّث الـ state كما أعلاه حتى يعكس الجدول التخطيط فوراً.

## قيد اليومية (استثناء)

صفحة قيد اليومية تستخدم نظاماً أوسع:

- **SchemaEditor** من `components/SchemaEditor`: أعمدة مخصصة (من API) + ترتيب + عرض + ارتفاع.
- التكوين من `config/journalEntryTableConfig.ts` وواجهة `/api/accounting/journal-entries/schema/` لحفظ الأعمدة المخصصة.

لأي صفحة أخرى تحتاج أعمدة مخصصة مخزنة في السيرفر يمكن لاحقاً ربطها بنظام مشابه أو استخدام `template_schema_<key>` من `templateTableConfig` (localStorage) مع واجهة التصميم الحالية.
