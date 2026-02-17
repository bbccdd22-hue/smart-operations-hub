/**
 * Responsive financial table – Aqua Glass, horizontal scroll (sticky col) on mobile or detail cards.
 * Text stays readable when selected (soft aqua ::selection).
 */
import { useTranslation } from "react-i18next";

export interface FinancialTableColumn {
  key: string;
  labelEn: string;
  labelAr: string;
  align?: "left" | "right" | "center";
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

type Props = {
  columns: FinancialTableColumn[];
  data: Record<string, unknown>[];
  titleEn?: string;
  titleAr?: string;
  emptyMessage?: string;
};

function formatValue(val: unknown): React.ReactNode {
  if (val == null) return "—";
  if (typeof val === "number" && Number.isFinite(val)) {
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
  }
  return String(val);
}

export default function ResponsiveFinancialTable({
  columns,
  data,
  titleEn,
  titleAr,
  emptyMessage = "No data",
}: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  if (data.length === 0) {
    return (
      <div className="aqua-glass-card rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  const title = isRTL ? titleAr : titleEn;
  const textAlign = isRTL ? "right" : "left";

  return (
    <div className="w-full space-y-4" style={{ fontFamily: "Inter, Lexend, Tajawal, system-ui, sans-serif" }}>
      {title && (
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{title}</h3>
      )}
      {/* Desktop: Aqua Glass table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[400px] border-collapse" dir={isRTL ? "rtl" : "ltr"}>
          <thead>
            <tr
              className="border-b border-slate-200/60 dark:border-white/10"
              style={{
                background: "rgba(16, 185, 129, 0.06)",
                backdropFilter: "blur(8px)",
              }}
            >
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300 ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""
                  }`}
                >
                  {isRTL ? col.labelAr : col.labelEn}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className="border-b border-slate-100/80 transition hover:bg-white/30 dark:border-white/5 dark:hover:bg-white/5"
              >
                {columns.map((col) => {
                  const val = row[col.key];
                  const rendered = col.render ? col.render(val, row) : formatValue(val);
                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm text-slate-800 dark:text-slate-100 ${
                        col.align === "right" ? "text-right font-medium tabular-nums" : col.align === "center" ? "text-center" : ""
                      }`}
                    >
                      {rendered}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Detail cards (no horizontal scroll – elegant stack) */}
      <div className="space-y-3 md:hidden">
        {data.map((row, i) => (
          <div key={i} className="aqua-glass-card rounded-2xl border border-slate-200/40 p-4 dark:border-white/10">
            <div className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
              {columns.map((col) => {
                const val = row[col.key];
                const rendered = col.render ? col.render(val, row) : formatValue(val);
                return (
                  <div key={col.key} className="flex justify-between gap-4 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      {isRTL ? col.labelAr : col.labelEn}
                    </span>
                    <span className="font-semibold tabular-nums text-slate-800 dark:text-white">
                      {rendered}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
