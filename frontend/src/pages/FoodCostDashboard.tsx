/**
 * Food Cost Dashboard — /analytics/food-cost
 * لوحة تكلفة الطعام: Food Cost % يومي/أسبوعي/شهري، أغلى 10 أطباق، تنبيهات إعادة الطلب
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../lib/api";

type Period = "day" | "week" | "month";

interface Dish {
  product_id: number;
  product_name: string;
  cost_per_serving: number;
  selling_price: number;
  food_cost_pct: number | null;
}

interface WasteIngredient {
  ingredient_name: string;
  ingredient_name_ar: string;
  waste_qty: number;
  waste_cost_sar: number;
}

interface ReorderAlert {
  ingredient_name: string;
  ingredient_name_ar: string;
  branch_name: string;
  on_hand: number;
  unit: string;
  reorder_level: number;
}

interface TrendPoint {
  date: string;
  food_cost_pct: number | null;
  food_cost_sar: number;
  revenue_sar: number;
}

interface FoodCostData {
  period: string;
  date_from: string;
  date_to: string;
  food_cost_pct: number | null;
  food_cost_sar: number;
  revenue_sar: number;
  top_expensive_dishes: Dish[];
  top_waste_ingredients: WasteIngredient[];
  reorder_alerts: ReorderAlert[];
  trend: TrendPoint[];
}

const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "اليوم" },
  { id: "week", label: "هذا الأسبوع" },
  { id: "month", label: "هذا الشهر" },
];

const s = {
  page: {
    background: "#0f172a",
    minHeight: "100vh",
    padding: "2rem",
    color: "#f1f5f9",
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
    direction: "rtl" as const,
  } as React.CSSProperties,
  card: {
    background: "#1e293b",
    borderRadius: "1rem",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  } as React.CSSProperties,
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  } as React.CSSProperties,
  kpi: (color: string) => ({
    background: "#1e293b",
    borderRadius: "1rem",
    padding: "1.25rem",
    borderLeft: `4px solid ${color}`,
  } as React.CSSProperties),
  kpiVal: { fontSize: "1.8rem", fontWeight: 700 } as React.CSSProperties,
  kpiLabel: { color: "#94a3b8", fontSize: "0.8rem", marginTop: "0.25rem" } as React.CSSProperties,
  tableHead: { background: "#0f172a", color: "#94a3b8", fontSize: "0.78rem" } as React.CSSProperties,
  badge: (pct: number | null) => ({
    display: "inline-block",
    padding: "0.2rem 0.5rem",
    borderRadius: "0.4rem",
    fontSize: "0.78rem",
    fontWeight: 700,
    background: pct === null ? "#334155" : pct > 40 ? "#7f1d1d" : pct > 30 ? "#78350f" : "#14532d",
    color: pct === null ? "#94a3b8" : "#fff",
  } as React.CSSProperties),
};

function PeriodBar({ active, onChange }: { active: Period; onChange: (p: Period) => void }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
      {PERIODS.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "0.6rem",
            border: "none",
            cursor: "pointer",
            background: active === p.id ? "#6366f1" : "#1e293b",
            color: active === p.id ? "#fff" : "#94a3b8",
            fontWeight: active === p.id ? 700 : 400,
            fontSize: "0.9rem",
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function TrendMiniChart({ trend }: { trend: TrendPoint[] }) {
  if (!trend.length) return null;
  const max = Math.max(...trend.map((t) => t.food_cost_pct ?? 0), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: 60 }}>
      {trend.map((t) => {
        const pct = t.food_cost_pct ?? 0;
        const height = Math.max(4, (pct / max) * 56);
        const color = pct > 40 ? "#ef4444" : pct > 30 ? "#f59e0b" : "#22c55e";
        return (
          <div key={t.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{ width: "100%", height, background: color, borderRadius: "3px 3px 0 0" }}
              title={`${t.date}: ${pct}%`}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function FoodCostDashboard() {
  const { i18n } = useTranslation();
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<FoodCostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/dashboard/food-cost/?period=${period}`)
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const pct = data?.food_cost_pct;
  const pctColor = pct === null ? "#94a3b8" : pct > 40 ? "#ef4444" : pct > 30 ? "#f59e0b" : "#22c55e";

  return (
    <div style={s.page}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        📊 Food Cost Dashboard
      </h1>
      <p style={{ color: "#64748b", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        تكلفة الطعام كنسبة من الإيرادات — المعيار المثالي: 25–35%
      </p>

      <PeriodBar active={period} onChange={setPeriod} />

      {loading && (
        <div style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>
          جارٍ التحميل...
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Row */}
          <div style={s.kpiGrid}>
            <div style={s.kpi(pctColor)}>
              <div style={{ ...s.kpiVal, color: pctColor }}>
                {pct !== null ? `${pct}%` : "—"}
              </div>
              <div style={s.kpiLabel}>Food Cost %</div>
            </div>
            <div style={s.kpi("#6366f1")}>
              <div style={s.kpiVal}>
                {data.food_cost_sar.toLocaleString("ar", { maximumFractionDigits: 0 })}
              </div>
              <div style={s.kpiLabel}>تكلفة الطعام (ر.س)</div>
            </div>
            <div style={s.kpi("#22c55e")}>
              <div style={s.kpiVal}>
                {data.revenue_sar.toLocaleString("ar", { maximumFractionDigits: 0 })}
              </div>
              <div style={s.kpiLabel}>الإيرادات (ر.س)</div>
            </div>
            <div style={s.kpi("#f59e0b")}>
              <div style={s.kpiVal}>{data.reorder_alerts.length}</div>
              <div style={s.kpiLabel}>تنبيهات إعادة الطلب</div>
            </div>
          </div>

          {/* Trend Chart */}
          {data.trend.length > 1 && (
            <div style={s.card}>
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>
                📈 اتجاه Food Cost % خلال الفترة
              </h3>
              <TrendMiniChart trend={data.trend} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{data.date_from}</span>
                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{data.date_to}</span>
              </div>
            </div>
          )}

          {/* Top 10 Expensive Dishes */}
          <div style={s.card}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>
              💰 أغلى 10 أطباق (تكلفة الوصفة)
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={s.tableHead}>
                    {["الطبق", "تكلفة التحضير", "سعر البيع", "Food Cost %"].map((h) => (
                      <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.top_expensive_dishes.map((d) => (
                    <tr key={d.product_id} style={{ borderBottom: "1px solid #0f172a" }}>
                      <td style={{ padding: "0.6rem 1rem" }}>{d.product_name}</td>
                      <td style={{ padding: "0.6rem 1rem", color: "#f59e0b" }}>
                        {d.cost_per_serving.toFixed(2)} ر.س
                      </td>
                      <td style={{ padding: "0.6rem 1rem", color: "#22c55e" }}>
                        {d.selling_price > 0 ? `${d.selling_price.toFixed(2)} ر.س` : "—"}
                      </td>
                      <td style={{ padding: "0.6rem 1rem" }}>
                        <span style={s.badge(d.food_cost_pct)}>
                          {d.food_cost_pct !== null ? `${d.food_cost_pct}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!data.top_expensive_dishes.length && (
                    <tr>
                      <td colSpan={4} style={{ padding: "1rem", color: "#64748b", textAlign: "center" }}>
                        لا توجد بيانات — أضف وصفات وتكاليف للمكونات
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Two-column: Waste + Reorder */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={s.card}>
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>
                🗑️ أكثر 5 أصناف هدراً
              </h3>
              {data.top_waste_ingredients.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: "0.85rem" }}>لا يوجد هدر مسجّل</p>
              ) : (
                data.top_waste_ingredients.map((w) => (
                  <div
                    key={w.ingredient_name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.5rem 0",
                      borderBottom: "1px solid #0f172a",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span>{i18n.language === "ar" ? w.ingredient_name_ar || w.ingredient_name : w.ingredient_name}</span>
                    <span style={{ color: "#ef4444" }}>{w.waste_cost_sar.toFixed(2)} ر.س</span>
                  </div>
                ))
              )}
            </div>

            <div style={s.card}>
              <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>
                ⚠️ تنبيهات إعادة الطلب
              </h3>
              {data.reorder_alerts.length === 0 ? (
                <p style={{ color: "#22c55e", fontSize: "0.85rem" }}>✓ كل الأصناف فوق مستوى إعادة الطلب</p>
              ) : (
                data.reorder_alerts.slice(0, 8).map((a) => (
                  <div
                    key={`${a.ingredient_name}-${a.branch_name}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.5rem 0",
                      borderBottom: "1px solid #0f172a",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span>
                      {i18n.language === "ar" ? a.ingredient_name_ar || a.ingredient_name : a.ingredient_name}
                      <span style={{ color: "#64748b", fontSize: "0.75rem", marginRight: "0.25rem" }}>
                        ({a.branch_name})
                      </span>
                    </span>
                    <span style={{ color: "#ef4444" }}>
                      {a.on_hand.toFixed(1)} {a.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
