/**
 * Design Robot – Schema Editor: أعمدة مخصصة + أعمدة ثابتة (لا تُحذف) + تعديل القالب (عرض/ارتفاع).
 */
import { useState, useEffect } from "react";
import { Settings2, Plus, Trash2, Save, GripVertical, Lock, Layout, ArrowUp, ArrowDown } from "lucide-react";
import { fetchWithCsrf } from "../lib/api";
import {
  JOURNAL_ENTRY_FIXED_COLUMNS,
  loadJournalEntryLayout,
  saveJournalEntryLayout,
  getDefaultLayout,
  getColumnWidth,
  defaultColumnOrder,
  DEFAULT_CUSTOM_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  type JournalEntryLayout,
  type FixedColumnId,
} from "../config/journalEntryTableConfig";

const FIXED_COLUMNS = JOURNAL_ENTRY_FIXED_COLUMNS;

export type CustomColumn = {
  id?: number;
  name: string;
  label: string;
  field_type: "text" | "number" | "date";
  order: number;
};

const FIELD_TYPES: { value: CustomColumn["field_type"]; labelAr: string; labelEn: string }[] = [
  { value: "text", labelAr: "نص", labelEn: "Text" },
  { value: "number", labelAr: "رقم", labelEn: "Number" },
  { value: "date", labelAr: "تاريخ", labelEn: "Date" },
];

function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

interface SchemaEditorProps {
  initialColumns: CustomColumn[];
  /** Current layout (widths + row height). If not provided, loaded from localStorage. */
  initialLayout?: JournalEntryLayout | null;
  onSaved?: (columns: CustomColumn[]) => void;
  /** Called when layout (column widths / row height) is saved. */
  onLayoutChange?: (layout: JournalEntryLayout) => void;
  isRTL?: boolean;
  T?: (ar: string, en: string) => string;
}

