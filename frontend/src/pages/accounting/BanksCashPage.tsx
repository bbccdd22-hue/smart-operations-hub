/**
 * البنوك والصناديق — Banks & Cash
 * إدارة وعرض أرصدة حسابات البنوك والصناديق النقدية.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Landmark, RefreshCw, AlertCircle, TrendingUp,
  TrendingDown, CreditCard, Wallet, Building2, Download,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";

interface BankAccount {
  id: number;
  code: string;
  name_ar: string;
  name_en: string;
  level: number;
  statement: string;
  balance: string;
  type: "bank" | "cash" | "other";
}

const fmt = (v: string) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* Classify account as bank/cash/other based on name keywords */
function classifyAccount(name: string): "bank" | "cash" | "other" {
  const n = (name || "").toLowerCase();
  if (/بنك|bank|مصرف|حساب جاري|account/.test(n)) return "bank";
  if (/صندوق|نقد|كاش|cash|petty/.test(n)) return "cash";
  return "other";
}

export default function BanksCashPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [rawData, setRawData]       = useState<BankAccount[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "bank" | "cash">("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      /* Use chart accounts and filter/classify */
      const res = await fetchWithCsrf("/api/accounting/chart/");
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      const all: BankAccount[] = (d.accounts || d || []).map((a: BankAccount) => ({
        ...a,
        type: classifyAccount(a.name_ar),
      }));
      /* Filter accounts with balances or that look like bank/cash accounts */
      setRawData(all.filter((a) => a.type !== "other" || parseFloat(a.balance) !== 0));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const displayed = typeFilter === "all"
    ? rawData
    : rawData.filter((a) => a.type === typeFilter);

  const totalBanks = rawData.filter((a) => a.type === "bank").reduce((s, a) => s + parseFloat(a.balance), 0);
  const totalCash  = rawData.filter((a) => a.type === "cash").reduce((s, a) => s + parseFloat(a.balance), 0);
  const totalAll   = totalBanks + totalCash;

  const exportCSV = () => {
    const rows = [
      ["الكود", "الاسم", "النوع", "الرصيد"],
      ...displayed.map((a) => [a.code, a.name_ar, a.type === "bank" ? "بنك" : a.type === "cash" ? "صندوق" : "أخرى", a.balance]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "banks-cash.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-500/30">
              <Landmark className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("البنوك والصناديق", "Banks & Cash")}</h1>
              <p className="text-xs text-gray-400">{T("أرصدة البنوك والصناديق النقدية", "Bank accounts and petty cash balances")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <Download className="h-4 w-4" /> {T("تصدير", "Export")}
            </button>
            <button onClick={load} className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Type filter */}
        <div className="flex gap-2">
          {(["all", "bank", "cash"] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                typeFilter === t ? "bg-sky-500/20 border-sky-500/40 text-sky-400"
                : "bg-[#161b27] border-white/10 text-gray-400 hover:text-white"
              }`}>
              {t === "all" ? <>{T("الكل", "All")}</>
                : t === "bank" ? <><Building2 className="h-3.5 w-3.5" />{T("بنوك", "Banks")}</>
                : <><Wallet className="h-3.5 w-3.5" />{T("صناديق", "Cash")}</>}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="px-4 md:px-6 pt-4 grid grid-cols-3 gap-3">
        {[
          { label: T("إجمالي البنوك", "Total Banks"),   value: fmt(String(totalBanks)), icon: Building2,  color: "text-sky-400",     bg: "bg-sky-500/10 border-sky-500/20" },
          { label: T("إجمالي الصناديق", "Total Cash"),  value: fmt(String(totalCash)),  icon: Wallet,     color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: T("الإجمالي الكلي", "Grand Total"),  value: fmt(String(totalAll)),   icon: CreditCard, color: totalAll >= 0 ? "text-amber-400" : "text-red-400", bg: "bg-[#161b27] border-white/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} border rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <p className="text-xs text-gray-400">{label}</p>
            </div>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Cards grid for bank/cash accounts */}
      <div className="px-4 md:px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-sky-400" />
            <span className="ms-3 text-gray-400">{T("جارٍ التحميل...", "Loading...")}</span>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={load} className="px-5 py-2 bg-sky-600 text-white rounded-xl text-sm">{T("إعادة المحاولة", "Retry")}</button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Landmark className="h-12 w-12 mb-3 opacity-40" />
            <p className="font-medium">{T("لا توجد حسابات بنكية / صناديق", "No bank or cash accounts found")}</p>
            <p className="text-xs text-gray-600 mt-1">{T("أضف حسابات البنوك والصناديق في دليل الحسابات", "Add bank/cash accounts in the chart of accounts")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((acc) => {
              const bal = parseFloat(acc.balance);
              const isBank = acc.type === "bank";
              const isCash = acc.type === "cash";
              return (
                <div key={acc.id}
                  className={`bg-[#161b27] border rounded-2xl p-5 ${
                    isBank ? "border-sky-500/20" : isCash ? "border-emerald-500/20" : "border-white/10"
                  }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2 rounded-xl ${isBank ? "bg-sky-500/20" : isCash ? "bg-emerald-500/20" : "bg-gray-500/20"}`}>
                      {isBank ? <Building2 className="h-5 w-5 text-sky-400" />
                        : isCash ? <Wallet className="h-5 w-5 text-emerald-400" />
                        : <CreditCard className="h-5 w-5 text-gray-400" />}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      isBank ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                      : isCash ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                    }`}>
                      {isBank ? T("بنك", "Bank") : isCash ? T("صندوق", "Cash") : T("أخرى", "Other")}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white mb-1">{isRTL ? acc.name_ar : acc.name_en}</h3>
                  <p className="text-xs font-mono text-gray-500 mb-3">{acc.code}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">{T("الرصيد الحالي", "Current Balance")}</p>
                    <div className="flex items-center gap-1">
                      {bal > 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                        : bal < 0 ? <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                        : null}
                      <span className={`text-lg font-bold font-mono ${
                        bal > 0 ? "text-emerald-400" : bal < 0 ? "text-red-400" : "text-gray-400"
                      }`}>
                        {fmt(acc.balance)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
