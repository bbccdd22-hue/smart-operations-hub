/**
 * شريط تخطيط القالب — Design Robot لأي حركة أو تقرير
 * يستخدم templateTableConfig: ترتيب الأعمدة، عرض الأعمدة، ارتفاع الصف.
 */
import { useState, useEffect } from "react";
import { Settings2, Layout, ArrowUp, ArrowDown, Lock } from "lucide-react";
import {
  TEMPLATE_REGISTRY,
  loadLayout,
  saveLayout,
  getDefaultLayout,
  getColumnWidth,
  DEFAULT_ROW_HEIGHT,
  type TemplateLayout,
} from "../config/templateTableConfig";

interface TemplateLayoutToolbarProps {
  templateKey: string;
  customColumnNames?: string[];
  /** تخطيط أولي من الصفحة (مثلاً من state) — يُستخدم عند فتح النافذة إن وُجد */
  initialLayout?: TemplateLayout | null;
  onLayoutChange?: (layout: TemplateLayout) => void;
  /** نص زر التصميم (اختياري) */
  label?: string;
  isRTL?: boolean;
  T?: (ar: string, en: string) => string;
}

export default function TemplateLayoutToolbar({
  templateKey,
  customColumnNames = [],
  initialLayout = null,
  onLayoutChange,
  label,
  isRTL = false,
  T = (ar, en) => en,
}: TemplateLayoutToolbarProps) {
  const def = TEMPLATE_REGISTRY[templateKey];
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<TemplateLayout>(() => {
    const loaded = initialLayout ?? loadLayout(templateKey);
    if (loaded?.columnOrder?.length) return loaded;
    return getDefaultLayout(templateKey, customColumnNames);
  });
  const [layoutSuccess, setLayoutSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      const loaded = initialLayout ?? loadLayout(templateKey);
      if (loaded?.columnOrder?.length) setLayout(loaded);
    }
  }, [open, templateKey, initialLayout]);

  const setColumnWidth = (columnId: string, width: number) => {
    const w = Math.max(40, Math.min(500, width));
    setLayout((prev) => ({
      ...prev,
      columnWidths: { ...prev.columnWidths, [columnId]: w },
    }));
  };

  const setRowHeight = (height: number) => {
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

  const getLabel = (id: string) => {
    const col = def?.fixedColumns.find((c) => c.id === id);
    if (col) return isRTL ? (col.labelAr || col.labelEn) : (col.labelEn || col.labelAr);
    return id;
  };

  const applyLayout = () => {
    saveLayout(templateKey, layout);
    onLayoutChange?.(layout);
    setLayoutSuccess(true);
    setTimeout(() => setLayoutSuccess(false), 2000);
  };

  const resetToDefault = () => {
    setLayout(getDefaultLayout(templateKey, customColumnNames));
  };

  if (!def) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#1e2533] px-4 py-2.5 text-sm text-gray-300 transition hover:border-amber-500/30 hover:bg-white/5 hover:text-amber-400"
      >
        <Settings2 className="h-4 w-4" />
        {label ?? T("تصميم القالب", "Design layout")}
      </button>

      {open && (
        <div className="absolute top-full end-0 z-50 mt-2 flex max-h-[85vh] w-full min-w-[380px] max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1e2533] shadow-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0e1117]/80 px-4 py-3">
            <span className="text-sm font-medium text-amber-400/90">
              {T("تعديل حدود القالب", "Layout — column order & widths")}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="rounded-xl border border-amber-500/20 bg-[#0e1117] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-400/90">
                <Lock className="h-3.5 w-3.5" />
                {T("أعمدة ثابتة — ترتيب وعرض فقط", "Fixed columns — order & width only")}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs text-gray-400">{T("ارتفاع الصف (px)", "Row height (px)")}</label>
              <input
                type="number"
                min={28}
                max={120}
                value={layout.rowHeight}
                onChange={(e) => setRowHeight(Number(e.target.value) || DEFAULT_ROW_HEIGHT)}
                className="w-full rounded-lg border border-white/10 bg-[#161b27] px-2 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                <span>{T("ترتيب الأعمدة", "Column order")}</span>
                <button type="button" onClick={resetToDefault} className="text-amber-400 hover:underline">
                  {T("إعادة افتراضي", "Reset")}
                </button>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {layout.columnOrder.map((id, index) => (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#161b27] px-2 py-1.5"
                  >
                    <span className="truncate text-[11px] text-white">{getLabel(id)}</span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveColumnOrder(index, "up")}
                        disabled={index === 0}
                        className="rounded p-1 text-gray-500 hover:bg-white/5 hover:text-amber-400 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumnOrder(index, "down")}
                        disabled={index === layout.columnOrder.length - 1}
                        className="rounded p-1 text-gray-500 hover:bg-white/5 hover:text-amber-400 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="number"
                      min={40}
                      max={500}
                      value={getColumnWidth(templateKey, layout, id, false)}
                      onChange={(e) => setColumnWidth(id, Number(e.target.value) || 90)}
                      className="w-16 rounded border border-white/10 bg-[#0e1117] px-1.5 py-1 text-end text-[11px] text-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 bg-[#0e1117]/50 px-4 py-3">
            {layoutSuccess && <span className="text-xs text-emerald-400">{T("تم تطبيق القالب", "Layout applied")}</span>}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
            >
              {T("إغلاق", "Close")}
            </button>
            <button
              type="button"
              onClick={applyLayout}
              className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
            >
              <Layout className="h-4 w-4" />
              {T("تطبيق القالب", "Apply layout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
