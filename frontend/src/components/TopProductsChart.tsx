import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/* Aqua Emerald gradient shades for terminal theme */
const AQUA_SHADES = [
  "#00ffcc",
  "#00d4aa",
  "#00aa88",
  "#008866",
  "#006655",
];

type Props = {
  data: Array<{ product_name: string; sales: number }>;
  height?: number;
  showFooter?: boolean;
  /** White minimalist style [Ref: 141317] */
  variant?: "glass" | "white";
};

function sar(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function TopProductsChart({
  data,
  height = 280,
  showFooter = true,
  variant = "white",
}: Props) {
  const { t } = useTranslation();
  const chartData = useMemo(
    () =>
      data
        .slice(0, 5)
        .map((d, i) => ({
          ...d,
          name: d.product_name?.slice(0, 30) || "—",
          fill: AQUA_SHADES[i % AQUA_SHADES.length],
        })),
    [data]
  );

  const containerHeight = showFooter ? height + 36 : height;

  if (chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="float-card flex flex-col items-center justify-center rounded-2xl"
        style={{ minHeight: containerHeight }}
      >
        <p className="text-sm [color:var(--glass-text-muted)]">No product sales data</p>
        {showFooter && <p className="mt-2 text-[10px] [color:var(--glass-text-subtle)]">Directed by SAIF | v1.0</p>}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="float-card flex flex-col rounded-2xl [color:var(--glass-text)]"
      style={{ minHeight: containerHeight }}
    >
      <div className="p-5 pb-2">
        <h3 className="text-sm font-semibold [color:var(--glass-text)]">Top 5 Selling Products</h3>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.3} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "var(--glass-text-muted)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 10, fill: "var(--glass-text-muted)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: "12px",
                  borderRadius: "12px",
                  border: "1px solid var(--glass-border)",
                  backgroundColor: "var(--glass-bg-strong)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "var(--glass-shadow)",
                  color: "var(--glass-text)",
                }}
                formatter={(value?: number) => [sar(value ?? 0), t("sales")]}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="sales" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {chartData.map((entry, index) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {showFooter && (
          <p className="mt-2 text-right text-[10px] [color:var(--glass-text-subtle)]">Directed by SAIF | v1.0</p>
        )}
      </div>
    </motion.div>
  );
}
