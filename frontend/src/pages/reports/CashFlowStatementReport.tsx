/**
 * [FIN-005] Cash Flow Statement - Line chart money-in vs money-out.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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

const CASH_FLOW_DATA = [
  { month: "Jan", in: 420000, out: 380000 },
  { month: "Feb", in: 445000, out: 395000 },
  { month: "Mar", in: 468000, out: 410000 },
  { month: "Apr", in: 492000, out: 435000 },
  { month: "May", in: 515000, out: 458000 },
  { month: "Jun", in: 538000, out: 482000 },
];

function sar(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CashFlowStatementReport() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/finance"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            ← {isRTL ? "العودة للمركز المالي" : "Back to Finance Hub"}
          </Link>
          <div className="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            FIN-005
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            {isRTL ? "بيان التدفق النقدي" : "Cash Flow Statement"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "التدفق الداخل مقابل الخارج" : "Money-in vs money-out"}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="float-card overflow-hidden rounded-2xl p-6"
      >
        <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-white">
          {isRTL ? "التدفق النقدي الشهري" : "Monthly Cash Flow"}
        </h2>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={CASH_FLOW_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--glass-text-muted)" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--glass-text-muted)" }}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
              />
              <Tooltip
                formatter={(value: number | undefined) => [value != null ? sar(value) : "—", ""]}
                labelFormatter={(label) => label}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="in"
                name={isRTL ? "التدفق الداخل" : "Money In"}
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: "#10B981", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#10B981" }}
              />
              <Line
                type="monotone"
                dataKey="out"
                name={isRTL ? "التدفق الخارج" : "Money Out"}
                stroke="#64748B"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "#64748B", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#64748B" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
