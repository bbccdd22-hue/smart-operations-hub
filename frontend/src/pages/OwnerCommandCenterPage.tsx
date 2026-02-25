/**
 * لوحة تحكم المالك الذكية – Owner's Command Center
 * KPI، رقابة لحظية، رسوم بيانية، فلاتر ذكية.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  fetchCommandCenter,
  fetchBrands,
  fetchBranches,
  type CommandCenterData,
  type Brand,
  type Branch,
} from "../lib/api";
import UnifiedFilterSelect from "../components/UnifiedFilterSelect";
import KPICard, { sar } from "../components/KPICard";

function formatDate(d: Date, locale?: string) {
  return format(d, "yyyy-MM-dd", { locale: locale === "ar" ? ar : undefined });
}

export default function OwnerCommandCenterPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const isRTL = i18n.language === "ar";

  const filterTriggerClass = dark
    ? "border border-white/20 bg-white/10 text-white hover:bg-white/15"
    : "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100";
  const canAccess =
    user?.username === "SAIF" ||
    user?.role === "owner" ||
    user?.role === "general_manager" ||
    !!user?.permissions?.perm_full_system_access;

  const [data, setData] = useState<CommandCenterData | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterDate, setFilterDate] = useState(formatDate(new Date()));
  const [filterBrand, setFilterBrand] = useState<string | "">("");
  const [filterBranch, setFilterBranch] = useState<number | "">("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof fetchCommandCenter>[0] = { date: filterDate };
      if (filterBrand) params.brand = filterBrand;
      if (filterBranch !== "") params.branch_id = filterBranch;
      const res = await fetchCommandCenter(params);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterBrand, filterBranch]);

  useEffect(() => {
    if (!user || !canAccess) {
      navigate("/admin-hub", { replace: true });
      return;
    }
  }, [user, canAccess, navigate]);

  useEffect(() => {
    fetchBrands().then(setBrands);
  }, []);

  /** الفروع تُجلب حسب البراند المحدد فقط (تتابع براند → فرع) */
  useEffect(() => {
    if (!filterBrand) {
      setBranches([]);
      setFilterBranch("");
      return;
    }
    fetchBranches(filterBrand)
      .then((b) => setBranches(b.filter((x) => (x as { branch_code?: string }).branch_code !== "IN_TRANSIT")))
      .catch(() => setBranches([]));
    setFilterBranch("");
  }, [filterBrand]);

  useEffect(() => {
    if (!user || !canAccess) return;
    loadData();
  }, [loadData, user, canAccess]);

  if (!user || !canAccess) return null;

  return (
    <div
      className={`min-h-screen px-4 py-6 ${dark ? "bg-slate-900/95 text-white" : "bg-slate-50 text-slate-900"}`}
    >
      <div className="mx-auto max-w-7xl">
        {/* Header + Filters */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/admin-hub"
              className={`text-sm ${dark ? "text-white/60 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              ← {t("adminDashboard")}
            </Link>
            <h1 className="mt-1 text-2xl font-bold">لوحة تحكم المالك</h1>
            <p className={`mt-0.5 text-sm ${dark ? "text-white/50" : "text-slate-500"}`}>مؤشرات، رقابة، وتحليلات</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={`rounded-lg border px-3 py-2 text-sm ${dark ? "border-white/20 bg-white/10 text-white" : "border-slate-200 bg-slate-50 text-slate-800"}`}
            />
            <UnifiedFilterSelect
              mode="brand"
              items={brands}
              selected={filterBrand}
              onChange={setFilterBrand}
              selectionMode="single"
              label=""
              placeholder={t("all") ?? "الكل"}
              triggerClassName={filterTriggerClass}
            />
            <UnifiedFilterSelect
              mode="branch"
              items={branches}
              selected={filterBranch}
              onChange={setFilterBranch}
              selectionMode="single"
              label=""
              placeholder={t("all") ?? "الكل"}
              triggerClassName={filterTriggerClass}
              disabled={!filterBrand}
            />
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "..." : t("refreshData") ?? "تحديث"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {/* KPI Cards */}
            <div className="xl:col-span-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KPICard
                label={t("dailySalesReport") ?? "المبيعات اليوم"}
                value={data.kpis.daily_sales_today}
                formatter={(n) => sar(n)}
                previousValue={data.kpis.daily_sales_yesterday}
                delay={0}
              />
              <KPICard
                label={t("inTransitValue") ?? "قيمة المخزون قيد النقل"}
                value={data.kpis.in_transit_value_sar}
                formatter={(n) => sar(n)}
                delay={100}
              />
              <KPICard
                label={t("errorAlerts") ?? "تنبيهات الأخطاء"}
                value={data.kpis.errors_unresolved_count}
                delay={200}
              />
              <KPICard
                label={t("shortageAlerts") ?? "تنبيهات العجز"}
                value={data.kpis.negative_stock_count}
                delay={300}
              />
            </div>

            {/* الرقابة اللحظية */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5">
              <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold dark:border-white/10">
                {t("pendingTransfers") ?? "تحويلات معلقة"}
              </h2>
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                <table className="min-w-[320px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-right dark:border-white/10 dark:bg-white/5">
                      <th className="px-3 py-2">من</th>
                      <th className="px-3 py-2">إلى</th>
                      <th className="px-3 py-2">القيمة</th>
                      <th className="px-3 py-2">الوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pending_transfers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-white/50">
                          لا توجد تحويلات معلقة
                        </td>
                      </tr>
                    ) : (
                      data.pending_transfers.map((tr) => (
                        <tr key={tr.id} className="border-b border-slate-100 dark:border-white/5">
                          <td className="px-3 py-2">{tr.from_branch_name}</td>
                          <td className="px-3 py-2">{tr.to_branch_name}</td>
                          <td className="px-3 py-2">{sar(tr.value_sar)}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-white/70">
                            {tr.requested_at
                              ? new Date(tr.requested_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {data.pending_transfers.length > 0 && (
                <Link
                  to="/stock-transfers"
                  className="block border-t border-slate-200 px-4 py-2 text-center text-sm text-emerald-600 hover:bg-slate-50 dark:border-white/10 dark:text-emerald-400 dark:hover:bg-white/5"
                >
                  عرض الكل →
                </Link>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5">
              <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold dark:border-white/10">
                {t("latestErrors") ?? "أحدث الأخطاء"}
              </h2>
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                <table className="min-w-[320px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-right dark:border-white/10 dark:bg-white/5">
                      <th className="px-3 py-2">النوع</th>
                      <th className="px-3 py-2">الرسالة</th>
                      <th className="px-3 py-2">الوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latest_errors.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-500 dark:text-white/50">
                          لا توجد أخطاء
                        </td>
                      </tr>
                    ) : (
                      data.latest_errors.map((e) => (
                        <tr key={e.id} className="border-b border-slate-100 dark:border-white/5">
                          <td className="px-3 py-2">
                            <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs text-rose-400">
                              {e.error_type}
                            </span>
                          </td>
                          <td className="max-w-[180px] truncate px-3 py-2" title={e.message}>
                            {e.message || "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-white/70">
                            {e.created_at ? new Date(e.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {data.latest_errors.length > 0 && (
                <Link
                  to="/admin-hub/error-logs"
                  className="block border-t border-slate-200 px-4 py-2 text-center text-sm text-emerald-600 hover:bg-slate-50 dark:border-white/10 dark:text-emerald-400 dark:hover:bg-white/5"
                >
                  عرض الكل →
                </Link>
              )}
            </div>

            {/* مبيعات مقابل هدر */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5 lg:col-span-2">
              <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold dark:border-white/10">
                {t("salesVsWaste") ?? "المبيعات مقابل الهدر"}
              </h2>
              <div className="p-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.sales_vs_waste_by_branch}
                      layout="vertical"
                      margin={{ top: 8, right: 16, left: 80, bottom: 8 }}
                    >
                      <XAxis
                        type="number"
                        stroke={dark ? "#94a3b8" : "#64748b"}
                        fontSize={11}
                        tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                      />
                      <YAxis
                        type="category"
                        dataKey="branch_name"
                        stroke={dark ? "#94a3b8" : "#64748b"}
                        fontSize={11}
                        width={70}
                        tick={{ fill: dark ? "#94a3b8" : "#64748b" }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(148,163,184,0.3)",
                          background: dark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.98)",
                          color: dark ? "#f1f5f9" : "#1e293b",
                        }}
                        formatter={(v, name) => [sar(Number(v ?? 0)), String(name) === "sales" ? "مبيعات" : "هدر"]}
                        labelFormatter={(l) => `الفرع: ${l}`}
                      />
                      <Legend />
                      <Bar dataKey="sales" name="مبيعات" fill="#00ffcc" fillOpacity={0.7} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="waste_sar" name="هدر (SAR)" fill="#f43f5e" fillOpacity={0.7} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* أصناف منخفضة */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5 lg:col-span-2">
              <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold dark:border-white/10">
                {t("lowStockItems") ?? "أصناف معرضة للنفاذ"}
              </h2>
              <div className="overflow-x-auto p-4" style={{ WebkitOverflowScrolling: "touch" }}>
                {data.low_stock_items.length === 0 ? (
                  <p className="py-8 text-center text-slate-500 dark:text-white/50">لا توجد أصناف منخفضة</p>
                ) : (
                  <div className="space-y-3">
                    {data.low_stock_items.map((item, i) => (
                      <div
                        key={`${item.ingredient_name}-${item.branch_name}-${i}`}
                        className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 dark:bg-white/5"
                      >
                        <div>
                          <span className="font-medium">
                            {isRTL && item.ingredient_name_ar ? item.ingredient_name_ar : item.ingredient_name}
                          </span>
                          <span className="ml-2 text-sm text-slate-500 dark:text-white/60">({item.branch_name})</span>
                        </div>
                        <div className={`font-mono text-sm ${item.on_hand < 0 ? "text-rose-400" : "text-amber-400"}`}>
                          الرصيد: {item.on_hand}
                          {item.reorder_level > 0 && ` / حد إعادة: ${item.reorder_level}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
