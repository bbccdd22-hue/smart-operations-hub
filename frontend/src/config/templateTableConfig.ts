/**
 * قوالب الجداول — نظام موحد لتصميم الأعمدة والقالب في كل الحركات والتقارير.
 * أي صفحة تحتوي جدولاً (إنشاء حركة أو تقرير) يمكنها استخدام نفس خاصية التصميم.
 */
export const DEFAULT_ROW_HEIGHT = 36;
export const DEFAULT_CUSTOM_COLUMN_WIDTH = 100;

export type TemplateLayout = {
  columnWidths: Partial<Record<string, number>>;
  rowHeight: number;
  columnOrder: string[];
};

/** تعريف عمود ثابت (لا يمكن حذفه أو تغيير اسمه). */
export interface TemplateFixedColumnDef {
  id: string;
  labelAr: string;
  labelEn: string;
  defaultWidth: number;
  minWidth?: number;
}

/** تعريف قالب: أعمدة ثابتة + دالة ترتيب افتراضي. */
export interface TemplateDef {
  key: string;
  fixedColumns: TemplateFixedColumnDef[];
  /** ترتيب افتراضي: قائمة معرفات الأعمدة (ثابتة + مخصصة). */
  defaultColumnOrder: (customColumnNames: string[]) => string[];
}

/** أعمدة ثابتة لمركز تدقيق التكاليف */
const COST_AUDIT_FIXED: TemplateFixedColumnDef[] = [
  { id: "index", labelAr: "رقم", labelEn: "#", defaultWidth: 40, minWidth: 32 },
  { id: "date", labelAr: "التاريخ", labelEn: "Date", defaultWidth: 100, minWidth: 85 },
  { id: "account_code", labelAr: "رقم الحساب", labelEn: "Account", defaultWidth: 100, minWidth: 70 },
  { id: "account_name", labelAr: "اسم الحساب", labelEn: "Account name", defaultWidth: 180, minWidth: 100 },
  { id: "amount", labelAr: "المبلغ", labelEn: "Amount", defaultWidth: 110, minWidth: 80 },
  { id: "description", labelAr: "الوصف", labelEn: "Description", defaultWidth: 140, minWidth: 80 },
  { id: "source", labelAr: "المصدر", labelEn: "Source", defaultWidth: 120, minWidth: 80 },
  { id: "category", labelAr: "التصنيف", labelEn: "Category", defaultWidth: 90, minWidth: 70 },
  { id: "actions", labelAr: "", labelEn: "", defaultWidth: 48, minWidth: 40 },
];

/** أعمدة ثابتة لميزان المراجعة */
const TRIAL_BALANCE_FIXED: TemplateFixedColumnDef[] = [
  { id: "index", labelAr: "رقم", labelEn: "#", defaultWidth: 40, minWidth: 32 },
  { id: "code", labelAr: "رقم الحساب", labelEn: "Code", defaultWidth: 100, minWidth: 70 },
  { id: "name", labelAr: "اسم الحساب", labelEn: "Account", defaultWidth: 200, minWidth: 120 },
  { id: "debit", labelAr: "مدين", labelEn: "Debit", defaultWidth: 110, minWidth: 80 },
  { id: "credit", labelAr: "دائن", labelEn: "Credit", defaultWidth: 110, minWidth: 80 },
  { id: "balance", labelAr: "الرصيد", labelEn: "Balance", defaultWidth: 110, minWidth: 80 },
];

/** أعمدة ثابتة لكشف الحساب */
const ACCOUNT_STATEMENT_FIXED: TemplateFixedColumnDef[] = [
  { id: "date", labelAr: "التاريخ", labelEn: "Date", defaultWidth: 100, minWidth: 80 },
  { id: "description", labelAr: "الوصف", labelEn: "Description", defaultWidth: 180, minWidth: 100 },
  { id: "source", labelAr: "المصدر", labelEn: "Source", defaultWidth: 90, minWidth: 70 },
  { id: "branch", labelAr: "الفرع", labelEn: "Branch", defaultWidth: 90, minWidth: 70 },
  { id: "debit", labelAr: "مدين", labelEn: "Debit", defaultWidth: 110, minWidth: 80 },
  { id: "credit", labelAr: "دائن", labelEn: "Credit", defaultWidth: 110, minWidth: 80 },
  { id: "balance", labelAr: "الرصيد", labelEn: "Balance", defaultWidth: 110, minWidth: 80 },
];

