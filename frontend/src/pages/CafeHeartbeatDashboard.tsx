/**
 * Cafe Heartbeat Dashboard – Live command center with traffic light UI.
 * Route: /dashboard/heartbeat
 * Auto-refresh every 60 seconds.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchHeartbeat, fetchBranches, type HeartbeatData } from "../lib/api";
import { useDateRange } from "../contexts/DateRangeContext";
import ReportDateFilter from "../components/ReportDateFilter";
import { sar } from "../components/KPICard";

function progressColor(pct: number): "green" | "yellow" | "red" {
  if (pct < 50) return "green";
  if (pct <= 80) return "yellow";
  return "red";
}

function basketColor(pct: number): "green" | "yellow" | "red" {
  if (pct >= 30) return "green";
  if (pct >= 15) return "yellow";
  return "red";
}

export default function CafeHeartbeatDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState<HeartbeatData | null>(null);
  const [branches, setBranches] = useState<Array<{ id: number; name: string; name_ar?: string }>>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const { dateFrom } = useDateRange();

  const loadBranches = useCallback(async () => {
    const list = await fetchBranches();
    setBranches(list);
  }, []);

  const loadHeartbeat = useCallback(async () => {
    try {
      const d = await fetchHeartbeat({
        branch_id: branchId !== "" ? branchId : undefined,
        date: dateFrom,
      });
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, dateFrom]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadHeartbeat();
  }, [loadHeartbeat]);

  useEffect(() => {
    const id = setInterval(loadHeartbeat, 60_000);
    return () => clearInterval(id);
  }, [loadHeartbeat]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl bg-slate-900/80 text-slate-400">
        {t("loading")}
      </div>
    );
  }

  const br = data?.burn_rate;
  const sm = data?.sales_mix;
  const fc = data?.food_to_coffee_ratio;
  const wm = data?.waste_monitor;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">
          {t("cafeHeartbeat") ?? "Cafe Heartbeat Dashboard"}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <ReportDateFilter />
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
          >
            <option value="">{t("all")} {t("branch")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name_ar || b.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            {t("livePulse") ?? "Live Pulse"} • {data?.date ?? "—"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Live Burn Rate */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            {t("liveBurnRate") ?? "Live Burn Rate"}
          </h2>
          {br && (
            <div className="space-y-6">
              {(["milk", "beans"] as const).map((key) => {
                const item = br[key];
                const pct = item.pct;
                const color = progressColor(pct);
                return (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-300">{item.label}</span>
                      <span className="font-mono text-white">
                        {item.used} / {item.daily_prep} ({pct}%)
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full transition-all duration-500 ${
                          color === "green"
                            ? "bg-emerald-500"
                            : color === "yellow"
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sales Mix Hot vs Cold */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            {t("liveSalesMix") ?? "Live Sales Mix"}
          </h2>
          {sm && (
            <div className="flex items-center gap-6">
              <div
                className="relative h-40 w-40 shrink-0"
                style={{
                  background: `conic-gradient(#f97316 0deg ${sm.hot_pct * 3.6}deg, #0ea5e9 ${sm.hot_pct * 3.6}deg 360deg)`,
                  borderRadius: "50%",
                }}
              >
                <div className="absolute inset-3 rounded-full bg-slate-900" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {sm.hot_pct > sm.cold_pct
                      ? (t("blackCoffeeDay") ?? "Black Coffee Day")
                      : (t("coldDrinksDay") ?? "Cold Drinks Day")}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-500" />
                  <span className="text-slate-300">
                    {t("hot") ?? "Hot"}: {sm.hot_pct}% ({sm.hot_qty})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-sky-500" />
                  <span className="text-slate-300">
                    {t("cold") ?? "Cold"}: {sm.cold_pct}% ({sm.cold_qty})
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Food-to-Coffee Ratio */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            {t("foodToCoffeeRatio") ?? "Food-to-Coffee Ratio"}
          </h2>
          {fc && (
            <div>
              <div className="mb-2 flex items-baseline gap-2">
                <span
                  className={`text-3xl font-bold ${
                    basketColor(fc.pct) === "green"
                      ? "text-emerald-400"
                      : basketColor(fc.pct) === "yellow"
                        ? "text-amber-400"
                        : "text-red-400"
                  }`}
                >
                  {fc.pct}%
                </span>
                <span className="text-slate-400">
                  {basketColor(fc.pct) === "green"
                    ? (t("excellentUpselling") ?? "Excellent upselling")
                    : basketColor(fc.pct) === "yellow"
                      ? (t("needsAttention") ?? "Needs attention")
                      : (t("staffTrainingRequired") ?? "Staff training required")}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {t("foodRevenueOfTotal") ?? "Food/Bakery revenue"}: {sar(parseFloat(fc.food_revenue))} / {sar(parseFloat(fc.total_revenue))}
              </p>
            </div>
          )}
        </div>

        {/* Waste Monitor */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            {t("wasteMonitor") ?? "Waste Monitor"}
          </h2>
          {wm && (
            <div className="flex items-center gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${
                  wm.exceeds_tolerance ? "animate-pulse bg-red-500/30" : "bg-slate-700"
                }`}
              >
                <span
                  className={`text-2xl ${wm.exceeds_tolerance ? "text-red-400" : "text-slate-400"}`}
                >
                  {wm.exceeds_tolerance ? "⚠" : "✓"}
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {sar(parseFloat(wm.theoretical_waste_sar))}
                </div>
                <div className="text-sm text-slate-400">
                  {t("estimatedWaste") ?? "Estimated waste"} • {wm.variance_pct}% {t("variance")}
                  {wm.exceeds_tolerance && (
                    <span className="ml-2 text-red-400">
                      {`(>${wm.tolerance_pct}% ${t("tolerance")})`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-center text-xs text-slate-500">
        {t("heartbeatRefreshNote") ?? "Data refreshes every 60 seconds"} • {t("progressThroughDay") ?? "Progress through day"}: {data?.progress_through_day ?? 0}%
      </div>
    </div>
  );
}
