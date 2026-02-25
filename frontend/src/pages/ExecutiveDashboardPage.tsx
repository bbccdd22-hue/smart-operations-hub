/**
 * لوحة تحكم المالك النهائية – Executive Dashboard
 * صافي الربح، تنبيهات الأمان، تقارير تحليلية
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format, subDays } from "date-fns";
import { ar } from "date-fns/locale";
import UltimateDateRangePicker from "../components/UltimateDateRangePicker";
import UnifiedFilterSelect from "../components/UnifiedFilterSelect";
import type { DateRange } from "../contexts/DateRangeContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  fetchExecutiveDashboard,
  fetchBrands,
  fetchBranches,
  type ExecutiveDashboardData,
  type Brand,
  type Branch,
} from "../lib/api";
import KPICard, { sar } from "../components/KPICard";

function formatDate(d: Date, locale?: string) {
  return format(d, "yyyy-MM-dd", { locale: locale === "ar" ? ar : undefined });
}

export default function ExecutiveDashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const isRTL = i18n.language === "ar";
  const canAccess =
    user?.username === "SAIF" ||
    user?.role === "owner" ||
    user?.role === "general_manager" ||
    !!user?.permissions?.perm_full_system_access;

  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaultTo = new Date();
  const defaultFrom = subDays(defaultTo, 30);
  const [dateRange, setDateRange] = useState<DateRange>({ from: defaultFrom, to: defaultTo });
  const dateFrom = format(dateRange.from, "yyyy-MM-dd");
  const dateTo = format(dateRange.to, "yyyy-MM-dd");
  const [filterBrand, setFilterBrand] = useState<string | "">("");
  const [filterBranch, setFilterBranch] = useState<number | "">("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof fetchExecutiveDashboard>[0] = {
        date_from: dateFrom,
        date_to: dateTo,
      };
      if (filterBrand) params.brand = filterBrand;
      if (filterBranch !== "") params.branch_id = filterBranch;
      const res = await fetchExecutiveDashboard(params);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, filterBrand, filterBranch]);

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
      .then(setBranches)
      .catch(() => setBranches([]));
    setFilterBranch("");
  }, [filterBrand]);

  useEffect(() => {
    if (!user || !canAccess) return;
    loadData();
  }, [loadData, user, canAccess]);

  if (!user || !canAccess) return null;

  const totalNetProfit =
    data?.net_profit_series?.reduce((s, d) => s + (d.net_profit || 0), 0) ?? 0;
  const avgNetProfit =
    (data?.net_profit_series?.length ?? 0) > 0
      ? totalNetProfit / (data?.net_profit_series?.length ?? 1)
      : 0;

  const filterTriggerClass = dark
    ? "border border-white/20 bg-white/10 text-white hover:bg-white/15"
    : "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100";

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`min-h-screen px-4 py-6 ${dark ? "bg-slate-900/95 text-white" : "bg-slate-50 text-slate-900"}`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/admin-hub"
              className={`text-sm ${dark ? "text-white/60 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              ← {t("adminDashboard")}
            </Link>
            <h1 className="mt-1 text-2xl font-bold">
              {t("executiveDashboard") ?? "لوحة تحكم المالك"}
            </h1>
            <p className={`mt-0.5 text-sm ${dark ? "text-white/50" : "text-slate-500"}`}>
              {t("executiveDashboardDesc") ?? "صافي الربح، تنبيهات، تقارير تحليلية"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <UltimateDateRangePicker value={dateRange} onChange={setDateRange} triggerDark={dark} />
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
          <div className="space-y-6">
            {/* KPI: متوسط صافي الربح */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KPICard
                label={t("avgNetProfit") ?? "متوسط صافي الربح اليومي"}
                value={avgNetProfit}
                formatter={(n) => sar(n)}
                delay={0}
              />
              <KPICard
                label={t("totalNetProfit") ?? "إجمالي صافي الربح"}
                value={totalNetProfit}
                formatter={(n) => sar(n)}
                delay={100}
              />
              <KPICard
                label={t("safetyAlerts") ?? "تنبيهات الأمان"}
                value={
                  (data.safety_alerts.stock_shortage?.length || 0) +
                  (data.safety_alerts.late_attendance?.length || 0) +
                  (data.safety_alerts.pending_purchase_orders?.length || 0)
                }
                delay={200}
              />
            </div>

            {/* رسم صافي الربح */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5">
              <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold dark:border-white/10">
                {t("netProfitChart") ?? "صافي الربح (مبيعات - تكاليف - رواتب - إهلاك)"}
              </h2>
              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.net_profit_series} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={dark ? "rgba(255,255,255,0.1)" : "rgba(148,163,184,0.3)"}
                    />
                    <XAxis
                      dataKey="date"
                      stroke={dark ? "#94a3b8" : "#64748b"}
                      fontSize={11}
                      tick={{ fill: dark ? "#94a3b8" : "#64748b" }}
                    />
                    <YAxis
                      stroke={dark ? "#94a3b8" : "#64748b"}
                      fontSize={11}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                      tick={{ fill: dark ? "#94a3b8" : "#64748b" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(148,163,184,0.3)",
                        background: dark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.98)",
                        color: dark ? "#f1f5f9" : "#1e293b",
                      }}
                      formatter={(v: number | string | undefined) => [sar(Number(v ?? 0)), ""]}
                      labelFormatter={(l) => l}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="net_profit" name={t("netProfit") ?? "صافي الربح"} stroke="#00ffcc" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="sales" name={t("sales") ?? "المبيعات"} stroke="#60a5fa" strokeWidth={1} dot={false} strokeOpacity={0.6} />
                    <Line type="monotone" dataKey="gross_profit" name={t("grossProfit") ?? "الربح الإجمالي"} stroke="#34d399" strokeWidth={1} dot={false} strokeOpacity={0.6} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* تنبيهات الأمان */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5">
                <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold text-rose-600 dark:border-white/10 dark:text-rose-400">
                  {t("stockShortage") ?? "عجز مخزني"}
                </h2>
                <div className="max-h-48 overflow-y-auto p-4">
                  {!data.safety_alerts.stock_shortage?.length ? (
                    <p className="text-sm text-slate-500 dark:text-white/50">{t("none") ?? "لا يوجد"}</p>
                  ) : (
                    <div className="space-y-2">
                      {data.safety_alerts.stock_shortage.slice(0, 5).map((s, i) => (
                        <div key={i} className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-white/5">
                          <span>{isRTL && s.ingredient_name_ar ? s.ingredient_name_ar : s.ingredient_name}</span>
                          <span className="ml-2 text-slate-500 dark:text-white/60">({s.branch_name})</span>
                          <span className={`ml-2 font-mono ${s.on_hand < 0 ? "text-rose-400" : "text-amber-400"}`}>
                            {s.on_hand} / {s.reorder_level}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5">
                <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold text-amber-600 dark:border-white/10 dark:text-amber-400">
                  {t("lateAttendance") ?? "تأخير حضور"}
                </h2>
                <div className="max-h-48 overflow-y-auto p-4">
                  {!data.safety_alerts.late_attendance?.length ? (
                    <p className="text-sm text-slate-500 dark:text-white/50">{t("none") ?? "لا يوجد"}</p>
                  ) : (
                    <div className="space-y-2">
                      {data.safety_alerts.late_attendance.slice(0, 5).map((a, i) => (
                        <div key={i} className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-white/5">
                          <span>{a.employee_name}</span>
                          <span className="ml-2 text-slate-500 dark:text-white/60">({a.branch_name})</span>
                          {a.clock_in && <span className="ml-2 text-amber-400">{a.clock_in}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5">
                <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold text-sky-600 dark:border-white/10 dark:text-sky-400">
                  {t("pendingPurchaseOrders") ?? "طلبات شراء معلقة"}
                </h2>
                <div className="max-h-48 overflow-y-auto p-4">
                  {!data.safety_alerts.pending_purchase_orders?.length ? (
                    <p className="text-sm text-slate-500 dark:text-white/50">{t("none") ?? "لا يوجد"}</p>
                  ) : (
                    <div className="space-y-2">
                      {data.safety_alerts.pending_purchase_orders.slice(0, 5).map((p) => (
                        <div key={p.id} className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-white/5">
                          <span>{p.request_number}</span>
                          <span className="ml-2 text-slate-500 dark:text-white/60">({p.branch_name})</span>
                          <span className="ml-2 text-sky-400">{p.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* جداول تحليلية */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5">
                <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold dark:border-white/10">
                  {t("topProfitableProducts") ?? "أكثر المنتجات ربحية"}
                </h2>
                <div className="overflow-x-auto p-4">
                  {!data.top_profitable_products?.length ? (
                    <p className="py-8 text-center text-slate-500 dark:text-white/50">{t("noData") ?? "لا توجد بيانات"}</p>
                  ) : (
                    <table className="min-w-[400px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-right dark:border-white/10">
                          <th className="py-2 text-left">{t("product") ?? "المنتج"}</th>
                          <th className="px-2 py-2">{t("revenue") ?? "الإيرادات"}</th>
                          <th className="px-2 py-2">{t("profit") ?? "الربح"}</th>
                          <th className="px-2 py-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_profitable_products.map((p, i) => (
                          <tr key={i} className="border-b border-slate-100 dark:border-white/5">
                            <td className="py-2 text-left">{p.product_name}</td>
                            <td className="px-2 py-2 text-right">{sar(p.revenue)}</td>
                            <td className={`px-2 py-2 text-right ${p.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{sar(p.profit)}</td>
                            <td className="px-2 py-2 text-right">{p.margin_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5">
                <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold dark:border-white/10">
                  {t("branchEfficiency") ?? "أكثر الفروع كفاءة"}
                </h2>
                <div className="overflow-x-auto p-4">
                  {!data.branch_efficiency?.length ? (
                    <p className="py-8 text-center text-slate-500 dark:text-white/50">{t("noData") ?? "لا توجد بيانات"}</p>
                  ) : (
                    <table className="min-w-[400px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-right dark:border-white/10">
                          <th className="py-2 text-left">{t("branch") ?? "الفرع"}</th>
                          <th className="px-2 py-2">{t("sales") ?? "المبيعات"}</th>
                          <th className="px-2 py-2">{t("grossProfit") ?? "الربح الإجمالي"}</th>
                          <th className="px-2 py-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.branch_efficiency.map((b) => (
                          <tr key={b.branch_id} className="border-b border-slate-100 dark:border-white/5">
                            <td className="py-2 text-left">{b.branch_name}</td>
                            <td className="px-2 py-2 text-right">{sar(b.sales)}</td>
                            <td className="px-2 py-2 text-right text-emerald-400">{sar(b.gross_profit)}</td>
                            <td className="px-2 py-2 text-right">{b.margin_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