export default function SchemaEditor({
  initialColumns,
  initialLayout = null,
  onSaved,
  onLayoutChange,
  isRTL = false,
  T = (ar, en) => en,
}: SchemaEditorProps) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [layout, setLayout] = useState<JournalEntryLayout>(() => {
    const loaded = initialLayout ?? loadJournalEntryLayout();
    if (loaded && loaded.columnOrder?.length) return loaded;
    return getDefaultLayout(initialColumns.map((c) => c.name));
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [layoutSuccess, setLayoutSuccess] = useState(false);

  useEffect(() => {
    setColumns(
      initialColumns.length
        ? initialColumns.map((c) => ({
            ...c,
            name: c.name || slug(c.label) || "field",
            order: c.order ?? 0,
          }))
        : []
    );
  }, [initialColumns, open]);

  useEffect(() => {
    if (open && initialLayout) setLayout(initialLayout);
    else if (open && layout.columnOrder.length === 0) {
      const names = (initialColumns.length ? initialColumns : columns).map((c) => c.name);
      setLayout((prev) => ({ ...prev, columnOrder: defaultColumnOrder(names) }));
    }
  }, [open, initialLayout]);

  const addColumn = () => {
    const nextOrder = columns.length;
    const newName = `custom_${nextOrder}`;
    setColumns((prev) => [
      ...prev,
      { name: newName, label: "", field_type: "text", order: nextOrder },
    ]);
    setLayout((prev) => {
      const before = prev.columnOrder.slice(0, prev.columnOrder.indexOf("credit") + 1);
      const after = prev.columnOrder.slice(prev.columnOrder.indexOf("credit") + 1);
      return { ...prev, columnOrder: [...before, newName, ...after] };
    });
  };

  const setColumn = (idx: number, field: keyof CustomColumn, value: string | number) => {
    setColumns((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
    if (field === "label") {
      const label = String(value).trim();
      if (label) {
        setColumns((prev) =>
          prev.map((c, i) => (i === idx ? { ...c, name: slug(label) || c.name } : c))
        );
      }
    }
  };

  const removeColumn = (idx: number) => {
    const name = columns[idx]?.name;
    setColumns((prev) => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order: i })));
    if (name)
      setLayout((prev) => ({
        ...prev,
        columnOrder: prev.columnOrder.filter((id) => id !== name),
      }));
  };

  const setLayoutColumnWidth = (columnId: string, width: number) => {
    const w = Math.max(40, Math.min(400, width));
    setLayout((prev) => ({
      ...prev,
      columnWidths: { ...prev.columnWidths, [columnId]: w },
    }));
  };

  const setLayoutRowHeight = (height: number) => {
    const h = Math.max(28, Math.min(120, height));
    setLayout((prev) => ({ ...prev, rowHeight: h }));
  };

  const moveColumnOrder = (index: number, dir: "up" | "down") => {
    const order = [...layout.columnOrder];
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setLayout((prev) => ({ ...prev, columnOrder: order }));
  };

  const getOrderedColumnLabel = (id: string): string => {
    const fixed = FIXED_COLUMNS.find((c) => c.id === id);
    if (fixed) return isRTL ? fixed.labelAr : fixed.labelEn;
    const custom = columns.find((c) => c.name === id);
    return (custom?.label || custom?.name || id) as string;
  };

  const isFixedId = (id: string): id is FixedColumnId =>
    FIXED_COLUMNS.some((c) => c.id === id);

  const applyLayout = () => {
    saveJournalEntryLayout(layout);
    onLayoutChange?.(layout);
    setLayoutSuccess(true);
    setTimeout(() => setLayoutSuccess(false), 2000);
  };

  const handleSaveDesign = async () => {
    const valid = columns.filter((c) => (c.label || "").trim());
    if (valid.some((c) => !(c.name || "").trim())) {
      setSaveError(T("كل عمود يحتاج اسمًا داخليًا (يُولد من التسمية)", "Each column needs an internal name"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const payload = valid.map((c, i) => ({
        name: (c.name || slug(c.label) || `field_${i}`).slice(0, 64),
        label: (c.label || "").trim().slice(0, 128),
        field_type: c.field_type || "text",
        order: i,
      }));
      const res = await fetchWithCsrf("/api/accounting/journal-entries/schema/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: payload }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d.detail === "string" ? d.detail : "Failed to save design");
      }
      const data = await res.json();
      setSaveSuccess(true);
      setColumns(data.columns || []);
      onSaved?.(data.columns || []);
      saveJournalEntryLayout(layout);
      onLayoutChange?.(layout);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetLayoutToDefault = () => {
    const def = getDefaultLayout(columns.map((c) => c.name));
    columns.forEach((c) => {
      def.columnWidths[c.name] = DEFAULT_CUSTOM_COLUMN_WIDTH;
    });
    setLayout(def);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e2533] border border-white/10 text-sm text-gray-300 hover:bg-white/5 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
      >
        <Settings2 className="h-4 w-4" />
        {T("تصميم الأعمدة والقالب", "Design Columns & Layout")}
      </button>

      {open && (
        <div className="absolute top-full end-0 mt-2 z-50 w-full min-w-[440px] max-w-xl rounded-2xl bg-[#1e2533] border border-white/10 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 bg-[#0e1117]/80 flex items-center justify-between shrink-0">
            <span className="text-sm font-medium text-amber-400/90">
              {T("محرر التصميم — أعمدة وحدود القالب", "Schema & layout editor")}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
            >
              ×
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* ─── أعمدة ثابتة (لا يمكن تعديل العناوين أو الحذف) ─── */}
            <div className="rounded-xl bg-[#0e1117] border border-amber-500/20 p-3">
              <div className="flex items-center gap-2 mb-2 text-amber-400/90 text-xs font-medium">
                <Lock className="h-3.5 w-3.5" />
                {T("أعمدة ثابتة — لا يمكن حذفها أو تغيير اسمها", "Fixed columns — cannot delete or rename")}
              </div>
              <p className="text-[11px] text-gray-500 mb-2">
                {T("منها: مدين، دائن، رقم الحساب، اسم الحساب، المرجع، التاريخ، المشروع، الوصف، أجنبي، الحالة.", "Including: Debit, Credit, Account no., Account name, Ref, Date, Cost center, Description, Foreign, Status.")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FIXED_COLUMNS.filter((c) => c.labelAr || c.labelEn).map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#161b27] border border-white/10 text-[11px] text-gray-400"
                  >
                    <Lock className="h-3 w-3 text-amber-500/50" />
                    {isRTL ? c.labelAr : c.labelEn}
                  </span>
                ))}
              </div>
            </div>

            {/* ─── أعمدة مخصصة (إضافة / تعديل / حذف) ─── */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-medium">
                <GripVertical className="h-3.5 w-3.5" />
                {T("أعمدة مخصصة — يمكنك إضافتها وتعديلها وحذفها", "Custom columns — add, edit, remove")}
              </div>
              {columns.map((col, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-3 rounded-xl bg-[#0e1117] border border-white/10 mb-2"
                >
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => setColumn(idx, "label", e.target.value)}
                    placeholder={T("التسمية (مثل: تاريخ الصيانة)", "Label (e.g. Maintenance Date)")}
                    className="flex-1 min-w-0 bg-[#161b27] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-500"
                  />
                  <select
                    value={col.field_type}
                    onChange={(e) => setColumn(idx, "field_type", e.target.value as CustomColumn["field_type"])}
                    className="bg-[#161b27] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white w-24"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {isRTL ? t.labelAr : t.labelEn}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1 w-16">
                    <input
                      type="number"
                      min={40}
                      max={400}
                      value={getColumnWidth(layout, col.name, true)}
                      onChange={(e) => setLayoutColumnWidth(col.name, Number(e.target.value) || 100)}
                      className="w-full bg-[#161b27] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white text-end"
                      title={T("عرض (px)", "Width (px)")}
                    />
                    <span className="text-[10px] text-gray-500">px</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeColumn(idx)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                    title={T("حذف العمود", "Remove column")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addColumn}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/20 text-gray-400 hover:border-amber-500/40 hover:text-amber-400 text-sm"
              >
                <Plus className="h-4 w-4" />
                {T("إضافة عمود مخصص", "Add custom column")}
              </button>
            </div>

            {/* ─── تعديل القالب: ارتفاع الصف + عرض كل عمود ─── */}
            <div className="rounded-xl bg-[#0e1117] border border-white/10 p-3">
              <div className="flex items-center gap-2 mb-3 text-gray-400 text-xs font-medium">
                <Layout className="h-3.5 w-3.5" />
                {T("تعديل حدود القالب — ارتفاع الصف وعرض كل عمود", "Layout — row height & column widths")}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">{T("ارتفاع الصف (px)", "Row height (px)")}</label>
                  <input
                    type="number"
                    min={28}
                    max={120}
                    value={layout.rowHeight}
                    onChange={(e) => setLayoutRowHeight(Number(e.target.value) || DEFAULT_ROW_HEIGHT)}
                    className="w-full bg-[#161b27] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={resetLayoutToDefault}
                    className="px-2 py-1.5 rounded-lg text-[11px] text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 border border-white/10"
                  >
                    {T("إعادة افتراضي", "Reset default")}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {FIXED_COLUMNS.filter((c) => c.labelAr || c.labelEn).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-400 truncate">{isRTL ? c.labelAr : c.labelEn}</span>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        min={40}
                        max={400}
                        value={getColumnWidth(layout, c.id, false)}
                        onChange={(e) => setLayoutColumnWidth(c.id, Number(e.target.value) || c.defaultWidth)}
                        className="w-full bg-[#161b27] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white text-end"
                      />
                      <span className="text-[10px] text-gray-500">px</span>
                    </div>
                  </div>
                ))}
                {columns.map((col) => (
                  <div key={col.name} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-amber-400/80 truncate">{col.label || col.name}</span>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        min={40}
                        max={400}
                        value={getColumnWidth(layout, col.name, true)}
                        onChange={(e) => setLayoutColumnWidth(col.name, Number(e.target.value) || DEFAULT_CUSTOM_COLUMN_WIDTH)}
                        className="w-full bg-[#161b27] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white text-end"
                      />
                      <span className="text-[10px] text-gray-500">px</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={applyLayout}
                className="mt-3 w-full py-2 rounded-xl bg-[#161b27] border border-white/10 text-xs text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30"
              >
                {T("تطبيق القالب على الجدول", "Apply layout to table")}
              </button>
              {layoutSuccess && (
                <p className="mt-1.5 text-[11px] text-emerald-400">{T("تم تطبيق القالب", "Layout applied")}</p>
              )}
            </div>

            {/* ─── ترتيب الأعمدة (تعديل أماكن الظهور) ─── */}
            <div className="rounded-xl bg-[#0e1117] border border-white/10 p-3">
              <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-medium">
                <GripVertical className="h-3.5 w-3.5" />
                {T("ترتيب الأعمدة — تغيير أماكن الظهور في الجدول", "Column order — change display order")}
              </div>
              <p className="text-[11px] text-gray-500 mb-2">
                {T("استخدم السهم للأعلى/للأسفل لتحريك العمود. الثابتة يمكن نقلها أيضاً.", "Use up/down to move column. Fixed columns can be reordered too.")}
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {layout.columnOrder.map((id, index) => (
                  <div
                    key={`${id}-${index}`}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-[#161b27] border border-white/5"
                  >
                    <span className="text-[11px] truncate flex-1">
                      {isFixedId(id) ? (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <Lock className="h-3 w-3 text-amber-500/50 shrink-0" />
                          {getOrderedColumnLabel(id) || id}
                        </span>
                      ) : (
                        <span className="text-amber-400/90">{getOrderedColumnLabel(id) || id}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveColumnOrder(index, "up")}
                        disabled={index === 0}
                        className="p-1 rounded text-gray-500 hover:text-amber-400 hover:bg-white/5 disabled:opacity-30"
                        title={T("تحريك لأعلى", "Move up")}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumnOrder(index, "down")}
                        disabled={index === layout.columnOrder.length - 1}
                        className="p-1 rounded text-gray-500 hover:text-amber-400 hover:bg-white/5 disabled:opacity-30"
                        title={T("تحريك لأسفل", "Move down")}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-white/10 bg-[#0e1117]/50 flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-gray-500">
              {saveError && <span className="text-red-400">{saveError}</span>}
              {saveSuccess && <span className="text-emerald-400">{T("تم حفظ التصميم", "Design saved")}</span>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyLayout}
                className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 text-sm"
              >
                {T("تطبيق القالب", "Apply layout")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 text-sm"
              >
                {T("إغلاق", "Close")}
              </button>
              <button
                type="button"
                onClick={handleSaveDesign}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium"
              >
                <Save className="h-4 w-4" />
                {saving ? T("جاري الحفظ...", "Saving...") : T("حفظ التصميم", "Save Design")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
