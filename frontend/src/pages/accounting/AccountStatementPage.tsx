/**
 * كشف حساب — Account Statement
 * يعرض حركات حساب معين مع رصيد تراكمي. يدعم تصميم القالب (ترتيب وعرض الأعمدة).
 */
import { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen, RefreshCw, AlertCircle, Download, Printer,
  Search,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";
import TemplateLayoutToolbar from "../../components/TemplateLayoutToolbar";
import {
  loadLayout,
  getDisplayColumnOrder,
  getColumnWidth,
  getColumnLabel,
  type TemplateLayout,
} from "../../config/templateTableConfig";

const TEMPLATE_KEY = "account_statement";

/* ─── types ────────────────────────────────────────────────────────────── */
interface Transaction {
  id: number;
  entry_id: number;
  date: string;
  description: string;
  source_type: string;
  branch: string;
  debit: string;
  credit: string;
  balance: string;
}
interface StatementData {
  account_code: string;
  account_name: string;
  account_type: string;
  statement: string;
  from_date: string | null;
  to_date: string | null;
  transactions: Transaction[];
  total_debit: string;
  total_credit: string;
  closing_balance: string;
}
interface ChartAccountOption { id: number; code: string; name_ar: string; level: number; }

/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmt = (v: string) => {
  const n = parseFloat(v);
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SOURCE_LABELS: Record<string, string> = {
  shift_closing: "إقفال وردية",
  manual: "يدوي",
  goods_receipt: "استلام بضاعة",
  supplier_invoice: "فاتورة مورد",
  payroll: "رواتب",
  depreciation: "إهلاك",
  pos_sale: "نقاط البيع",
};

async function fetchStatement(params: Record<string, string>): Promise<StatementData> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetchWithCsrf(`/api/accounting/account-statement/?${qs}`);
  if (!res.ok) throw new Error(`فشل تحميل كشف الحساب (${res.status})`);
  return res.json();
}

async function fetchAccounts(): Promise<ChartAccountOption[]> {
  const res = await fetchWithCsrf("/api/accounting/chart/");
  if (!res.ok) return [];
  const d = await res.json();
  return (d.accounts || d || []).filter((a: ChartAccountOption) => a.level >= 3);
}

/* ─── component ───────────────────────────────────────────────────────── */
export default function AccountStatementPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";

  const [accounts, setAccounts]         = useState<ChartAccountOption[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [fromDate, setFromDate]         = useState(firstOfMonth);
  const [toDate, setToDate]             = useState(today);
  const [showPicker, setShowPicker]     = useState(false);

  const [data, setData]         = useState<StatementData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [tableLayout, setTableLayout] = useState<TemplateLayout | null>(() => loadLayout(TEMPLATE_KEY));
  const displayColumnOrder = useMemo(
    () => getDisplayColumnOrder(TEMPLATE_KEY, tableLayout, []),
    [tableLayout]
  );

  /* load chart accounts for autocomplete */
  useEffect(() => {
    fetchAccounts().then((r) => setAccounts(Array.isArray(r) ? r : [])).catch(() => setAccounts([]));
  }, []);

  const filtered = accountSearch
    ? accounts.filter((a) =>
        a.code.includes(accountSearch) || a.name_ar.includes(accountSearch)
      ).slice(0, 15)
    : accounts.slice(0, 15);

  const load = useCallback(async () => {
    if (!selectedCode) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { account_code: selectedCode };
      if (fromDate) params.from_date = fromDate;
      if (toDate)   params.to_date   = toDate;
      const d = await fetchStatement(params);
      setData(d);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedCode, fromDate, toDate]);

  useEffect(() => { if (selectedCode) load(); }, [selectedCode, load]);

  /* export CSV */
  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["التاريخ", "البيان", "المصدر", "الفرع", "مدين", "دائن", "الرصيد"],
      ...(Array.isArray(data?.transactions) ? data.transactions : []).map((t) => [
        t.date, t.description, SOURCE_LABELS[t.source_type] || t.source_type,
        t.branch, t.debit, t.credit, t.balance,
      ]),
      ["", "الإجمالي", "", "", data.total_debit, data.total_credit, data.closing_balance],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `account-${selectedCode}-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      <style>{`@media print { .no-print{display:none!important} }`}</style>

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/30">
              <BookOpen className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("كشف حساب", "Account Statement")}</h1>
              <p className="text-xs text-gray-400">
                {data ? `${data.account_code} — ${data.account_name}` : T("اختر حساباً لعرض حركاته", "Select an account to view its movements")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap no-print">
            {data && (
              <TemplateLayoutToolbar
                templateKey={TEMPLATE_KEY}
                onLayoutChange={(l) => setTableLayout(l)}
                isRTL={isRTL}
                T={T}
              />
            )}
            {data && (
              <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
                <Download className="h-4 w-4" /> {T("تصدير", "Export")}
              </button>
            )}
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
              <Printer className="h-4 w-4" />
            </button>
            {selectedCode && (
              <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161b27] border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        </div>

        {/* Account search + date filters */}
        <div className="flex flex-wrap gap-3">
          {/* Account picker */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={accountSearch || (selectedCode ? selectedCode : "")}
              onChange={(e) => { setAccountSearch(e.target.value); setShowPicker(true); }}
              onFocus={() => setShowPicker(true)}
              placeholder={T("ابحث عن حساب بالرقم أو الاسم...", "Search by code or name...")}
              className="w-full bg-[#161b27] border border-white/10 rounded-lg py-2 px-3 ps-8 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {showPicker && filtered.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-[#1e2533] border border-white/10 rounded-xl shadow-2xl z-20 max-h-52 overflow-y-auto">
                {filtered.map((a) => (
                  <button
                    key={a.id}
                    className="w-full text-start px-3 py-2 hover:bg-white/5 transition-colors text-sm"
                    onClick={() => {
                      setSelectedCode(a.code);
                      setAccountSearch(a.code + " — " + a.name_ar);
                      setShowPicker(false);
                    }}
                  >
                    <span className="font-mono text-xs text-gray-400 me-2">{a.code}</span>
                    <span className="text-white">{a.name_ar}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            <button onClick={load} disabled={!selectedCode}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
              {T("عرض", "View")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      {data && (
        <div className="px-4 md:px-6 pt-4 grid grid-cols-3 gap-3 no-print">
          {[
            { label: T("إجمالي المدين", "Total Debit"),    value: fmt(data.total_debit),      color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
            { label: T("إجمالي الدائن", "Total Credit"),   value: fmt(data.total_credit),     color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
            { label: T("الرصيد الختامي", "Closing Bal."), value: fmt(data.closing_balance),   color: parseFloat(data.closing_balance) >= 0 ? "text-emerald-400" : "text-red-400",
              bg: "bg-[#1e2533] border-white/10" },
          ].map((c) => (
            <div key={c.label} className={`${c.bg} border rounded-xl p-4 text-center`}>
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Transactions table ── */}
      <div className="px-4 md:px-6 py-4">
        {!selectedCode ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <BookOpen className="h-12 w-12 mb-3 opacity-40" />
            <p className="font-medium">{T("اختر حساباً من القائمة أعلاه", "Select an account from the list above")}</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
            <span className="ms-3 text-gray-400">{T("جارٍ التحميل...", "Loading...")}</span>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={load} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">{T("إعادة المحاولة", "Retry")}</button>
          </div>
        ) : data ? (
          data.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <BookOpen className="h-10 w-10 mb-2 opacity-40" />
              <p>{T("لا توجد حركات في هذه الفترة", "No transactions in this period")}</p>
            </div>
          ) : (
            <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed" style={{ minWidth: 700 }}>
                  <thead>
                    <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase tracking-wide">
                      {displayColumnOrder.map((colId) => (
                        <th
                          key={colId}
                          className={`px-4 py-3 ${colId === "debit" || colId === "credit" || colId === "balance" ? "text-end" : colId === "source" || colId === "branch" ? "text-center hidden md:table-cell" : "text-start"}`}
                          style={{ width: getColumnWidth(TEMPLATE_KEY, tableLayout, colId, false), minWidth: 60 }}
                        >
                          {getColumnLabel(TEMPLATE_KEY, colId, undefined, isRTL)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(data?.transactions) ? data.transactions : []).map((tx) => (
                      <tr key={tx.id} className="border-t border-white/5 hover:bg-white/5 transition-colors" style={{ height: tableLayout?.rowHeight ? `${tableLayout.rowHeight}px` : undefined }}>
                        {displayColumnOrder.map((colId) => {
                          const w = getColumnWidth(TEMPLATE_KEY, tableLayout, colId, false);
                          if (colId === "date") return <td key={colId} className="px-4 py-2.5 font-mono text-xs text-gray-400" style={{ width: w }}>{tx.date}</td>;
                          if (colId === "description") return <td key={colId} className="px-4 py-2.5 text-white text-sm" style={{ width: w }}>{tx.description}</td>;
                          if (colId === "source") return <td key={colId} className="px-4 py-2.5 text-center hidden md:table-cell" style={{ width: w }}><span className="text-xs bg-[#1e2533] text-gray-400 px-2 py-0.5 rounded">{SOURCE_LABELS[tx.source_type] || tx.source_type}</span></td>;
                          if (colId === "branch") return <td key={colId} className="px-4 py-2.5 text-center text-xs text-gray-400 hidden md:table-cell" style={{ width: w }}>{tx.branch || "—"}</td>;
                          if (colId === "debit") return <td key={colId} className="px-4 py-2.5 text-end font-mono" style={{ width: w }}>{parseFloat(tx.debit) > 0 ? <span className="text-blue-400">{fmt(tx.debit)}</span> : <span className="text-gray-600">—</span>}</td>;
                          if (colId === "credit") return <td key={colId} className="px-4 py-2.5 text-end font-mono" style={{ width: w }}>{parseFloat(tx.credit) > 0 ? <span className="text-purple-400">{fmt(tx.credit)}</span> : <span className="text-gray-600">—</span>}</td>;
                          if (colId === "balance") return <td key={colId} className="px-4 py-2.5 text-end font-mono" style={{ width: w }}><span className={parseFloat(tx.balance) >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(tx.balance)}</span></td>;
                          return <td key={colId} style={{ width: w }}>—</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#1e2533] border-t-2 border-white/20 font-bold text-sm" style={{ height: tableLayout?.rowHeight ? `${tableLayout.rowHeight}px` : undefined }}>
                      {(() => {
                        const idxDebit = displayColumnOrder.indexOf("debit");
                        const labelSpan = idxDebit >= 0 ? idxDebit : displayColumnOrder.length;
                        const rest = displayColumnOrder.slice(labelSpan);
                        return (
                          <>
                            <td colSpan={labelSpan} className="px-4 py-3 text-gray-300">{T("الإجمالي", "Total")}</td>
                            {rest.map((colId) => {
                              const w = getColumnWidth(TEMPLATE_KEY, tableLayout, colId, false);
                              if (colId === "debit") return <td key={colId} className="px-4 py-3 text-end text-blue-400 font-mono" style={{ width: w }}>{fmt(data.total_debit)}</td>;
                              if (colId === "credit") return <td key={colId} className="px-4 py-3 text-end text-purple-400 font-mono" style={{ width: w }}>{fmt(data.total_credit)}</td>;
                              if (colId === "balance") return <td key={colId} className="px-4 py-3 text-end" style={{ width: w }}><span className={parseFloat(data.closing_balance) >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(data.closing_balance)}</span></td>;
                              return <td key={colId} style={{ width: w }} />;
                            })}
                          </>
                        );
                      })()}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-white/5 text-xs text-gray-500">
                {T("عدد الحركات:", "Transactions:")} {data.transactions.length}
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
