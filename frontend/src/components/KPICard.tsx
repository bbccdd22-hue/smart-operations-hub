import { useEffect, useId, useState } from "react";
import { motion, useSpring, useMotionValueEvent } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts";

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
  hint?: string;
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
  const uid = useId();
  const [mounted, setMounted] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);
  const spring = useSpring(0, { stiffness: 80, damping: 30 });

  useMotionValueEvent(spring, "change", (latest) =>
    setDisplayValue(Math.round(latest * 100) / 100)
  );

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted) {
      const t = setTimeout(() => spring.set(value), delay);
      return () => clearTimeout(t);
    }
  }, [mounted, value, delay, spring]);

  const chartData = sparklineData.length > 0
    ? sparklineData.map((v) => ({ value: v }))
    : [{ value }];

  const trendColor =
    trend === "up"
      ? "text-[#00ffcc]"
      : trend === "down"
        ? "text-rose-400"
        : "text-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="float-card relative overflow-hidden rounded-2xl p-4 transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_24px_rgba(0,255,204,0.08)]"
    >
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="metric-glow mt-2 text-2xl font-bold tracking-tight text-slate-100">
        {mounted ? formatter(displayValue) : "—"}
      </div>
      {hint && (
        <div className="mt-1 text-[10px] text-slate-500">{hint}</div>
      )}

      {sparklineData.length > 1 && (
        <div className="mt-3 h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <defs>
                <linearGradient id={`kpi-spark-${uid.replace(/:/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ffcc" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00ffcc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={["auto", "auto"]} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#00ffcc"
                strokeWidth={2}
                fill={`url(#kpi-spark-${uid.replace(/:/g, "")})`}
              />
              <Tooltip
                contentStyle={{
                  fontSize: "11px",
                  borderRadius: "12px",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                }}
                formatter={(v: number | undefined) => [v != null ? formatter(v) : "", ""]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

export { sar };
