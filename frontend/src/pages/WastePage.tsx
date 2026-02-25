/**
 * Waste Tracking – Staff enters "Actual amount used today". Variance vs Prep List.
 * RED when overuse (actual > expected).
 * Route: /waste-tracker
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  fetchWasteReport,
  saveWasteReport,
  fetchBranches,
  type WasteReportEntry,
} from "../lib/api";

/** RED when actual > expected (overuse). Variance = (actual - expected)/expected * 100. */

export default function WastePage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Array<{ id: number; name: string; name_ar?: string }>>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [entries, setEntries] = useState<WasteReportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actualEdits, setActualEdits] = useState<Record<number, string>>({});

  const loadBranches = useCallback(async () => {
    const list = await fetchBranches();
    setBranches(list);
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchWasteReport({
        date,
        branch_id: branchId !== "" ? branchId : undefined,
      });
      setEntries(r.entries);
      setActualEdits(
        r.entries.reduce((acc, e) => {
          acc[e.ingredient_id] = e.actual_usage;
          return acc;
        }, {} as Record<number, string>)
      );
    } catch {
      setEntries([]);
      setActualEdits({});
    } finally {
      setLoading(false);
    }
  }, [date, branchId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleActualChange = (ingredientId: number, value: string) => {
    setActualEdits((e) => ({ ...e, [ingredientId]: value }));
  };

  const computeVariance = (theoretical: string, actual: string): number | null => {
    const t = parseFloat(theoretical);
    const a = parseFloat(actual);
    if (Number.isNaN(t) || t === 0) return null;
    if (Number.isNaN(a)) return null;
    return Math.round(((a - t) / t) * 100 * 100) / 100;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveWasteReport({
        date,
        branch_id: branchId !== "" ? branchId : undefined,
        entries: entries.map((e) => ({
          ingredient_id: e.ingredient_id,
          theoretical_usage: e.theoretical_usage,
          actual_usage: actualEdits[e.ingredient_id] ?? e.actual_usage ?? "0",
        })),
      });
      await loadReport();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = entries.some(
    (e) => (actualEdits[e.ingredient_id] ?? e.actual_usage) !== e.actual_usage
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          {t("wasteEntry")}
        </h1>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t("all")} {t("branch")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name_ar || b.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
          <button
            onClick={loadReport}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? t("loading") ?? "Loading..." : t("refresh") ?? "Refresh"}
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "..." : t("save") ?? "Save"}
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 && !loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">
            {t("wasteNoData") ?? "No prep list data for this date. Select a branch with sales."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                <th className="px-6 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("ingredientName")}
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("expectedUsage") ?? "Expected Usage"}
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("actualUsage") ?? "Actual Usage"}
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("variance")} %
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const actual = actualEdits[e.ingredient_id] ?? e.actual_usage ?? "0";
                const variance = computeVariance(e.theoretical_usage, actual);
                const isOveruse = variance !== null && variance > 0;
                return (
                  <tr
                    key={`${e.ingredient_id}-${e.date}`}
                    className={`border-b border-slate-100 dark:border-slate-700 ${
                      isOveruse ? "bg-red-50 dark:bg-red-900/20" : ""
                    }`}
                  >
                    <td className="px-6 py-3">
                      <span className="font-medium text-slate-800 dark:text-white">
                        {e.ingredient_name_ar || e.ingredient_name}
                      </span>
                      {e.serial_code && (
                        <span className="ml-2 font-mono text-xs text-slate-500">
                          {e.serial_code}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                      {e.theoretical_usage}
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={actual}
                        onChange={(ev) => handleActualChange(e.ingredient_id, ev.target.value)}
                        className="w-28 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      />
                    </td>
                    <td className="px-6 py-3">
                      {variance !== null ? (
                        <span
                          className={
                            isOveruse
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : "text-slate-600 dark:text-slate-300"
                          }
                        >
                          {variance > 0 ? "+" : ""}
                          {variance}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
