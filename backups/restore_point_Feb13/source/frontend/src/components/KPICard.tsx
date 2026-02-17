import { useEffect, useState } from "react";
import { motion, useSpring, useMotionValueEvent } from "framer-motion";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  Tooltip,
} from "recharts";

function sar(n: number | null | undefined) {
  const v = typeof n === "number" ? n : 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(v);
}

type Props = {
  label: string;
  value: number;
  formatter?: (n: number) => string;
  sparklineData?: number[];
  trend?: "up" | "down" | "neutral";
  delay?: number;
  /** Hint text when value is 0 (e.g. "Upload Daily Sales with عدد الطلبات") */
  hint?: string;
  /** White minimalist style [Ref: 141317] */
  variant?: "glass" | "white";
};

export default function KPICard({
  label,
  value,
  formatter = (n) => n.toLocaleString(),
  sparklineData = [],
  trend = "neutral",
  delay = 0,
  hint,
  variant = "white",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);
  const spring = useSpring(0, { stiffness: 80, damping: 30 });

  useMotionValueEvent(spring, "change", (latest) =>
    setDisplayValue(Math.round(latest * 100) / 100)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => spring.set(value), delay);
      return () => clearTimeout(timer);
    }
  }, [mounted, value, delay, spring]);

  const chartData =
    sparklineData.length > 0
      ? sparklineData.map((v) => ({ value: v }))
      : [{ value }];

  const trendColor =
    trend === "up"
      ? "text-emerald-600"
      : trend === "down"
        ? "text-rose-600"
        : "text-slate-500";

  const cardClass = "page-card relative overflow-hidden rounded-2xl p-5 transition";
  const labelClass = "text-xs font-medium uppercase tracking-wider [color:var(--glass-text-muted)]";
  const valueClass = "mt-2 text-2xl font-bold tracking-tight [color:var(--glass-text)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cardClass}
    >
      <div className={labelClass}>{label}</div>
      <div className={valueClass}>
        {mounted ? formatter(displayValue) : "—"}
      </div>
      {hint && (
        <div className="mt-1 text-[10px] [color:var(--glass-text-subtle)]">{hint}</div>
      )}

      {/* Sparkline - only when we have trend data */}
      {sparklineData.length > 1 && (
        <div className="mt-3 h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <YAxis hide domain={["auto", "auto"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="currentColor"
                strokeWidth={1.5}
                dot={false}
                className={trendColor}
              />
              <Tooltip
                contentStyle={{
                  fontSize: "11px",
                  borderRadius: "8px",
                  border: "1px solid var(--tw-border-color)",
                }}
                formatter={(v: number | undefined) => [v != null ? formatter(v) : "", ""]}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

export { sar };
