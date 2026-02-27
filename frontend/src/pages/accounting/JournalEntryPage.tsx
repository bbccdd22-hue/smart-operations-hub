/**
 * قيد اليومية — Journal Entry
 * إدخال وعرض القيود المحاسبية (القيد المزدوج).
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList, Plus, Trash2, Save, RefreshCw, AlertCircle,
  Check, X, ChevronDown, Search, Eye, Calendar,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";

/* ─── types ────────────────────────────────────────────────────────────── */
interface EntryLine {
  id?: number;
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
}
interface JournalEntry {
  id: number;
  entry_date: string;
  description: string;
  source_type: string;
  branch: string;
  created_by: string;
  total_debit: string;
  is_balanced: boolean;
  lines: EntryLine[];
}
interface AccountOption { id: number; code: string; name_ar: string; level: number; }

/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmt = (v: string | number) => {
  const n = parseFloat(String(v));
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const emptyLine = (): EntryLine => ({ account_code: "", account_name: "", debit: "", credit: "" });

const SOURCE_LABELS: Record<string, string> = {
  shift_closing: "إقفال وردية", manual: "يدوي", goods_receipt: "استلام بضاعة",
  supplier_invoice: "فاتورة مورد", payroll: "رواتب", depreciation: "إهلاك", pos_sale: "نقاط البيع",
};

/* ─── component ───────────────────────────────────────────────────────── */
export default function JournalEntryPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const today = new Date().toISOString().slice(0, 10);

  /* form state */
  const [entryDate, setEntryDate]     = useState(today);
  const [description, setDescription] = useState("");
  const [lines, setLines]             = useState<EntryLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /* accounts autocomplete */
  const [accounts, setAccounts]   = useState<AccountOption[]>([]);
  const [acSearch, setAcSearch]   = useState<Record<number, string>>({});
  const [acPicker, setAcPicker]   = useState<number | null>(null);

  /* list state */
  const [entries, setEntries]     = useState<JournalEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [fromDate, setFromDate]   = useState(today.slice(0, 8) + "01");
  const [toDate, setToDate]       = useState(today);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /* load accounts */
  useEffect(() => {
    fetchWithCsrf("/api/accounting/chart/")
      .then((r: Response) => r.json())
      .then((d: { accounts?: AccountOption[] } | AccountOption[]) => {
        const arr = Array.isArray(d) ? d : (d as { accounts?: AccountOption[] }).accounts || [];
        setAccounts(arr.filter((a: AccountOption) => a.level >= 3));
      })
      .catch(() => {});
  }, []);

  /* load entries */
  const loadEntries = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const qs = new URLSearchParams({ from_date: fromDate, to_date: toDate }).toString();
      const res = await fetchWithCsrf(`/api/accounting/journal-entries/?${qs}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      setEntries(d.entries || []);
    } catch (e: unknown) {
      setListError((e as Error).message);
    } finally {
      setLoadingList(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  /* totals */
  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  /* account search filter */
  const getFilteredAccounts = (idx: number) => {
    const q = (acSearch[idx] || "").toLowerCase();
    if (!q) return accounts.slice(0, 10);
    return accounts.filter((a) => a.code.includes(q) || a.name_ar.toLowerCase().includes(q)).slice(0, 10);
  };

  /* line mutators */
  const setLineField = (idx: number, field: keyof EntryLine, val: string) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };
  const addLine    = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  /* save */
  const handleSave = async () => {
    if (!description.trim() || !entryDate || !isBalanced) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const payload = {
        entry_date: entryDate,
        description: description.trim(),
        lines: lines
          .filter((l) => l.account_code && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
          .map((l) => ({
            account_code: l.account_code,
            account_name: l.account_name,
            debit:  parseFloat(l.debit)  || 0,
            credit: parseFloat(l.credit) || 0,
          })),
      };
      const res = await fetchWithCsrf("/api/accounting/journal-entries/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "فشل الحفظ");
      }
      setSaveSuccess(true);
      setDescription("");
      setLines([emptyLine(), emptyLine()]);
      setAcSearch({});
      loadEntries();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: unknown) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /* delete entry */
  const handleDelete = async (id: number) => {
    if (!confirm(T("هل تريد حذف هذا القيد؟", "Delete this journal entry?"))) return;
    try {
      await fetchWithCsrf(`/api/accounting/journal-entries/${id}/`, { method: "DELETE" });
      loadEntries();
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
            <ClipboardList className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{T("قيد اليومية", "Journal Entry")}</h1>
            <p className="text-xs text-gray-400">{T("إدخال قيود محاسبية يدوية (قيد مزدوج)", "Manual double-entry bookkeeping")}</p>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6 grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ══ NEW ENTRY FORM ══ */}
        <div className="bg-[#161b27] border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
            <Plus className="h-4 w-4 text-amber-400" />
            <h2 className="font-semibold text-sm">{T("قيد جديد", "New Entry")}</h2>
          </div>
          <div className="p-5 space-y-4">
            {/* Date + Description */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T("تاريخ القيد", "Entry Date")}</label>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T("رقم القيد / المرجع", "Reference")}</label>
                <input type="text" placeholder={T("تلقائي", "Auto")} disabled
                  className="w-full bg-[#0e1117]/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-500 cursor-not-allowed" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{T("البيان", "Description")}</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={T("وصف موجز للقيد...", "Brief description...")}
                className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500" />
            </div>

            {/* Lines table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 500 }}>
                <thead>
                  <tr className="text-xs text-gray-400 uppercase border-b border-white/10">
                    <th className="pb-2 text-start">{T("الحساب", "Account")}</th>
                    <th className="pb-2 text-end w-28">{T("مدين", "Debit")}</th>
                    <th className="pb-2 text-end w-28">{T("دائن", "Credit")}</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="space-y-1">
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-b border-white/5">
                      {/* Account picker */}
                      <td className="py-1.5 pe-2 relative">
                        <input
                          type="text"
                          value={acSearch[idx] ?? (line.account_name ? `${line.account_code} ${line.account_name}` : "")}
                          onChange={(e) => {
                            setAcSearch((p) => ({ ...p, [idx]: e.target.value }));
                            setLineField(idx, "account_code", "");
                            setAcPicker(idx);
                          }}
                          onFocus={() => setAcPicker(idx)}
                          placeholder={T("ابحث عن حساب...", "Search account...")}
                          className="w-full bg-[#0e1117] border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
                        />
                        {acPicker === idx && (
                          <div className="absolute top-full mt-1 z-30 w-72 bg-[#1e2533] border border-white/10 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
                            {getFilteredAccounts(idx).map((a) => (
                              <button key={a.id} className="w-full text-start px-3 py-1.5 hover:bg-white/5 text-xs"
                                onClick={() => {
                                  setLineField(idx, "account_code", a.code);
                                  setLineField(idx, "account_name", a.name_ar);
                                  setAcSearch((p) => ({ ...p, [idx]: `${a.code} — ${a.name_ar}` }));
                                  setAcPicker(null);
                                }}>
                                <span className="font-mono text-gray-400 me-2">{a.code}</span>
                                <span className="text-white">{a.name_ar}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      {/* Debit */}
                      <td className="py-1.5 px-1">
                        <input type="number" min="0" step="any" placeholder="0.00"
                          value={line.debit}
                          onChange={(e) => { setLineField(idx, "debit", e.target.value); setLineField(idx, "credit", ""); }}
                          className="w-full bg-[#0e1117] border border-white/15 rounded-lg px-2 py-1.5 text-xs text-blue-400 text-end focus:outline-none focus:border-blue-500" />
                      </td>
                      {/* Credit */}
                      <td className="py-1.5 px-1">
                        <input type="number" min="0" step="any" placeholder="0.00"
                          value={line.credit}
                          onChange={(e) => { setLineField(idx, "credit", e.target.value); setLineField(idx, "debit", ""); }}
                          className="w-full bg-[#0e1117] border border-white/15 rounded-lg px-2 py-1.5 text-xs text-purple-400 text-end focus:outline-none focus:border-purple-500" />
                      </td>
                      {/* Remove */}
                      <td className="py-1.5 ps-1">
                        <button onClick={() => removeLine(idx)} disabled={lines.length <= 2}
                          className="p-1 rounded-lg text-gray-600 hover:text-red-400 disabled:opacity-30 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 text-xs font-semibold">
                    <td className="pt-2 text-gray-400">{T("الإجمالي", "Total")}</td>
                    <td className="pt-2 text-end text-blue-400 font-mono">{totalDebit.toFixed(2)}</td>
                    <td className="pt-2 text-end text-purple-400 font-mono">{totalCredit.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Balance indicator */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
              isBalanced && totalDebit > 0 ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
            }`}>
              {isBalanced && totalDebit > 0
                ? <><Check className="h-3.5 w-3.5" />{T("القيد متوازن", "Entry is balanced")}</>
                : <><AlertCircle className="h-3.5 w-3.5" />{isBalanced ? T("أدخل المبالغ", "Enter amounts") : T(`فرق: ${Math.abs(totalDebit - totalCredit).toFixed(2)}`, `Difference: ${Math.abs(totalDebit - totalCredit).toFixed(2)}`)}</>
              }
            </div>

            {/* Add line + save */}
            <div className="flex gap-2">
              <button onClick={addLine}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0e1117] border border-white/10 text-xs text-gray-400 hover:text-white transition-colors">
                <Plus className="h-3.5 w-3.5" /> {T("إضافة سطر", "Add Line")}
              </button>
              <button onClick={handleSave}
                disabled={saving || !isBalanced || totalDebit === 0 || !description.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? T("جارٍ الحفظ...", "Saving...") : T("حفظ القيد", "Save Entry")}
              </button>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5" /> {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-xs text-emerald-400">
                <Check className="h-3.5 w-3.5" /> {T("تم حفظ القيد بنجاح", "Entry saved successfully")}
              </div>
            )}
          </div>
        </div>

        {/* ══ ENTRIES LIST ══ */}
        <div className="bg-[#161b27] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-amber-400" />
              <h2 className="font-semibold text-sm">{T("سجل القيود", "Journal Entries Log")}</h2>
            </div>
            <div className="flex gap-2">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="bg-[#0e1117] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="bg-[#0e1117] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500" />
              <button onClick={loadEntries}
                className="p-1.5 rounded-lg bg-[#0e1117] border border-white/10 text-gray-400 hover:text-white transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-5 w-5 animate-spin text-amber-400" />
              </div>
            ) : listError ? (
              <div className="text-center py-10 text-red-400 text-sm">{listError}</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{T("لا توجد قيود في هذه الفترة", "No entries in this period")}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <div key={entry.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-gray-500">#{entry.id}</span>
                          <span className="text-xs bg-[#1e2533] text-gray-400 px-2 py-0.5 rounded">
                            {SOURCE_LABELS[entry.source_type] || entry.source_type}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            entry.is_balanced
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>
                            {entry.is_balanced ? T("متوازن", "Balanced") : T("غير متوازن", "Unbalanced")}
                          </span>
                        </div>
                        <p className="text-sm text-white font-medium mt-1 truncate">{entry.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span><Calendar className="h-3 w-3 inline me-1" />{entry.entry_date}</span>
                          {entry.branch && <span>{entry.branch}</span>}
                          <span className="text-amber-400 font-mono">{fmt(entry.total_debit)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          className="p-1.5 rounded-lg bg-[#1e2533] text-gray-400 hover:text-white transition-colors">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {entry.source_type === "manual" && (
                          <button onClick={() => handleDelete(entry.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded lines */}
                    {expandedId === entry.id && (
                      <div className="mt-3 bg-[#0e1117] rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-white/5">
                              <th className="px-3 py-2 text-start">{T("الحساب", "Account")}</th>
                              <th className="px-3 py-2 text-end">{T("مدين", "Debit")}</th>
                              <th className="px-3 py-2 text-end">{T("دائن", "Credit")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.lines.map((line, i) => (
                              <tr key={i} className="border-t border-white/5">
                                <td className="px-3 py-1.5">
                                  <span className="font-mono text-gray-500 me-1">{line.account_code}</span>
                                  <span className="text-white">{line.account_name}</span>
                                </td>
                                <td className="px-3 py-1.5 text-end text-blue-400 font-mono">
                                  {parseFloat(line.debit) > 0 ? fmt(line.debit) : "—"}
                                </td>
                                <td className="px-3 py-1.5 text-end text-purple-400 font-mono">
                                  {parseFloat(line.credit) > 0 ? fmt(line.credit) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
