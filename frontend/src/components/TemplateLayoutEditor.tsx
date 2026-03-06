/**
 * محرر قالب الجدول — للتقارير والحركات (بدون API للأعمدة المخصصة).
 * يستخدم templateTableConfig: عرض أعمدة، ارتفاع صف، ترتيب الأعمدة.
 */
import { useState, useEffect } from "react";
import { Settings2, Lock, Layout, ArrowUp, ArrowDown } from "lucide-react";
import {
  getTemplate,
  loadTemplateLayout,
  saveTemplateLayout,
  getTemplateDefaultLayout,
  getTemplateColumnWidth,
  DEFAULT_ROW_HEIGHT,
  type TemplateLayout,
  type TemplateFixedColumnDef,
} from "../config/templateTableConfig";

interface TemplateLayoutEditorProps {
  /** مفتاح القالب (مثل cost_audit, trial_balance). */
  templateKey: string;
  /** التخطيط الحالي من الصفحة. */
  initialLayout?: TemplateLayout | null;
  /** يُستدعى عند تطبيق التخطيط. */
  onLayoutChange?: (layout: TemplateLayout) => void;
  isRTL?: boolean;
  T?: (ar: string, en: string) => string;
}

export default function TemplateLayoutEditor({
  templateKey,
  initialLayout = null,
  onLayoutChange,
  isRTL = false,
  T = (ar, en) => en,
}: TemplateLayoutEditorProps) {
  const def = getTemplate(templateKey);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<TemplateLayout>(() => {
    const loaded = initialLayout ?? loadTemplateLayout(templateKey);
    if (loaded?.columnOrder?.length) return loaded;
    return getTemplateDefaultLayout(templateKey, []);
  });
  const [layoutSuccess, setLayoutSuccess] = useState(false);

  useEffect(() => {
    if (open && initialLayout) setLayout(initialLayout);
    else if (open && def && (!layout.columnOrder?.length)) {
      setLayout(getTemplateDefaultLayout(templateKey, []));
    }
  }, [open, initialLayout, templateKey]);

  if (!def) return null;

  const fixedColumns = def.fixedColumns.filter((c) => c.labelAr || c.labelEn);
  const setLayoutColumnWidth = (columnId: string, width: number) => {
    const w = Math.max(40, Math.min(400, width));
    setLayout((prev) => ({ ...prev, columnWidths: { ...prev.columnWidths, [columnId]: w } }));
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
  const getOrderedLabel = (id: string): string => {
    const col = def.fixedColumns.find((c) => c.id === id);
    return col ? (isRTL ? col.labelAr : col.labelEn) : id;
  };
  const applyLayout = () => {
    saveTemplateLayout(templateKey, layout);
    onLayoutChange?.(layout);
    setLayoutSuccess(true);
    setTimeout(() => setLayoutSuccess(false), 2000);
  };
  const resetLayout = () => {
    const next = getTemplateDefaultLayout(templateKey, []);
    setLayout(next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e2533] border border-white/10 text-sm text-gray-300 hover:bg-white/5 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
      >
        <Settings2 className="h-4 w-4" />
        {T("تصميم القالب", "Design layout")}
      </button>

      {open && (
        <div className="absolute top-full end-0 mt-2 z-50 w-full min-w-[380px] max-w-md rounded-2xl bg-[#1e2533] border border-white/10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 bg-[#0e1117]/80 flex items-center justify-between shrink-0">
            <span className="text-sm font-medium text-amber-400/90">
              {T("تعديل حدود القالب", "Table layout")}
            </span>
            <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">×</button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="rounded-xl bg-[#0e1117] border border-amber-500/20 p-3">
              <div className="flex items-center gap-2 mb-2 text-amber-400/90 text-xs font-medium">
                <Lock className="h-3.5 w-3.5" />
                {T("أعمدة ثابتة", "Fixed columns")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fixedColumns.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#161b27] border border-white/10 text-[11px] text-gray-400">
                    <Lock className="h-3 w-3 text-amber-500/50" />
                    {isRTL ? c.labelAr : c.labelEn}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#0e1117] border border-white/10 p-3">
              <div className="flex items-center gap-2 mb-3 text-gray-400 text-xs font-medium">
                <Layout className="h-3.5 w-3.5" />
                {T("ارتفاع الصف وعرض الأعمدة", "Row height & column widths")}
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
                <div className="flex items-end">
                  <button type="button" onClick={resetLayout} className="px-2 py-1.5 rounded-lg text-[11px] text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 border border-white/10">
                    {T("إعادة افتراضي", "Reset default")}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {def.fixedColumns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-400 truncate">{isRTL ? c.labelAr : c.labelEn}</span>
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        min={40}
                        max={400}
                        value={getTemplateColumnWidth(templateKey, layout, c.id, false)}
                        onChange={(e) => setLayoutColumnWidth(c.id, Number(e.target.value) || c.defaultWidth)}
                        className="w-full bg-[#161b27] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white text-end"
                      />
                      <span className="text-[10px] text-gray-500">px</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#0e1117] border border-white/10 p-3">
              <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs font-medium">
                <ArrowUp className="h-3.5 w-3.5" />
                {T("ترتيب الأعمدة", "Column order")}
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {layout.columnOrder.map((id, index) => (
                  <div key={`${id}-${index}`} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-[#161b27] border border-white/5">
                    <span className="text-[11px] truncate flex-1 text-gray-400">
                      <Lock className="h-3 w-3 text-amber-500/50 shrink-0 inline-block me-1" />
                      {getOrderedLabel(id) || id}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => moveColumnOrder(index, "up")} disabled={index === 0} className="p-1 rounded text-gray-500 hover:text-amber-400 hover:bg-white/5 disabled:opacity-30" title={T("أعلى", "Up")}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => moveColumnOrder(index, "down")} disabled={index === layout.columnOrder.length - 1} className="p-1 rounded text-gray-500 hover:text-amber-400 hover:bg-white/5 disabled:opacity-30" title={T("أسفل", "Down")}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button type="button" onClick={applyLayout} className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium">
              {T("تطبيق القالب", "Apply layout")}
            </button>
            {layoutSuccess && <p className="text-[11px] text-emerald-400">{T("تم تطبيق القالب", "Layout applied")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
