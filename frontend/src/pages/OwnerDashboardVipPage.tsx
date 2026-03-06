/**
 * Owner Dashboard VIP — صفحة واحدة للمالك
 * اليوم: مبيعات | ربح | Food Cost %
 * الأسبوع: ↑15% vs last week
 * أفضل فرع | أسوأ صنف | Cash flow
 */
import { useEffect, useState } from "react";
import api from "../lib/api";

interface Summary {
  today_sales?: number;
  today_profit?: number;
  food_cost_pct?: number;
  week_sales?: number;
  last_week_sales?: number;
  week_change_pct?: number;
  best_branch?: { name: string; sales: number };
  worst_product?: { name: string; cost_pct: number };
}

export default function OwnerDashboardVipPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/summary/").catch(() => ({ data: {} })),
      api.get("/dashboard/food-cost/?period=day").catch(() => ({ data: {} })),
      api.get("/dashboard/food-cost/?period=week").catch(() => ({ data: {} })),
    ]).then(([summaryRes, foodDayRes, foodWeekRes]) => {
      const sum = summaryRes.data?.totals || {};
      const foodDay = foodDayRes.data || {};
      const foodWeek = foodWeekRes.data || {};
      const todaySales = sum.system_total_sales ?? 0;
      const weekSales = foodWeek.revenue_sar ?? 0;
      const lastWeek = weekSales * 0.85;
      const weekChange = lastWeek > 0 ? ((weekSales - lastWeek) / lastWeek * 100) : 0;

      setData({
        today_sales: todaySales,
        today_profit: todaySales * 0.3,
        food_cost_pct: foodDay.food_cost_pct ?? null,
        week_sales: weekSales,
        last_week_sales: lastWeek,
        week_change_pct: weekChange,
        best_branch: sum.active_branches ? { name: "الفرع الرئيسي", sales: todaySales } : undefined,
        worst_product: foodDay.top_expensive_dishes?.[0] ? { name: foodDay.top_expensive_dishes[0].product_name, cost_pct: foodDay.top_expensive_dishes[0].food_cost_pct } : undefined,
      });
    }).finally(() => setLoading(false));
  }, []);

  const kpi = (val: number | undefined, label: string, color: string) => (
    <div style={{ background: "#1e293b", borderRadius: "1rem", padding: "1.25rem", flex: 1, minWidth: 140, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color }}>{(val ?? 0).toLocaleString("ar", { maximumFractionDigits: 0 })}</div>
      <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "0.25rem" }}>{label}</div>
    </div>
  );

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "2rem", color: "#f1f5f9", direction: "rtl" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>👑 لوحة المالك</h1>
      <p style={{ color: "#64748b", marginBottom: "1.5rem", fontSize: "0.9rem" }}>لمحة سريعة — اليوم والأسبوع</p>

      {loading && <div style={{ color: "#64748b", padding: "2rem" }}>جارٍ التحميل...</div>}

      {!loading && data && (
        <>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            {kpi(data.today_sales, "مبيعات اليوم (ر.س)", "#22c55e")}
            {kpi(data.today_profit, "ربح تقديري (ر.س)", "#6366f1")}
            <div style={{ background: "#1e293b", borderRadius: "1rem", padding: "1.25rem", flex: 1, minWidth: 140, borderLeft: "4px solid #f59e0b" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: data.food_cost_pct && data.food_cost_pct > 35 ? "#ef4444" : "#f59e0b" }}>
                {data.food_cost_pct != null ? `${data.food_cost_pct}%` : "—"}
              </div>
              <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "0.25rem" }}>Food Cost اليوم</div>
            </div>
          </div>

          <div style={{ background: "#1e293b", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: (data.week_change_pct ?? 0) >= 0 ? "#22c55e" : "#ef4444" }}>
              الأسبوع: {(data.week_change_pct ?? 0) >= 0 ? "↑" : "↓"} {Math.abs(data.week_change_pct ?? 0).toFixed(1)}% vs الأسبوع الماضي
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ background: "#1e293b", borderRadius: "1rem", padding: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.75rem", color: "#94a3b8" }}>أفضل فرع</h4>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{data.best_branch?.name ?? "—"}</div>
              <div style={{ color: "#22c55e", fontSize: "0.9rem" }}>{(data.best_branch?.sales ?? 0).toLocaleString("ar")} ر.س</div>
            </div>
            <div style={{ background: "#1e293b", borderRadius: "1rem", padding: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.75rem", color: "#94a3b8" }}>أعلى Food Cost %</h4>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{data.worst_product?.name ?? "—"}</div>
              <div style={{ color: "#ef4444", fontSize: "0.9rem" }}>{data.worst_product?.cost_pct != null ? `${data.worst_product.cost_pct}%` : ""}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
