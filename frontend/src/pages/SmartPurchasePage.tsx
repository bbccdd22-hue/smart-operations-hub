/**
 * التنبؤ الذكي للشراء – اقتراح كميات الشراء بناءً على استهلاك الكاشير
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchPurchaseSuggestions, fetchBranches } from "../lib/api";
import type { Branch, PurchaseSuggestion } from "../lib/api";

export default function SmartPurchasePage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [horizonDays, setHorizonDays] = useState(7);
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBranches()
      .then((b) => setBranches(b))
      .catch(() => setBranches([]));
  }, []);

  const load = useCallback(async () => {
    if (branchId === "") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPurchaseSuggestions({
        branch_id: branchId,
        horizon_days: horizonDays,
        lookback_days: 90,
      });
      setSuggestions(res.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, horizonDays]);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="mx-auto max-w-6xl space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
        {t("smartPurchase") ?? "التنبؤ الذكي للشراء"}
      </h1>
      <p className="text-slate-600 dark:text-slate-400">
        {t("smartPurchaseDesc") ??
          "اقتراح كميات الشراء بناءً على استهلاك الكاشير (مبيعات المنتجات)"}
      </p>

      <div className="flex flex-wrap gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div>
          <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
            {t("branch") ?? "الفرع"}
          </label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value="">--</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
            {t("horizonDays") ?? "أيام التنبؤ"}
          </label>
          <select
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value={3}>3 {t("days") ?? "أيام"}</option>
            <option value={7}>7 {t("days") ?? "أيام"}</option>
            <option value={14}>14 {t("days") ?? "أيام"}</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={load}
            disabled={!branchId || loading}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "..." : t("getSuggestions") ?? "عرض الاقتراحات"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      )}

      {suggestions.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <table className="min-w-[500px] w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                <th className="px-4 py-3 font-medium">{t("ingredient") ?? "مكوّن"}</th>
                <th className="px-4 py-3 font-medium">{t("required") ?? "مطلوب"}</th>
                <th className="px-4 py-3 font-medium">{t("onHand") ?? "رصيد"}</th>
                <th className="px-4 py-3 font-medium">{t("suggestedPurchase") ?? "اقتراح الشراء"}</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <tr key={s.ingredient_id} className="border-b border-slate-100 dark:border-slate-700/50">
                  <td className="px-4 py-3">
                    {isRTL && s.ingredient_name_ar ? s.ingredient_name_ar : s.ingredient_name}
                    {s.serial_code && (
                      <span className="ml-2 text-xs text-slate-500">
                        {s.serial_code}
                      </span>
                    )}
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {(s.display_unit_source === "package"
                        ? (isRTL ? "الوحدة الافتراضية: عبوة" : "Default unit: Package")
                        : (isRTL ? "الوحدة الافتراضية: أساسية" : "Default unit: Base"))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{s.required_qty} {s.unit_code}</div>
                    {s.display_unit_source === "package" && s.required_base_qty && s.base_unit_code && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {isRTL ? "الأساس: " : "Base: "}
                        {s.required_base_qty} {s.base_unit_code}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>{s.on_hand} {s.unit_code}</div>
                    {s.display_unit_source === "package" && s.on_hand_base_qty && s.base_unit_code && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {isRTL ? "الأساس: " : "Base: "}
                        {s.on_hand_base_qty} {s.base_unit_code}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                    <div>{s.suggested_purchase_qty} {s.unit_code}</div>
                    {s.display_unit_source === "package" && s.suggested_purchase_base_qty && s.base_unit_code && (
                      <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        {isRTL ? "الأساس: " : "Base: "}
                        {s.suggested_purchase_base_qty} {s.base_unit_code}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && branchId && suggestions.length === 0 && !error && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-slate-600 dark:text-slate-400">
            {t("noSuggestions") ??
              "لا توجد اقتراحات – تأكد من رفع مبيعات المنتجات (Product Sales) للفرع"}
          </p>
        </div>
      )}
    </div>
  );
}
