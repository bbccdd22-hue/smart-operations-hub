# Design Robot — تطبيق التصميم على القوالب

كيفية إضافة **شريط تصميم القالب** (ترتيب الأعمدة، عرض الأعمدة، ارتفاع الصف) لأي صفحة حركة أو تقرير تحتوي على جدول.

## الخطوات

### 1. تسجيل القالب في `TEMPLATE_REGISTRY`

في `frontend/src/config/templateTableConfig.ts`:

- أضف مفتاحاً جديداً في `TEMPLATE_REGISTRY` (مثل `my_report`).
- عرّف `fixedColumns`: مصفوفة `{ id, labelAr, labelEn, defaultWidth, minWidth? }`.
- عرّف `defaultColumnOrder: (customColumnNames) => string[]` يرجع ترتيب معرفات الأعمدة (ثابتة + مخصصة).

مثال:

```ts
my_report: {
  fixedColumns: [
    { id: "index", labelAr: "رقم", labelEn: "#", defaultWidth: 40 },
    { id: "name", labelAr: "الاسم", labelEn: "Name", defaultWidth: 180 },
    { id: "amount", labelAr: "المبلغ", labelEn: "Amount", defaultWidth: 110 },
  ],
  defaultColumnOrder: (customNames) => ["index", "name", "amount", ...customNames],
},
```

### 2. في الصفحة: حالة التخطيط + التحميل/الحفظ

- استورد من `templateTableConfig`: `loadLayout`, `saveLayout`, `getDisplayColumnOrder`, `getColumnWidth`, `getColumnLabel`, ونوع `TemplateLayout`.
- استورد المكوّن: `import TemplateLayoutToolbar from ".../TemplateLayoutToolbar";`
- حدد `TEMPLATE_KEY = "my_report"` (نفس المفتاح في السجل).
- حالة التخطيط:

  ```ts
  const [tableLayout, setTableLayout] = useState<TemplateLayout | null>(() =>
    loadLayout(TEMPLATE_KEY)
  );
  ```

- عند تغيير التخطيط (مثلاً من الشريط):

  ```ts
  const handleLayoutChange = useCallback((layout: TemplateLayout) => {
    saveLayout(TEMPLATE_KEY, layout);
    setTableLayout(layout);
  }, []);
  ```

### 3. إضافة شريط التصميم في الواجهة

في الـ header أو شريط الأدوات:

```tsx
<TemplateLayoutToolbar
  templateKey={TEMPLATE_KEY}
  initialLayout={tableLayout}
  onLayoutChange={handleLayoutChange}
  label={T("تصميم القالب", "Design template")}
  isRTL={isRTL}
  T={T}
/>
```

### 4. رسم الجدول حسب التخطيط

- ترتيب الأعمدة المعروضة:  
  `const displayColumnOrder = getDisplayColumnOrder(TEMPLATE_KEY, tableLayout, customColumnNames);`
- عند رسم الـ `<thead>` و `<tbody>`: اعرض الأعمدة حسب `displayColumnOrder`.
- عرض كل عمود: `getColumnWidth(TEMPLATE_KEY, tableLayout, columnId, isCustom)`.
- ارتفاع الصف: `tableLayout?.rowHeight ?? DEFAULT_ROW_HEIGHT` (من نفس الملف).
- تسمية العمود: `getColumnLabel(TEMPLATE_KEY, columnId, customLabel, isRTL)`.

بهذا تصبح الصفحة متوافقة مع Design Robot مع إمكانية تغيير ترتيب الأعمدة وعرضها وارتفاع الصف وحفظ التفضيلات في `localStorage`.

## صفحات تطبق النمط حالياً

- **قيد اليومية** (`JournalEntryPage`): يستخدم `journalEntryTableConfig` و `SchemaEditor` (أعمدة مخصصة + تخطيط).
- **تدقيق التكاليف** (`CostAuditCenterPage`): `templateKey = "cost_audit"` + `TemplateLayoutToolbar`.
- **ميزان المراجعة** (`TrialBalancePage`): `templateKey = "trial_balance"` + `TemplateLayoutToolbar`.
- **قائمة الدخل** (`IncomeStatementPage`): `templateKey = "income_statement"` + `TemplateLayoutToolbar`.

للصفحات الأخرى ذات الجداول: أضف القالب إلى `TEMPLATE_REGISTRY` ثم اتبع الخطوات 2–4 أعلاه.