/** أعمدة ثابتة لتقرير الأرباح والخسائر */
const PROFIT_LOSS_FIXED: TemplateFixedColumnDef[] = [
  { id: "code", labelAr: "الرمز", labelEn: "Code", defaultWidth: 100, minWidth: 70 },
  { id: "name", labelAr: "الاسم", labelEn: "Name", defaultWidth: 200, minWidth: 120 },
  { id: "amount", labelAr: "المبلغ", labelEn: "Amount", defaultWidth: 120, minWidth: 90 },
  { id: "perc", labelAr: "النسبة %", labelEn: "Perc %", defaultWidth: 90, minWidth: 70 },
];

/** أعمدة ثابتة لقائمة الدخل */
const INCOME_STATEMENT_FIXED: TemplateFixedColumnDef[] = [
  { id: "code", labelAr: "الرمز", labelEn: "Code", defaultWidth: 90, minWidth: 70 },
  { id: "name", labelAr: "الاسم", labelEn: "Name", defaultWidth: 180, minWidth: 100 },
  { id: "current", labelAr: "الحالي", labelEn: "Current", defaultWidth: 120, minWidth: 80 },
  { id: "currentPerc", labelAr: "النسبة %", labelEn: "Perc %", defaultWidth: 90, minWidth: 60 },
  { id: "previous", labelAr: "السابق", labelEn: "Previous", defaultWidth: 120, minWidth: 80 },
  { id: "previousPerc", labelAr: "النسبة %", labelEn: "Perc %", defaultWidth: 90, minWidth: 60 },
  { id: "diff", labelAr: "الانحراف", labelEn: "Diff", defaultWidth: 100, minWidth: 70 },
  { id: "changePerc", labelAr: "التغير %", labelEn: "Change %", defaultWidth: 90, minWidth: 60 },
];

const STORAGE_PREFIX_LAYOUT = "template_layout_";

/** سجل القوالب المعرّفة — أضف هنا أي حركة أو تقرير له جدول. */
export const TEMPLATE_REGISTRY: Record<string, TemplateDef> = {
  cost_audit: {
    key: "cost_audit",
    fixedColumns: COST_AUDIT_FIXED,
    defaultColumnOrder: (custom) => {
      const fixed = COST_AUDIT_FIXED.map((c) => c.id);
      return [...fixed.slice(0, 1), ...custom, ...fixed.slice(1)];
    },
  },
  trial_balance: {
    key: "trial_balance",
    fixedColumns: TRIAL_BALANCE_FIXED,
    defaultColumnOrder: (custom) => {
      const fixed = TRIAL_BALANCE_FIXED.map((c) => c.id);
      return [...fixed.slice(0, 3), ...custom, ...fixed.slice(3)];
    },
  },
  account_statement: {
    key: "account_statement",
    fixedColumns: ACCOUNT_STATEMENT_FIXED,
    defaultColumnOrder: (custom) => {
      const fixed = ACCOUNT_STATEMENT_FIXED.map((c) => c.id);
      return [...fixed.slice(0, 2), ...custom, ...fixed.slice(2)];
    },
  },
  profit_loss: {
    key: "profit_loss",
    fixedColumns: PROFIT_LOSS_FIXED,
    defaultColumnOrder: (custom) => {
      const fixed = PROFIT_LOSS_FIXED.map((c) => c.id);
      return [...fixed.slice(0, 2), ...custom, ...fixed.slice(2)];
    },
  },
  income_statement: {
    key: "income_statement",
    fixedColumns: INCOME_STATEMENT_FIXED,
    defaultColumnOrder: (custom) => {
      const fixed = INCOME_STATEMENT_FIXED.map((c) => c.id);
      return [...fixed.slice(0, 2), ...custom, ...fixed.slice(2)];
    },
  },
};

export function getTemplate(key: string): TemplateDef | null {
  return TEMPLATE_REGISTRY[key] ?? null;
}

