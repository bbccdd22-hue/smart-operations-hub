import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const COLORS = [
  "rgb(16 185 129)", // emerald
  "rgb(99 102 241)", // indigo
  "rgb(245 158 11)", // amber
];

type Props = {
  data: Array<{ name: string; value: number; key: string }>;
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

export default function RevenueSplitChart({ data, height = 280, showFooter, variant = "white" }: Props) {
  const { t } = useTranslation();
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const chartData = useMemo(
    () =>
      data
        .filter((d) => d.value > 0)
        .map((d, i) => ({
          ...d,
          fill: COLORS[i % COLORS.length],
          percentage: total > 0 ? ((d.value / total) * 100).toFixed(1) : "0",
        })),
    [data, total]
  );

  if (chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="page-card flex h-64 items-center justify-center rounded-2xl"
      >
        <p className="text-sm [color:var(--glass-text-muted)]">{t("noRevenueData")}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="page-card rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold [color:var(--glass-text)]">{t("revenueSplit")}</h3>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                fontSize: "12px",
                borderRadius: "12px",
                border: "1px solid rgb(226 232 240)",
              }}
              formatter={(value, _name, props) => {
                const v = value as number | undefined;
                const p = props as { payload?: { percentage?: string } };
                return v != null ? [`${sar(v)} (${p.payload?.percentage ?? 0}%)`, _name ?? ""] : ["", ""];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              formatter={(value, entry) => {
                const item = chartData.find((d) => d.name === value);
                return `${value}: ${item?.percentage ?? 0}%`;
              }}
            />
          </PieChart>
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
