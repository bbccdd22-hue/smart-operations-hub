/**
 * Category Analytics — /analytics/categories
 * مبيعات لكل فئة، مقارنة الفروع، ABC Analysis
 */
import { useEffect, useState } from "react";
import api from "../lib/api";

type Period = "day" | "week" | "month";

const CATEGORY_LABELS: Record<string, string> = {
  beverages: "مشروبات",
  meals: "وجبات",
  desserts: "حلويات",
  grocery: "بقالة",
  snacks: "سناكات",
  other: "أخرى",
};

export default function CategoryAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [compareBranches, setCompareBranches] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/dashboard/categories/?period=${period}&compare_branches=${compareBranches}`)
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period, compareBranches]);

  const cats = (data?.category_sales as Record<string, { pct: number; sar: number }>) || {};
  const abc = (data?.abc_analysis as Array<{ name: string; revenue_sar: number }>) || [];
  const branchCompare = (data?.branch_comparison as Array<Record<string, unknown>>) || [];

  const totalRev = (data?.total_revenue_sar as number) || 0;

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "2rem", color: "#f1f5f9", direction: "rtl" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>📊 تحليلات الفئات</h1>
      <p style={{ color: "#64748b", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        مبيعات حسب الفئة — مشروبات، وجبات، حلويات، بقالة
      </p>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {(["day", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: "0.5rem 1rem", borderRadius: "0.6rem", border: "none", cursor: "pointer",
              background: period === p ? "#6366f1" : "#1e293b", color: period === p ? "#fff" : "#94a3b8", fontWeight: period === p ? 700 : 400,
            }}
          >
            {p === "day" ? "اليوم" : p === "week" ? "الأسبوع" : "الشهر"}
          </button>
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#94a3b8", fontSize: "0.9rem" }}>
          <input type="checkbox" checked={compareBranches} onChange={(e) => setCompareBranches(e.target.checked)} />
          مقارنة الفروع
        </label>
      </div>

      {loading && <div style={{ color: "#64748b", padding: "2rem" }}>جارٍ التحميل...</div>}

      {!loading && data && (
        <>
          <div style={{ background: "#1e293b", borderRadius: "1rem", padding: "1.5rem", marginBottom: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem", color: "#94a3b8" }}>الإيراد الكلي: {totalRev.toLocaleString("ar")} ر.س</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "1rem" }}>
              {Object.entries(cats).map(([key, val]) => (
                <div key={key} style={{ textAlign: "center", padding: "0.75rem", background: "#0f172a", borderRadius: "0.75rem" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#6366f1" }}>{val?.pct ?? 0}%</div>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{CATEGORY_LABELS[key] || key}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{val?.sar?.toLocaleString("ar") ?? 0} ر.س</div>
                </div>
              ))}
            </div>
          </div>

          {branchCompare.length > 0 && (
            <div style={{ background: "#1e293b", borderRadius: "1rem", padding: "1.5rem", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: "0 0 1rem", color: "#94a3b8" }}>مقارنة الفروع</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ color: "#94a3b8" }}>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>الفرع</th>
                      {Object.keys(CATEGORY_LABELS).map((c) => (
                        <th key={c} style={{ padding: "0.5rem", textAlign: "right" }}>{CATEGORY_LABELS[c]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {branchCompare.map((row, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #334155" }}>
                        <td style={{ padding: "0.5rem" }}>{row.branch_name}</td>
                        {Object.keys(CATEGORY_LABELS).map((c) => (
                          <td key={c} style={{ padding: "0.5rem", color: "#f59e0b" }}>{(row[`${c}_pct`] as number)?.toFixed(1) ?? 0}%</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ background: "#1e293b", borderRadius: "1rem", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem", color: "#94a3b8" }}>ABC Analysis — Top 20 منتج (80% المبيعات)</h3>
            <table style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ color: "#94a3b8" }}>
                  <th style={{ padding: "0.5rem", textAlign: "right" }}>المنتج</th>
                  <th style={{ padding: "0.5rem", textAlign: "right" }}>الإيراد (ر.س)</th>
                </tr>
              </thead>
              <tbody>
                {abc.map((row, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #334155" }}>
                    <td style={{ padding: "0.5rem" }}>{row.name}</td>
                    <td style={{ padding: "0.5rem", color: "#22c55e" }}>{row.revenue_sar?.toLocaleString("ar")}</td>
                  </tr>
                ))}
                {!abc.length && <tr><td colSpan={2} style={{ padding: "1rem", color: "#64748b", textAlign: "center" }}>لا توجد بيانات مبيعات</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
