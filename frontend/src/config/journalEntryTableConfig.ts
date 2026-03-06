/**
 * قيد اليومية — أعمدة ثابتة لا يمكن حذفها أو تغيير اسمها.
 * يمكن تعديل عرضها وارتفاع الصفوف وترتيب ظهورها في الجدول.
 */
export type FixedColumnId =
  | "index"
  | "line_reference"
  | "date"
  | "cost_center"
  | "description"
  | "debit"
  | "credit"
  | "foreign"
  | "status"
  | "account_name"
  | "account_code"
  | "actions";

export interface FixedColumnDef {
  id: FixedColumnId;
  labelAr: string;
  labelEn: string;
  defaultWidth: number; // px
  minWidth?: number;
}

/** العناوين الثابتة — لا يمكن حذفها أو تغيير اسمها. المدين والدائن إلزاميان محاسبياً. */
export const JOURNAL_ENTRY_FIXED_COLUMNS: FixedColumnDef[] = [
  { id: "index", labelAr: "رقم", labelEn: "#", defaultWidth: 36, minWidth: 28 },
  { id: "line_reference", labelAr: "المرجع", labelEn: "Ref", defaultWidth: 80, minWidth: 60 },
  { id: "date", labelAr: "التاريخ", labelEn: "Date", defaultWidth: 100, minWidth: 85 },
  { id: "cost_center", labelAr: "المشروع", labelEn: "Cost center", defaultWidth: 110, minWidth: 80 },
  { id: "description", labelAr: "الوصف", labelEn: "Description", defaultWidth: 120, minWidth: 80 },
  { id: "debit", labelAr: "مدين", labelEn: "Debit", defaultWidth: 100, minWidth: 70 },
  { id: "credit", labelAr: "دائن", labelEn: "Credit", defaultWidth: 100, minWidth: 70 },
  { id: "foreign", labelAr: "أجنبي", labelEn: "Foreign", defaultWidth: 72, minWidth: 50 },
  { id: "status", labelAr: "الحالة", labelEn: "Status", defaultWidth: 56, minWidth: 48 },
  { id: "account_name", labelAr: "اسم الحساب", labelEn: "Account name", defaultWidth: 180, minWidth: 100 },
  { id: "account_code", labelAr: "رقم الحساب", labelEn: "Account no.", defaultWidth: 90, minWidth: 70 },
  { id: "actions", labelAr: "", labelEn: "", defaultWidth: 44, minWidth: 36 },
];

/** للاستيراد في SchemaEditor */
export const FIXED_COLUMNS = JOURNAL_ENTRY_FIXED_COLUMNS;

export const DEFAULT_ROW_HEIGHT = 36;
export const DEFAULT_CUSTOM_COLUMN_WIDTH = 100;

export type JournalEntryLayout = {
  columnWidths: Partial<Record<string, number>>;
  rowHeight: number;
  /** ترتيب ظهور الأعمدة: ثابتة + مخصصة. القيم: FixedColumnId | string (اسم العمود المخصص) */
  columnOrder: string[];
};

const STORAGE_KEY = "journal_entry_table_layout";

export function loadJournalEntryLayout(): JournalEntryLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JournalEntryLayout;
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

export function saveJournalEntryLayout(layout: JournalEntryLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

/** ترتيب افتراضي: كل الثابتة ثم المخصصة. */
export function defaultColumnOrder(customColumnNames: string[]): string[] {
  const fixed = JOURNAL_ENTRY_FIXED_COLUMNS.map((c) => c.id);
  const beforeCustom = fixed.slice(0, 7); // index .. credit
  const afterCustom = fixed.slice(7);     // foreign .. actions
  return [...beforeCustom, ...customColumnNames, ...afterCustom];
}

/** تخطيط افتراضي (عرض أعمدة ثابتة + ارتفاع صف). */
export function getDefaultLayout(customColumnNames: string[] = []): JournalEntryLayout {
  const columnWidths: Partial<Record<string, number>> = {};
  JOURNAL_ENTRY_FIXED_COLUMNS.forEach((c) => { columnWidths[c.id] = c.defaultWidth; });
  customColumnNames.forEach((name) => { columnWidths[name] = DEFAULT_CUSTOM_COLUMN_WIDTH; });
  return {
    columnWidths,
    rowHeight: DEFAULT_ROW_HEIGHT,
    columnOrder: defaultColumnOrder(customColumnNames),
  };
}

/** عرض عمود من التخطيط أو الافتراضي. isCustom = عمود مخصص. */
export function getColumnWidth(
  layout: JournalEntryLayout,
  columnId: string,
  isCustom: boolean
): number {
  const w = layout.columnWidths?.[columnId];
  if (typeof w === "number" && w >= 40) return w;
  const fixed = JOURNAL_ENTRY_FIXED_COLUMNS.find((c) => c.id === columnId);
  return fixed ? fixed.defaultWidth : (isCustom ? DEFAULT_CUSTOM_COLUMN_WIDTH : 90);
}
