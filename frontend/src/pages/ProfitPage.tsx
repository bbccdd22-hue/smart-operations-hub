/**
 * Financials / Profit – Total Revenue (Foodics) vs Total COGS, Gross Profit + Cost Management.
 * Route: /profit-dashboard
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format, subDays } from "date-fns";
import {
  fetchProfitSummary,
  fetchIngredients,
  fetchBranches,
  updateIngredient,
  type ProfitSummary,
  type ManageIngredient,
} from "../lib/api";
import { sar } from "../components/KPICard";

export default function ProfitPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Array<{ id: number; name: string; name_ar?: string }>>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [summary, setSummary] = useState<ProfitSummary | null>(null);
  const [ingredients, setIngredients] = useState<ManageIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [costSaving, setCostSaving] = useState<number | null>(null);
  const [costEdits, setCostEdits] = useState<Record<number, string>>({});

  const loadBranches = useCallback(async () => {
    const list = await fetchBranches();
    setBranches(list);
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchProfitSummary({
        branch_id: branchId !== "" ? branchId : undefined,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setSummary(s);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, dateFrom, dateTo]);

  const loadIngredients = useCallback(async () => {
    const list = await fetchIngredients();
    setIngredients(list);
    setCostEdits({});
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  const handleCostChange = (id: number, value: string) => {
    setCostEdits((e) => ({ ...e, [id]: value }));
  };

  const handleSaveCost = async (id: number) => {
    const val = costEdits[id];
    if (val === undefined) return;
    const num = parseFloat(val);
    if (Number.isNaN(num) && val !== "") return;
    setCostSaving(id);
    try {
      await updateIngredient(id, {
        unit_cost: val === "" || Number.isNaN(num) ? null : num,
      });
      setCostEdits((e) => {
        const next = { ...e };
        delete next[id];
        return next;
      });
      await loadIngredients();
      await loadSummary();
    } catch {
      // ignore
    } finally {
      setCostSaving(null);
    }
  };

  const totalSales = parseFloat(summary?.total_sales ?? "0");
  const totalCost = parseFloat(summary?.total_cogs ?? "0");
  const netProfit = parseFloat(summary?.gross_profit ?? "0");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          {t("financialDashboard")}
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
          <button
            type="button"
            onClick={() => {
              const d = format(new Date(), "yyyy-MM-dd");
              setDateFrom(d);
              setDateTo(d);
            }}
            className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white"
          >
            {t("today")}
          </button>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
          <button
            onClick={loadSummary}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? t("loading") ?? "Loading..." : t("refresh") ?? "Refresh"}
          </button>
        </div>
      </div>

      {/* Big Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("todaysSales") ?? "Today's Sales"}
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-800 dark:text-white">
            {loading ? "—" : sar(totalSales)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("totalIngredientsCost") ?? "Total Ingredients Cost"}
          </div>
          <div className="mt-2 text-3xl font-bold text-rose-600 dark:text-rose-400">
            {loading ? "—" : sar(totalCost)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("estimatedProfit") ?? "Estimated Profit"}
          </div>
          <div className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {loading ? "—" : sar(netProfit)}
          </div>
        </div>
      </div>

      {/* Cost Management Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {t("costManagement") ?? "Cost Management"}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("costManagementDesc") ?? "Set purchase price (SAR per base unit) for ingredients"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                <th className="px-6 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("code") ?? "Code"}
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("ingredientName")}
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("unitCost") ?? "Unit Cost (SAR)"}
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("action") ?? "Action"}
                </th>
              </tr>
            </thead>
            <tbody>
              {ingredients
                .filter((i) => ["RM-001", "RM-002", "RM-003", "RM-020"].includes(i.serial_code))
                .concat(ingredients.filter((i) => !["RM-001", "RM-002", "RM-003", "RM-020"].includes(i.serial_code)))
                .map((ing) => {
                  const editVal = costEdits[ing.id] ?? ing.unit_cost ?? "";
                  const isDirty = editVal !== (ing.unit_cost ?? "");
                  return (
                    <tr
                      key={ing.id}
                      className="border-b border-slate-100 dark:border-slate-700"
                    >
                      <td className="px-6 py-3 font-mono text-sm text-slate-600 dark:text-slate-300">
                        {ing.serial_code || "—"}
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-slate-800 dark:text-white">
                          {ing.name_ar || ing.name_en}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editVal}
                          onChange={(e) => handleCostChange(ing.id, e.target.value)}
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="px-6 py-3">
                        {isDirty && (
                          <button
                            onClick={() => handleSaveCost(ing.id)}
                            disabled={costSaving === ing.id}
                            className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {costSaving === ing.id ? "..." : t("save") ?? "Save"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
