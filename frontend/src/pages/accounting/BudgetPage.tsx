/**
 * الميزانية التقديرية — Budget Planning
 * إعداد وعرض الميزانية السنوية مقابل الفعلي.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Target, RefreshCw, AlertCircle, Download, Save,
  TrendingUp, TrendingDown, Plus, Pencil, Check, X,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";

/* ─── types ────────────────────────────────────────────────────────────── */
interface BudgetLine {
  id: string;
  account_code: string;
  account_name: string;
  category: "revenue" | "expense";
  budget_amount: number;
  actual_amount: number;
  variance: number;
  variance_pct: number;
}

interface BudgetAccount { id: number; code: string; name_ar: string; level: number; statement: string; balance: string; }

/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmt = (n: number) =>
  n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STORAGE_KEY = "budget_data_v1";

function loadBudget(): BudgetLine[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveBudget(lines: BudgetLine[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
}

/* ─── component ───────────────────────────────────────────────────────── */
export default function BudgetPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [lines, setLines]         = useState<BudgetLine[]>(loadBudget);
  const [accounts, setAccounts]   = useState<BudgetAccount[]>([]);
  const [editId, setEditId]       = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [adding, setAdding]       = useState(false);
  const [newCode, setNewCode]     = useState("");
  const [newName, setNewName]     = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [newCategory, setNewCategory] = useState<"revenue" | "expense">("revenue");
  const [loadingAccts, setLoadingAccts] = useState(false);

  /* Load accounts */
  useEffect(() => {
    setLoadingAccts(true);
    fetchWithCsrf("/api/accounting/chart/")
      .then((r: Response) => r.json())
      .then((d: { accounts?: BudgetAccount[] } | BudgetAccount[]) => {
        const arr = Array.isArray(d) ? d : (d as { accounts?: BudgetAccount[] }).accounts || [];
        setAccounts(arr.filter((a: BudgetAccount) => a.level >= 3));
      })
      .catch(() => {})
      .finally(() => setLoadingAccts(false));
  }, []);

  /* Sync actual balances from chart accounts */
  const syncActuals = async () => {
    if (accounts.length === 0) return;
    const updated = lines.map((l) => {
      const acc = accounts.find((a) => a.code === l.account_code);
      if (!acc) return l;
      const actual = parseFloat(acc.balance) || 0;
      const variance = l.budget_amount - actual;
      return {
        ...l,
        actual_amount: actual,
        variance,
        variance_pct: l.budget_amount !== 0 ? (variance / l.budget_amount) * 100 : 0,
      };
    });
    setLines(updated);
    saveBudget(updated);
  };

  useEffect(() => { if (accounts.length > 0 && lines.length > 0) syncActuals(); }, [accounts]);

  /* Save edit */
  const saveEdit = (id: string) => {
    const amt = parseFloat(editAmount);
    if (isNaN(amt)) return;
    const updated = lines.map((l) => {
      if (l.id !== id) return l;
      const variance = amt - l.actual_amount;
      return { ...l, budget_amount: amt, variance, variance_pct: amt !== 0 ? (variance / amt) * 100 : 0 };
    });
    setLines(updated);
    saveBudget(updated);
    setEditId(null);
  };

  /* Add line */
  const addLine = () => {
    if (!newCode.trim() || !newName.trim() || isNaN(parseFloat(newBudget))) return;
    const acc = accounts.find((a) => a.code === newCode.trim());
    const actual = acc ? parseFloat(acc.balance) || 0 : 0;
    const budget = parseFloat(newBudget);
    const variance = budget - actual;
    const newLine: BudgetLine = {
      id: Date.now().toString(),
      account_code: newCode.trim(),
      account_name: newName.trim(),
      category: newCategory,
      budget_amount: budget,
      actual_amount: actual,
      variance,
      variance_pct: budget !== 0 ? (variance / budget) * 100 : 0,
    };
    const updated = [...lines, newLine];
    setLines(updated);
    saveBudget(updated);
    setAdding(false);
    setNewCode(""); setNewName(""); setNewBudget("");
  };

  /* Remove */
  const removeLine = (id: string) => {
    const updated = lines.filter((l) => l.id !== id);
    setLines(updated);
    saveBudget(updated);
  };

  /* Totals */
  const revenue  = lines.filter((l) => l.category === "revenue");
  const expenses = lines.filter((l) => l.category === "expense");
  const totalBudgetRev    = revenue.reduce((s, l) => s + l.budget_amount, 0);
  const totalActualRev    = revenue.reduce((s, l) => s + l.actual_amount, 0);
  const totalBudgetExp    = expenses.reduce((s, l) => s + l.budget_amount, 0);
  const totalActualExp    = expenses.reduce((s, l) => s + l.actual_amount, 0);
  const budgetNet = totalBudgetRev - totalBudgetExp;
  const actualNet = totalActualRev - totalActualExp;

  const exportCSV = () => {
    const rows = [
      ["الحساب", "الاسم", "النوع", "الميزانية", "الفعلي", "الفرق", "الفرق%"],
      ...lines.map((l) => [l.account_code, l.account_name, l.category === "revenue" ? "إيرادات" : "مصروفات",
        l.budget_amount, l.actual_amount, l.variance, l.variance_pct.toFixed(1) + "%"]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "budget.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const renderSection = (title: string, sectionLines: BudgetLine[], totalBudget: number, totalActual: number, accentColor: string) => (
    <div className="bg-[#161b27] border border-white/10 rounded-2xl overflow-hidden">
      <div className={`px-5 py-3 border-b border-white/10 flex items-center justify-between`}>
        <h2 className={`font-semibold text-sm ${accentColor}`}>{title}</h2>
        <div className="flex gap-4 text-xs text-gray-400">
          <span>{T("ميزانية:", "Budget:")} <span className="text-white font-mono">{fmt(totalBudget)}</span></span>
          <span>{T("فعلي:", "Actual:")} <span className="text-white font-mono">{fmt(totalActual)}</span></span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 540 }}>
          <thead>
            <tr className="text-xs text-gray-500 border-b border-white/5 uppercase">
              <th className="px-4 py-2 text-start">{T("الحساب", "Account")}</th>
              <th className="px-4 py-2 text-end">{T("الميزانية", "Budget")}</th>
              <th className="px-4 py-2 text-end">{T("الفعلي", "Actual")}</th>
              <th className="px-4 py-2 text-end">{T("الفرق", "Variance")}</th>
              <th className="px-4 py-2 text-center">{T("التحقيق", "Achievement")}</th>
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {sectionLines.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-gray-600 text-xs">{T("لا توجد بنود", "No items")}</td></tr>
            )}
            {sectionLines.map((l) => {
              const ach = l.budget_amount !== 0 ? (l.actual_amount / l.budget_amount) * 100 : 0;
              return (
                <tr key={l.id} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-gray-500 me-2">{l.account_code}</span>
                    <span className="text-white">{l.account_name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-end font-mono">
                    {editId === l.id ? (
                      <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(l.id); if (e.key === "Escape") setEditId(null); }}
                        autoFocus
                        className="w-28 bg-[#0e1117] border border-white/20 rounded px-2 py-1 text-sm text-white text-end focus:outline-none focus:border-amber-500" />
                    ) : (
                      <span className="text-gray-300">{fmt(l.budget_amount)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-end font-mono text-white">{fmt(l.actual_amount)}</td>
                  <td className="px-4 py-2.5 text-end font-mono">
                    <span className={l.variance >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(l.variance)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${ach >= 100 ? "bg-emerald-400" : ach >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${Math.min(ach, 100)}%` }} />
                      </div>
                      <span className="text-xs font-mono w-10 text-end text-gray-400">{ach.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {editId === l.id ? (
                        <>
                          <button onClick={() => saveEdit(l.id)} className="p-1 text-emerald-400 hover:text-emerald-300"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setEditId(null)} className="p-1 text-gray-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(l.id); setEditAmount(String(l.budget_amount)); }}
                            className="p-1 text-gray-500 hover:text-amber-400 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => removeLine(l.id)}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"><X className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
              <Target className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("الميزانية التقديرية", "Budget Planning")}</h1>
              <p className="text-xs text-gray-400">{T("الميزانية السنوية مقابل الفعلي", "Annual budget vs actuals")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={syncActuals} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <RefreshCw className="h-4 w-4" /> {T("تحديث الفعلي", "Sync Actuals")}
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <Download className="h-4 w-4" /> {T("تصدير", "Export")}
            </button>
            <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">
              <Plus className="h-4 w-4" /> {T("إضافة بند", "Add Line")}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6 space-y-6">

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: T("ميزانية الإيرادات", "Revenue Budget"), value: fmt(totalBudgetRev), color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: T("إيرادات فعلية",    "Actual Revenue"),  value: fmt(totalActualRev), color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: T("ميزانية المصروفات", "Expense Budget"), value: fmt(totalBudgetExp), color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
            { label: T("مصروفات فعلية",    "Actual Expenses"), value: fmt(totalActualExp), color: "text-red-300",   bg: "bg-red-500/10 border-red-500/20" },
          ].map((c) => (
            <div key={c.label} className={`${c.bg} border rounded-xl p-4 text-center`}>
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className={`text-lg font-bold font-mono ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Net */}
        <div className={`border rounded-2xl p-5 flex items-center justify-between ${budgetNet >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
          <div>
            <p className="text-xs text-gray-400">{T("صافي الربح المقدّر", "Estimated Net Income")}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${budgetNet >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(budgetNet)}</p>
          </div>
          <div className="text-end">
            <p className="text-xs text-gray-400">{T("صافي الربح الفعلي", "Actual Net Income")}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${actualNet >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(actualNet)}</p>
          </div>
        </div>

        {/* Add form */}
        {adding && (
          <div className="bg-[#161b27] border border-violet-500/30 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-sm text-violet-400">{T("إضافة بند ميزانية", "Add Budget Line")}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T("رقم الحساب", "Account Code")}</label>
                <input value={newCode} onChange={(e) => {
                  setNewCode(e.target.value);
                  const a = accounts.find((x) => x.code === e.target.value.trim());
                  if (a) setNewName(a.name_ar);
                }}
                  placeholder="e.g. 41001"
                  className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T("اسم الحساب", "Account Name")}</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder={T("اسم البند", "Line name")}
                  className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T("الميزانية المخصصة", "Budget Amount")}</label>
                <input type="number" value={newBudget} onChange={(e) => setNewBudget(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T("النوع", "Type")}</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as "revenue" | "expense")}
                  className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
                  <option value="revenue">{T("إيرادات", "Revenue")}</option>
                  <option value="expense">{T("مصروفات", "Expense")}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addLine} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors">
                <Save className="h-4 w-4" /> {T("إضافة", "Add")}
              </button>
              <button onClick={() => setAdding(false)} className="px-4 py-2 bg-[#0e1117] border border-white/10 text-gray-400 hover:text-white text-sm rounded-xl transition-colors">
                {T("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Revenue section */}
        {renderSection(T("الإيرادات", "Revenue"), revenue, totalBudgetRev, totalActualRev, "text-emerald-400")}

        {/* Expenses section */}
        {renderSection(T("المصروفات", "Expenses"), expenses, totalBudgetExp, totalActualExp, "text-red-400")}
      </div>
    </div>
  );
}
