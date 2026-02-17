import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchForecast, fetchBranches, type ForecastDay, type Branch } from "../lib/api";

function sar(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);
}

function BarChart({ data, maxVal }: { data: ForecastDay[]; maxVal: number }) {
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = maxVal > 0 ? (d.predicted_sales / maxVal) * 100 : 0;
        return (
          <div key={d.date} className="flex items-center gap-3 text-sm">
            <div className="w-24 shrink-0 text-slate-600 dark:text-slate-400">
              {new Date(d.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-8 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-lg bg-emerald-500 dark:bg-emerald-600 transition-all"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
            <div className="w-20 shrink-0 text-right font-medium tabular-nums">{sar(d.predicted_sales)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function PredictiveDashboardPage() {
  const { t } = useTranslation();
  const [forecast, setForecast] = useState<{ next_7_days: ForecastDay[]; next_30_days: ForecastDay[]; warnings: Array<{ message?: string }> } | null>(null);
  const [branchId, setBranchId] = useState<number | "">("");
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    fetchBranches().then(setBranches);
  }, []);

  useEffect(() => {
    fetchForecast(branchId === "" ? undefined : branchId).then(setForecast);
  }, [branchId]);

  const max7 = forecast?.next_7_days?.length
    ? Math.max(...forecast.next_7_days.map((d) => d.predicted_sales), 1)
    : 1;
  const max30 = forecast?.next_30_days?.length
    ? Math.max(...forecast.next_30_days.map((d) => d.predicted_sales), 1)
    : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Predictive Dashboard</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight dark:text-white">
            Next 7 & 30 Days Forecast
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Based on archived daily sales (same-day-of-week average). Upload Excel reports for better accuracy.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600 dark:text-slate-400">Branch</span>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      </div>

      {forecast?.warnings?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          {forecast.warnings.map((w, i) => (
            <div key={i}>{w.message ?? "Data gap or missing history."}</div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Next 7 days</h2>
          <div className="mt-4">
            {forecast?.next_7_days?.length ? (
              <BarChart data={forecast.next_7_days} maxVal={max7} />
            ) : (
              <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No forecast data. Upload Daily Sales Excel to enable predictions.
              </div>
            )}
          </div>
        </section>
        <section className="glass-card rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Next 30 days</h2>
          <div className="mt-4">
            {forecast?.next_30_days?.length ? (
              <BarChart data={forecast.next_30_days} maxVal={max30} />
            ) : (
              <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No forecast data.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