export function loadTemplateLayout(templateKey: string): TemplateLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX_LAYOUT + templateKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TemplateLayout;
    if (!parsed || typeof parsed.rowHeight !== "number") return null;
    return {
      columnWidths: parsed.columnWidths || {},
      rowHeight: parsed.rowHeight,
      columnOrder: Array.isArray(parsed.columnOrder) ? parsed.columnOrder : [],
    };
  } catch {
    return null;
  }
}

export function saveTemplateLayout(templateKey: string, layout: TemplateLayout): void {
  try {
    localStorage.setItem(STORAGE_PREFIX_LAYOUT + templateKey, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

/** للاستيراد في TemplateLayoutToolbar والصفحات — تحميل التخطيط المحفوظ. */
export const loadLayout = loadTemplateLayout;

/** للاستيراد في TemplateLayoutToolbar — حفظ التخطيط. */
export const saveLayout = saveTemplateLayout;

/** للاستيراد في TemplateLayoutToolbar — تخطيط افتراضي. */
export const getDefaultLayout = getTemplateDefaultLayout;

/** ترتيب الأعمدة للعرض: من التخطيط المحفوظ أو الافتراضي. */
export function getDisplayColumnOrder(
  templateKey: string,
  layout: TemplateLayout | null,
  customColumnNames: string[] = []
): string[] {
  if (layout?.columnOrder?.length) return layout.columnOrder;
  return getTemplateDefaultLayout(templateKey, customColumnNames).columnOrder;
}

/** تسمية العمود للعرض (ثابت من تعريف القالب). */
export function getColumnLabel(
  templateKey: string,
  columnId: string,
  _customLabel?: string,
  isRTL?: boolean
): string {
  const def = getTemplate(templateKey);
  const col = def?.fixedColumns.find((c) => c.id === columnId);
  if (col) return isRTL ? (col.labelAr || col.labelEn) : (col.labelEn || col.labelAr);
  return columnId;
}

/** عرض عمود — للاستيراد في TemplateLayoutToolbar والصفحات. */
export function getColumnWidth(
  templateKey: string,
  layout: TemplateLayout | null,
  columnId: string,
  isCustom?: boolean
): number {
  const effective = layout ?? getTemplateDefaultLayout(templateKey, []);
  return getTemplateColumnWidth(templateKey, effective, columnId, isCustom ?? false);
}

export function getTemplateDefaultLayout(
  templateKey: string,
  customColumnNames: string[] = []
): TemplateLayout {
  const def = getTemplate(templateKey);
  if (!def) {
    return {
      columnWidths: {},
      rowHeight: DEFAULT_ROW_HEIGHT,
      columnOrder: customColumnNames,
    };
  }
  const columnWidths: Partial<Record<string, number>> = {};
  def.fixedColumns.forEach((c) => { columnWidths[c.id] = c.defaultWidth; });
  customColumnNames.forEach((name) => { columnWidths[name] = DEFAULT_CUSTOM_COLUMN_WIDTH; });
  return {
    columnWidths,
    rowHeight: DEFAULT_ROW_HEIGHT,
    columnOrder: def.defaultColumnOrder(customColumnNames),
  };
}

export function getTemplateColumnWidth(
  templateKey: string,
  layout: TemplateLayout,
  columnId: string,
  isCustom: boolean
): number {
  const w = layout.columnWidths?.[columnId];
  if (typeof w === "number" && w >= 40) return w;
  const def = getTemplate(templateKey);
  const fixed = def?.fixedColumns.find((c) => c.id === columnId);
  return fixed ? fixed.defaultWidth : (isCustom ? DEFAULT_CUSTOM_COLUMN_WIDTH : 90);
}

const STORAGE_PREFIX_SCHEMA = "template_schema_";

export type TemplateCustomColumn = { id?: number; name: string; label: string; field_type: "text" | "number" | "date"; order: number };

export function loadTemplateSchema(templateKey: string): TemplateCustomColumn[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX_SCHEMA + templateKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTemplateSchema(templateKey: string, columns: TemplateCustomColumn[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX_SCHEMA + templateKey, JSON.stringify(columns));
  } catch {
    /* ignore */
  }
}
