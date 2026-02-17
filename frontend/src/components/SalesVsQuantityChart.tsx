import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { useTranslation } from "react-i18next";

type Point = { date: string; sales: number; qty: number; label?: string };

type Props = {
  data: Array<{ date: string; sales: number; qty: number }>;
  height?: number;
  showFooter?: boolean;
  variant?: "glass" | "white";
};

function sar(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function SalesVsQuantityChart({
  data,
  height = 280,
  showFooter = true,
  variant = "white",
}: Props) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  const chartData: Point[] = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: format(parseISO(d.date), "dd MMM", {
          locale: isRTL ? ar : undefined,
        }),
      })),
    [data, isRTL]
  );

  const containerHeight = showFooter ? height + 36 : height;

  if (chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="page-card flex flex-col items-center justify-center rounded-2xl"
        style={{ minHeight: containerHeight }}
      >
        <p className="text-sm [color:var(--glass-text-muted)]">No trend data</p>
        {showFooter && <p className="mt-2 text-[10px] [color:var(--glass-text-subtle)]">Directed by SAIF | v1.0</p>}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="page-card flex flex-col rounded-2xl [color:var(--glass-text)]"
      style={{ minHeight: containerHeight }}
    >
      <div className="p-5 pb-2">
        <h3 className="text-sm font-semibold">Sales vs. Quantity Trend</h3>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-slate-200/50 dark:text-slate-600/50"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-slate-500"
              />
              <YAxis
                yAxisId="sales"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                className="text-slate-500"
              />
              <YAxis
                yAxisId="qty"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                className="text-slate-500"
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
                formatter={(value?: number, name?: string) => [
                  name === "sales" ? sar(value ?? 0) : (value ?? 0).toLocaleString(),
                  name === "sales" ? t("netSales") : t("netQuantity"),
                ]}
                labelFormatter={(label) => label}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value) =>
                  value === "sales" ? t("netSalesSar") : t("netQuantity")
                }
              />
              <Line
                yAxisId="sales"
                type="monotone"
                dataKey="sales"
                name="sales"
                stroke="#00ffcc"
                strokeWidth={2.5}
                dot={{ fill: "#00ffcc", r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="qty"
                type="monotone"
                dataKey="qty"
                name="qty"
                stroke="rgb(148 163 184)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ fill: "rgb(148 163 184)", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {showFooter && (
          <p className="mt-2 text-right text-[10px] [color:var(--glass-text-subtle)]">Directed by SAIF | v1.0</p>
        )}
      </div>
    </motion.div>
  );
}
