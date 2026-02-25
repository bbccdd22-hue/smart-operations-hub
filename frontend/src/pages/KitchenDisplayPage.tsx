/**
 * KDS - Kitchen Display System
 * شاشة المطبخ - تعرض الطلبات فور دفعها
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { fetchPOSKitchenOrders } from "../lib/api";

type Order = {
  sale_number: string;
  items: Array<{ product_name: string; qty: number; unit_price?: number }>;
  total: number;
  created_at: string;
};

export default function KitchenDisplayPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const branchId = (user?.branch_id ?? 0) as number;
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!branchId) return;
    const load = () =>
      fetchPOSKitchenOrders(branchId).then((data) =>
        setOrders(
          data.map((o) => ({
            sale_number: o.sale_number,
            items: (o.items || []).map((it: unknown) => {
              const i = it as { product_name?: string; qty?: number };
              return { product_name: i?.product_name ?? "", qty: i?.qty ?? 1 };
            }),
            total: o.total,
            created_at: o.created_at,
          }))
        )
      ).catch(() => setOrders([]));
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [branchId]);

  const formatTime = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleTimeString(isRTL ? "ar-SA" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return s;
    }
  };

  if (!branchId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-slate-500">{t("selectBranch")}</p>
      </div>
    );
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-slate-900 text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-slate-800 px-4 py-3">
        <Link to="/" className="text-slate-400 hover:text-white">← {isRTL ? "رجوع" : "Back"}</Link>
        <h1 className="text-xl font-bold">{isRTL ? "شاشة المطبخ" : "Kitchen Display"}</h1>
        <span className="text-sm text-slate-400">{orders.length} {isRTL ? "طلب" : "orders"}</span>
      </header>
      <main className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
        {orders.map((o) => (
          <div
            key={o.sale_number}
            className="rounded-2xl border border-emerald-500/30 bg-slate-800/80 p-4 shadow-lg"
          >
            <div className="mb-3 flex justify-between">
              <span className="font-mono font-bold text-emerald-400">{o.sale_number}</span>
              <span className="text-sm text-slate-400">{formatTime(o.created_at)}</span>
            </div>
            <ul className="space-y-1">
              {o.items.map((it, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>
                    {it.qty}× {it.product_name}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-white/10 pt-2 text-right font-semibold text-emerald-400">
              {o.total.toFixed(1)} ر.س
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
