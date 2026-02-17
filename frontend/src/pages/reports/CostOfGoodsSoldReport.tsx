/**
 * [FIN-003] Cost of Goods Sold (COGS) – From recipe ingredients and stock usage.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ResponsiveFinancialTable from "../../components/ResponsiveFinancialTable";
import { fetchProfitSummary } from "../../lib/api";

function sar(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function CostOfGoodsSoldReport() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    total_cogs: string;
    ingredients_with_cost?: Array<{
      ingredient_name: string;
      serial_code: string;
      qty: string;
      unit_cost: string;
      cost: string;
    }>;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchProfitSummary({
        date_from: new Date().toISOString().slice(0, 10),
        date_to: new Date().toISOString().slice(0, 10),
      });
      setData(s);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ingredients = data?.ingredients_with_cost ?? [];
  const tableData = ingredients.map((i) => ({
    ingredient: i.ingredient_name,
    code: i.serial_code || "—",
    qty: i.qty,
    unitCost: i.unit_cost ? sar(parseFloat(i.unit_cost)) : "—",
    cost: i.cost ? sar(parseFloat(i.cost)) : "—",
  }));

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
            FIN-003
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            {isRTL ? "تكلفة البضاعة المباعة" : "Cost of Goods Sold (COGS)"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "محسوبة آلياً من الوصفات واستخدام المخزون" : "Automated from recipe ingredients and stock usage"}
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="float-card overflow-hidden rounded-2xl p-6"
      >
        <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-white">
          {isRTL ? "تفاصيل التكلفة حسب المكون" : "Cost by Ingredient"}
        </h2>
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "جاري التحميل…" : "Loading…"}
          </div>
        ) : (
          <>
            <ResponsiveFinancialTable
              columns={[
                { key: "ingredient", labelEn: "Ingredient", labelAr: "المكون" },
                { key: "code", labelEn: "Code", labelAr: "الرمز" },
                { key: "qty", labelEn: "Qty", labelAr: "الكمية" },
                { key: "unitCost", labelEn: "Unit Cost", labelAr: "تكلفة الوحدة" },
                {
                  key: "cost",
                  labelEn: "Cost (SAR)",
                  labelAr: "التكلفة (ر.س)",
                  align: "right",
                  render: (v) => (
                    <span className="font-semibold tabular-nums">{typeof v === "string" ? v : String(v)}</span>
                  ),
                },
              ]}
              data={tableData}
              emptyMessage={isRTL ? "لا توجد بيانات. قم برفع التقارير أو تعيين تكاليف المكونات." : "No data. Upload reports or set ingredient costs."}
            />
            {data && (
              <div className="mt-6 border-t border-slate-200/60 pt-4 dark:border-white/10">
                <div className="flex justify-between text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  <span>{isRTL ? "إجمالي COGS" : "Total COGS"}</span>
                  <span className="tabular-nums">{sar(parseFloat(data.total_cogs || "0"))}</span>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
