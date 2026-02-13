import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
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

type Point = { date: string; sales: number; forecast: number; label?: string };

type Props = {
  data: Array<{ date: string; sales: number; forecast: number }>;
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

export default function SalesVsForecastChart({ data, height = 320, showFooter, variant = "white" }: Props) {
  const { i18n } = useTranslation();
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="page-card rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold [color:var(--glass-text)]">
          Sales vs. AI Forecast
        </h3>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity={0} />
              </linearGradient>
            </defs>
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
                border: "1px solid rgba(255,255,255,0.2)",
                backgroundColor: "rgba(255,255,255,0.95)",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              formatter={(value: number | undefined) => [value != null ? sar(value) : "", ""]}
              labelFormatter={(label) => label}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              formatter={(value) => (value === "sales" ? "Actual Sales" : "AI Forecast")}
            />
            <Area
              type="monotone"
              dataKey="sales"
              name="sales"
              stroke="rgb(16 185 129)"
              strokeWidth={2.5}
              fill="url(#salesGradient)"
            />
            <Line
              type="monotone"
              dataKey="forecast"
              name="forecast"
              stroke="rgb(99 102 241)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ fill: "rgb(99 102 241)", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {showFooter && (
        <p className="mt-2 text-right text-[10px] [color:var(--glass-text-subtle)]">
          Directed by SAIF | v1.0
        </p>
      )}
    </motion.div>
  );
}
