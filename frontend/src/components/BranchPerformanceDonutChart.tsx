import { useMemo } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const COLORS = [
  "rgb(16 185 129)",
  "rgb(99 102 241)",
  "rgb(245 158 11)",
  "rgb(236 72 153)",
  "rgb(6 182 212)",
  "rgb(139 92 246)",
];

type Props = {
  data: Array<{ branch_name: string; value: number }>;
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

export default function BranchPerformanceDonutChart({
  data,
  height = 280,
  showFooter = true,
  variant = "white",
}: Props) {
  const chartData = useMemo(
    () =>
      data
        .filter((d) => d.value > 0)
        .map((d, i) => ({
          ...d,
          name: d.branch_name?.slice(0, 25) || "—",
          fill: COLORS[i % COLORS.length],
          percentage: data.reduce((s, x) => s + x.value, 0) > 0
            ? ((d.value / data.reduce((s, x) => s + x.value, 0)) * 100).toFixed(1)
            : "0",
        })),
    [data]
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
        <p className="text-sm [color:var(--glass-text-muted)]">No branch data</p>
        {showFooter && <p className="mt-2 text-[10px] [color:var(--glass-text-subtle)]">Directed by SAIF | v1.0</p>}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="page-card flex flex-col rounded-2xl [color:var(--glass-text)]"
      style={{ minHeight: containerHeight }}
    >
      <div className="p-5 pb-2">
        <h3 className="text-sm font-semibold">Sales by Branch</h3>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={entry.branch_name} fill={entry.fill} />
                ))}
              </Pie>
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
                formatter={(value, _name, props) => {
                  const p = props as { payload?: { percentage?: string } };
                  return [sar(value as number) + ` (${p.payload?.percentage ?? 0}%)`, ""];
                }}
                labelFormatter={(label) => label}
              />
              <Legend
                wrapperStyle={{ fontSize: "10px" }}
                formatter={(value, entry) => {
                  const item = chartData.find((d) => d.branch_name === value || d.name === value);
                  return `${value}: ${item?.percentage ?? 0}%`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {showFooter && (
          <p className="mt-2 text-right text-[10px] [color:var(--glass-text-subtle)]">Directed by SAIF | v1.0</p>
        )}
      </div>
    </motion.div>
  );
}
