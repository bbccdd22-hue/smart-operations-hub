/**
 * قيد اليومية — Journal Entry
 * إدخال وعرض القيود المحاسبية (القيد المزدوج) مع أبعاد اختيارية (فرع، علامة، مركز تكلفة، موظف).
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList, Plus, Trash2, Save, RefreshCw, AlertCircle,
  Check, Eye, Calendar, Layers, Filter,
} from "lucide-react";
import { fetchWithCsrf, fetchBranches, fetchBrands, fetchCostCenters, fetchEmployees } from "../../lib/api";
import type { Branch } from "../../lib/api";
import type { Brand } from "../../lib/api";
import type { CostCenterOption, EmployeeOption } from "../../lib/api";

/* ─── types ────────────────────────────────────────────────────────────── */
interface EntryLine {
  id?: number;
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
  line_reference?: string;  /* مرجع السطر → reference_id */
  branch_id?: number | null;
  brand_id?: number | null;
  cost_center_id?: number | null;
  employee_id?: number | null;
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
  lines: (EntryLine & { branch_name?: string | null; brand_name?: string | null; cost_center_name?: string | null; employee_name?: string | null })[];
}
interface AccountOption { id: number; code: string; name_ar: string; level: number; }

/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmt = (v: string | number) => {
  const n = parseFloat(String(v));
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const emptyLine = (): EntryLine => ({
  account_code: "", account_name: "", debit: "", credit: "", line_reference: "",
  branch_id: null, brand_id: null, cost_center_id: null, employee_id: null,
});

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
  const [entryDate, setEntryDate]         = useState(today);
  const [description, setDescription]     = useState("");
  const [journalRef, setJournalRef]       = useState("");
  const [totalJournalValue, setTotalJournalValue] = useState("");
  const [reverseEntry, setReverseEntry]   = useState(false);
  const [stage, setStage]                 = useState(false);
  const [equipped, setEquipped]           = useState(true);
  const [currency, setCurrency]           = useState("SAR");
  const [conversionRate, setConversionRate] = useState("1");
  const [movementType, setMovementType]   = useState("manual");
  const [lines, setLines]                = useState<EntryLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving]              = useState(false);
  const [saveError, setSaveError]        = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess]    = useState(false);

  /* accounts autocomplete */
  const [accounts, setAccounts]   = useState<AccountOption[]>([]);
  const [acSearch, setAcSearch]   = useState<Record<number, string>>({});
  const [acPicker, setAcPicker]   = useState<number | null>(null);

  /* dimension options */
  const [branches, setBranches]       = useState<Branch[]>([]);
  const [brands, setBrands]           = useState<Brand[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([]);
  const [employees, setEmployees]    = useState<EmployeeOption[]>([]);
  const [dimPicker, setDimPicker]     = useState<{ lineIdx: number; field: "branch" | "brand" | "cost_center" | "employee" } | null>(null);
  const [dimSearch, setDimSearch]     = useState<string>("");
  const [dimPopoverLineIdx, setDimPopoverLineIdx] = useState<number | null>(null);

  /* list state */
  const [entries, setEntries]     = useState<JournalEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [fromDate, setFromDate]   = useState(today.slice(0, 8) + "01");
  const [toDate, setToDate]       = useState(today);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"new" | "log">("new");

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

  /* load dimension options */
  useEffect(() => {
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
    fetchCostCenters().then((r) => setCostCenters(Array.isArray(r) ? r : [])).catch(() => setCostCenters([]));
    fetchEmployees().then((r) => setEmployees(Array.isArray(r) ? r : [])).catch(() => setEmployees([]));
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
  const totalValNum = totalJournalValue.trim() ? parseFloat(totalJournalValue) : NaN;
  const totalMatchesValue = isNaN(totalValNum) || (Math.abs(totalDebit - totalValNum) < 0.01 && Math.abs(totalCredit - totalValNum) < 0.01);
  const linesWithAmount = lines.filter((l) => l.account_code && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
  const everyLineHasCostCenter = linesWithAmount.length === 0 || linesWithAmount.every((l) => l.cost_center_id != null);

  /* account search filter */
  const getFilteredAccounts = (idx: number) => {
    const q = (acSearch[idx] || "").toLowerCase();
    if (!q) return accounts.slice(0, 10);
    return accounts.filter((a) => a.code.includes(q) || a.name_ar.toLowerCase().includes(q)).slice(0, 10);
  };

  /* line mutators */
  const setLineField = (idx: number, field: keyof EntryLine, val: string | number | null) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };
  const addLine    = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  /* dimension display label for a line */
  const getBranchLabel = (id: number | null | undefined) => branches.find((b) => b.id === id)?.name ?? "";
  const getBrandLabel  = (id: number | null | undefined) => brands.find((b) => b.id === id)?.name ?? "";
  const getCostCenterLabel = (id: number | null | undefined) => costCenters.find((c) => c.id === id)?.code ?? costCenters.find((c) => c.id === id)?.name ?? "";
  const getEmployeeLabel   = (id: number | null | undefined) => {
    const e = employees.find((emp) => emp.id === id);
    return e ? `${e.employee_id} ${e.first_name} ${e.last_name}` : "";
  };

  /* filtered dimension options for picker */
  const getFilteredBranches = () => {
    const q = dimSearch.toLowerCase();
    if (!q) return branches.slice(0, 15);
    return branches.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 15);
  };
  const getFilteredBrands = () => {
    const q = dimSearch.toLowerCase();
    if (!q) return brands.slice(0, 15);
    return brands.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 15);
  };
  /** مراكز التكلفة حسب الفرع والعلامة (كل فرع/براند له مراكز تكلفة) */
  const getFilteredCostCenters = (line?: EntryLine | null) => {
    let list = costCenters;
    if (line?.branch_id != null) list = list.filter((c) => c.branch_id === line.branch_id);
    if (line?.brand_id != null) list = list.filter((c) => c.brand_id === line.brand_id);
    const q = dimSearch.toLowerCase();
    if (q) list = list.filter((c) => c.code.toLowerCase().includes(q) || (c.name || "").toLowerCase().includes(q) || (c.name_ar || "").toLowerCase().includes(q));
    return list.slice(0, 25);
  };
  const getFilteredEmployees = () => {
    const q = dimSearch.toLowerCase();
    if (!q) return employees.slice(0, 15);
    return employees.filter((e) =>
      e.employee_id.toLowerCase().includes(q) || e.first_name.toLowerCase().includes(q) || e.last_name.toLowerCase().includes(q)
    ).slice(0, 15);
  };

  /* save */
  const handleSave = async () => {
    if (!description.trim() || !entryDate || !isBalanced) return;
    if (!totalMatchesValue) {
      setSaveError(T("إجمالي المدين والدائن يجب أن يطابق إجمالي قيمة القيد", "Debit/Credit total must match journal total value"));
      return;
    }
    if (!everyLineHasCostCenter) {
      setSaveError(T("يجب اختيار مركز تكلفة لكل سطر (مركز التكلفة إجباري لكل حساب)", "Cost center is required for each line"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const payload = {
        entry_date: entryDate,
        description: description.trim(),
        reference: journalRef.trim().slice(0, 64),
        lines: lines
          .filter((l) => l.account_code && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
          .map((l) => ({
            account_code: l.account_code,
            account_name: l.account_name,
            debit:  parseFloat(l.debit)  || 0,
            credit: parseFloat(l.credit) || 0,
            reference_id: (l.line_reference || "").trim().slice(0, 64),
            branch_id: l.branch_id ?? undefined,
            brand_id: l.brand_id ?? undefined,
            cost_center_id: l.cost_center_id ?? undefined,
            employee_id: l.employee_id ?? undefined,
          })),
      };
      const res = await fetchWithCsrf("/api/accounting/journal-entries/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const msg = typeof d.detail === "string" ? d.detail : d.detail?.message || JSON.stringify(d) || "فشل الحفظ";
        throw new Error(msg);
      }
      setSaveSuccess(true);
      setDescription("");
      setJournalRef("");
      setTotalJournalValue("");
      setLines([emptyLine(), emptyLine()]);
      setAcSearch({});
      setDimPicker(null);
      setDimPopoverLineIdx(null);
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

      {/* ── Header + Tabs ── */}
      <div className="sticky top-0 z-10 bg-[#0e1117]/95 backdrop-blur border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/30 shadow-lg shadow-amber-500/5">
              <ClipboardList className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{T("قيد اليومية", "Journal Entry")}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{T("إدخال قيود محاسبية يدوية — قيد مزدوج مع أبعاد اختيارية", "Manual double-entry bookkeeping with optional dimensions")}</p>
            </div>
          </div>
          {/* تبويبات */}
          <div className="flex rounded-xl bg-[#161b27] p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "new"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Plus className="h-4 w-4" />
              {T("قيد جديد", "New Entry")}
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("log"); loadEntries(); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "log"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              {T("سجل القيود", "Entries Log")}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
        {activeTab === "new" && (
        /* ══ NEW ENTRY FORM — full width ══ */
        <div className="bg-[#161b27] border border-white/10 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
          <div className="px-5 py-4 border-b border-white/10 bg-[#1e2533]/50 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <Plus className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">{T("قيد جديد", "New Entry")}</h2>
              <p className="text-xs text-gray-500">{T("بيانات القيد وسطور المدين والدائن", "Entry details and debit/credit lines")}</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {/* ── رأس القيد (مثل الصورة) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("المرجع", "Reference")}</label>
                <input type="text" value={journalRef} onChange={(e) => setJournalRef(e.target.value)} placeholder="—"
                  className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("عدد الحركات", "No. of lines")}</label>
                <div className="px-2 py-1.5 rounded-lg bg-[#1e2533] border border-white/10 text-xs text-amber-400 font-mono">{lines.length}</div>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                  <input type="checkbox" checked={reverseEntry} onChange={(e) => setReverseEntry(e.target.checked)} className="rounded" />
                  {T("عكس قيد", "Reverse")}
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                  <input type="checkbox" checked={stage} onChange={(e) => setStage(e.target.checked)} className="rounded" />
                  {T("مرحلة", "Stage")}
                </label>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  <input type="radio" name="equipped" checked={equipped} onChange={() => setEquipped(true)} /> {T("مجهزة", "Equipped")}
                </label>
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  <input type="radio" name="equipped" checked={!equipped} onChange={() => setEquipped(false)} /> {T("ع مجهزة", "Not")}
                </label>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("العملة", "Currency")}</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white">
                  <option value="SAR">SAR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("إجمالي الحركة", "Total movement")} <span className="text-gray-600">({T("النظام", "System")})</span></label>
                <div className="px-2 py-1.5 rounded-lg bg-[#1e2533] border border-amber-500/20 text-xs text-amber-400 text-end font-mono">{totalDebit.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("سعر التحويل", "Rate")}</label>
                <input type="text" value={conversionRate} onChange={(e) => setConversionRate(e.target.value)} className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-end" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("التاريخ", "Date")}</label>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("نوع الحركة", "Movement type")}</label>
                <select value={movementType} onChange={(e) => setMovementType(e.target.value)} className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white">
                  <option value="manual">{T("يدوي", "Manual")}</option>
                  <option value="shift_closing">{T("إقفال وردية", "Shift closing")}</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("رقم الحركة", "Movement no.")}</label>
                <div className="px-2 py-1.5 rounded-lg bg-[#0e1117]/50 border border-white/10 text-xs text-gray-500">—</div>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("وصف الحركة", "Description")}</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={T("وصف موجز...", "Brief description...")}
                  className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("اجمالي قيمة القيد", "Total value")}</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={totalJournalValue} onChange={(e) => setTotalJournalValue(e.target.value)}
                  className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-amber-400 text-end" />
              </div>
            </div>

            {/* ── جدول سطور القيد (أعمدة مثل الصورة) ── */}
            <div className="overflow-x-auto rounded-xl border border-white/10" style={{ minWidth: 0 }}>
              <table className="w-full text-xs" style={{ minWidth: 1100 }}>
                <thead>
                  <tr className="bg-[#1e2533] text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                    <th className="py-2 px-1.5 w-8 text-center">#</th>
                    <th className="py-2 px-1.5 min-w-[70px]">{T("المرجع", "Ref")}</th>
                    <th className="py-2 px-1.5 min-w-[80px]">{T("التاريخ", "Date")}</th>
                    <th className="py-2 px-1.5 min-w-[100px] text-center">{T("المشروع", "Cost center")}</th>
                    <th className="py-2 px-1.5 min-w-[120px]">{T("الوصف", "Description")}</th>
                    <th className="py-2 px-1.5 w-24 text-end">{T("مدين", "Debit")}</th>
                    <th className="py-2 px-1.5 w-24 text-end">{T("دائن", "Credit")}</th>
                    <th className="py-2 px-1.5 w-20 text-end">{T("أجنبي", "Foreign")}</th>
                    <th className="py-2 px-1.5 w-16">{T("الحالة", "Status")}</th>
                    <th className="py-2 px-1.5 min-w-[180px]">{T("اسم الحساب", "Account name")}</th>
                    <th className="py-2 px-1.5 min-w-[80px]">{T("رقم الحساب", "Account no.")}</th>
                    <th className="py-2 px-1.5 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="py-1.5 px-1.5 text-center text-gray-500 font-mono">{idx + 1}</td>
                      <td className="py-1.5 px-1.5">
                        <input type="text" value={line.line_reference ?? ""} onChange={(e) => setLineField(idx, "line_reference", e.target.value)} placeholder="—"
                          className="w-full bg-[#0e1117] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white" />
                      </td>
                      <td className="py-1.5 px-1.5 text-gray-400">{entryDate}</td>
                      <td className="py-1.5 px-1.5 text-center">
                        <button type="button" onClick={() => { setDimPicker(null); setDimSearch(""); setDimPopoverLineIdx(dimPopoverLineIdx === idx ? null : idx); }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${line.cost_center_id ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"}`}>
                          <Layers className="h-3 w-3" />
                          {line.cost_center_id ? getCostCenterLabel(line.cost_center_id) : T("مشروع", "Project")}
                        </button>
                      </td>
                      <td className="py-1.5 px-1.5">
                        <input type="text" placeholder="—" className="w-full bg-[#0e1117] border border-white/10 rounded px-1.5 py-1 text-[11px] text-gray-400" readOnly />
                      </td>
                      <td className="py-1.5 px-1.5">
                        <input type="number" min="0" step="any" placeholder="0.00" value={line.debit} onChange={(e) => { setLineField(idx, "debit", e.target.value); setLineField(idx, "credit", ""); }}
                          className="w-full bg-[#0e1117] border border-white/15 rounded px-1.5 py-1 text-[11px] text-blue-400 text-end" />
                      </td>
                      <td className="py-1.5 px-1.5">
                        <input type="number" min="0" step="any" placeholder="0.00" value={line.credit} onChange={(e) => { setLineField(idx, "credit", e.target.value); setLineField(idx, "debit", ""); }}
                          className="w-full bg-[#0e1117] border border-white/15 rounded px-1.5 py-1 text-[11px] text-purple-400 text-end" />
                      </td>
                      <td className="py-1.5 px-1.5 text-gray-500">—</td>
                      <td className="py-1.5 px-1.5 text-gray-500">عادي</td>
                      <td className="py-1.5 px-1.5 relative">
                        <input type="text" value={acSearch[idx] ?? (line.account_name ? `${line.account_code} — ${line.account_name}` : "")}
                          onChange={(e) => { setAcSearch((p) => ({ ...p, [idx]: e.target.value })); setLineField(idx, "account_code", ""); setAcPicker(idx); }}
                          onFocus={() => setAcPicker(idx)}
                          placeholder={T("اسم الحساب...", "Account...")}
                          className="w-full bg-[#0e1117] border border-white/15 rounded px-1.5 py-1 text-[11px] text-white placeholder-gray-500"
                        />
                        {acPicker === idx && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-40 min-w-[260px] bg-[#1e2533] border border-white/10 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                            {getFilteredAccounts(idx).map((a) => (
                              <button key={a.id} type="button" className="w-full text-start px-2 py-1.5 hover:bg-white/5 text-[11px] border-b border-white/5 last:border-0"
                                onClick={() => { setLineField(idx, "account_code", a.code); setLineField(idx, "account_name", a.name_ar); setAcSearch((p) => ({ ...p, [idx]: `${a.code} — ${a.name_ar}` })); setAcPicker(null); }}>
                                <span className="font-mono text-amber-400/90 me-2">{a.code}</span>
                                <span className="text-white">{a.name_ar}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-1.5 font-mono text-amber-400/90">{line.account_code || "—"}</td>
                      <td className="py-1.5 px-1.5">
                        <button type="button" onClick={() => removeLine(idx)} disabled={lines.length <= 2} className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/10 bg-[#1e2533]/50 text-[11px] font-semibold">
                    <td className="py-2 px-1.5" colSpan={5}></td>
                    <td className="py-2 px-1.5 text-end text-blue-400 font-mono">{totalDebit.toFixed(2)}</td>
                    <td className="py-2 px-1.5 text-end text-purple-400 font-mono">{totalCredit.toFixed(2)}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── تذييل: بيانات الضريبة + إتزان الحركة ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 p-4 rounded-xl bg-[#1e2533]/30 border border-white/10">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("بيانات الضريبة", "Tax data")}</label>
                <div className="text-[11px] text-gray-400">{T("الرقم الضريبي", "Tax no.")} / {T("مبلغ الفاتورة", "Invoice amt.")}</div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("مدين", "Debit")}</label>
                <div className="px-2 py-1.5 rounded-lg bg-[#0e1117] border border-blue-500/20 text-xs text-blue-400 text-end font-mono">{totalDebit.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("دائن", "Credit")}</label>
                <div className="px-2 py-1.5 rounded-lg bg-[#0e1117] border border-purple-500/20 text-xs text-purple-400 text-end font-mono">{totalCredit.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("باقي الإتزان الحركة", "Balance diff")}</label>
                <div className={`px-2 py-1.5 rounded-lg text-xs text-end font-mono ${Math.abs(totalDebit - totalCredit) < 0.01 ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border border-amber-500/20 text-amber-400"}`}>
                  {(totalDebit - totalCredit).toFixed(2)}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] text-gray-500 mb-0.5">{T("مدخل الحركة", "Entered by")} / {T("وقت الإدخال", "Entry time")}</label>
                <div className="text-[11px] text-gray-500">—</div>
              </div>
            </div>

            {/* Balance indicator */}
            <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
              isBalanced && totalMatchesValue && totalDebit > 0 && everyLineHasCostCenter ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
            }`}>
              {!everyLineHasCostCenter && linesWithAmount.length > 0 && <><AlertCircle className="h-5 w-5 shrink-0" />{T("اختر مركز تكلفة لكل سطر", "Select cost center for each line")}</>}
              {everyLineHasCostCenter && !totalMatchesValue && totalJournalValue.trim() && <><AlertCircle className="h-5 w-5 shrink-0" />{T("إجمالي المدين والدائن يجب أن يطابق إجمالي قيمة القيد", "Debit/credit must match journal total")}</>}
              {everyLineHasCostCenter && (totalMatchesValue || !totalJournalValue.trim()) && (isBalanced && totalDebit > 0
                ? <><Check className="h-5 w-5 shrink-0" />{T("القيد متوازن — جاهز للحفظ", "Entry is balanced — ready to save")}</>
                : <><AlertCircle className="h-5 w-5 shrink-0" />{isBalanced ? T("أدخل المبالغ في السطور", "Enter amounts in lines") : T("فرق غير متوازن:", "Unbalanced:")} <span className="font-mono font-bold">{Math.abs(totalDebit - totalCredit).toFixed(2)}</span></>)}
            </div>

            {/* Add line + save */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={addLine}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e2533] border border-white/10 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                <Plus className="h-4 w-4" /> {T("إضافة سطر", "Add Line")}
              </button>
              <button type="button" onClick={handleSave}
                disabled={saving || !isBalanced || totalDebit === 0 || !description.trim() || !totalMatchesValue || !everyLineHasCostCenter}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-amber-500/20 transition-all">
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

            {/* ── نافذة الأبعاد (مركز التكلفة إجباري) ── */}
            {dimPopoverLineIdx != null && (() => {
              const idx = dimPopoverLineIdx;
              const line = lines[idx] ?? emptyLine();
              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setDimPopoverLineIdx(null); setDimPicker(null); setDimSearch(""); }} />
                  <div className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-2xl bg-[#1e2533] border border-white/10 shadow-2xl flex flex-col">
                    <div className="px-4 py-3 border-b border-white/10 bg-[#0e1117]/80 flex items-center justify-between">
                      <span className="text-sm font-medium text-amber-400/90">
                        {T("أبعاد السطر", "Line dimensions")} #{idx + 1} — {T("مركز التكلفة إجباري", "Cost center required")}
                      </span>
                      <button type="button" onClick={() => { setDimPopoverLineIdx(null); setDimPicker(null); setDimSearch(""); }} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">×</button>
                    </div>
                    <div className="p-4 space-y-4 overflow-y-auto flex-1">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{T("الفرع", "Branch")}</label>
                        <div className="relative">
                          <button type="button" onClick={() => { setDimSearch(""); setDimPicker(dimPicker?.field === "branch" ? null : { lineIdx: idx, field: "branch" }); }} className="w-full text-start px-3 py-2 rounded-lg bg-[#0e1117] border border-white/10 text-sm text-gray-300">{getBranchLabel(line.branch_id) || "—"}</button>
                          {dimPicker?.lineIdx === idx && dimPicker?.field === "branch" && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-[#1e2533] border border-white/10 rounded-lg overflow-hidden shadow-xl">
                              <input type="text" value={dimSearch} onChange={(e) => setDimSearch(e.target.value)} placeholder={T("بحث...", "Search...")} className="w-full px-3 py-2 bg-[#0e1117] border-b border-white/10 text-sm text-white" autoFocus />
                              <div className="max-h-40 overflow-y-auto">
                                <button type="button" className="w-full text-start px-3 py-2 text-sm hover:bg-white/5 text-gray-400" onClick={() => { setLineField(idx, "branch_id", null); setDimPicker(null); setDimSearch(""); }}>—</button>
                                {getFilteredBranches().map((b) => <button key={b.id} type="button" className="w-full text-start px-3 py-2 text-sm hover:bg-white/5" onClick={() => { setLineField(idx, "branch_id", b.id); setDimPicker(null); setDimSearch(""); }}>{b.name}</button>)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{T("العلامة", "Brand")}</label>
                        <div className="relative">
                          <button type="button" onClick={() => { setDimSearch(""); setDimPicker(dimPicker?.field === "brand" ? null : { lineIdx: idx, field: "brand" }); }} className="w-full text-start px-3 py-2 rounded-lg bg-[#0e1117] border border-white/10 text-sm text-gray-300">{getBrandLabel(line.brand_id) || "—"}</button>
                          {dimPicker?.lineIdx === idx && dimPicker?.field === "brand" && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-[#1e2533] border border-white/10 rounded-lg overflow-hidden shadow-xl">
                              <input type="text" value={dimSearch} onChange={(e) => setDimSearch(e.target.value)} placeholder={T("بحث...", "Search...")} className="w-full px-3 py-2 bg-[#0e1117] border-b border-white/10 text-sm text-white" autoFocus />
                              <div className="max-h-40 overflow-y-auto">
                                <button type="button" className="w-full text-start px-3 py-2 text-sm hover:bg-white/5 text-gray-400" onClick={() => { setLineField(idx, "brand_id", null); setDimPicker(null); setDimSearch(""); }}>—</button>
                                {getFilteredBrands().map((b) => <button key={b.id} type="button" className="w-full text-start px-3 py-2 text-sm hover:bg-white/5" onClick={() => { setLineField(idx, "brand_id", b.id); setDimPicker(null); setDimSearch(""); }}>{b.name}</button>)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{T("مركز التكلفة (مطلوب)", "Cost Center (required)")} <span className="text-amber-400">*</span></label>
                        <div className="relative">
                          <button type="button" onClick={() => { setDimSearch(""); setDimPicker(dimPicker?.field === "cost_center" ? null : { lineIdx: idx, field: "cost_center" }); }} className={`w-full text-start px-3 py-2 rounded-lg border text-sm ${line.cost_center_id ? "bg-[#0e1117] border-white/10 text-gray-300" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}>{getCostCenterLabel(line.cost_center_id) || T("اختر مركز تكلفة (حسب الفرع/العلامة)", "Select cost center (by branch/brand)")}</button>
                          {dimPicker?.lineIdx === idx && dimPicker?.field === "cost_center" && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-[#1e2533] border border-white/10 rounded-lg overflow-hidden shadow-xl">
                              <input type="text" value={dimSearch} onChange={(e) => setDimSearch(e.target.value)} placeholder={T("بحث برمز أو اسم...", "Search by code or name...")} className="w-full px-3 py-2 bg-[#0e1117] border-b border-white/10 text-sm text-white" autoFocus />
                              <div className="max-h-48 overflow-y-auto">
                                <button type="button" className="w-full text-start px-3 py-2 text-sm hover:bg-white/5 text-gray-400" onClick={() => { setLineField(idx, "cost_center_id", null); setDimPicker(null); setDimSearch(""); }}>—</button>
                                {getFilteredCostCenters(line).map((c) => <button key={c.id} type="button" className="w-full text-start px-3 py-2 text-sm hover:bg-white/5" onClick={() => { setLineField(idx, "cost_center_id", c.id); setDimPicker(null); setDimSearch(""); }}>{c.code} — {c.name_ar || c.name} {c.branch_name ? `(${c.branch_name})` : ""}</button>)}
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">{T("مركز التكلفة يتبع الفرع والعلامة (مثلاً فرع الرصيفة #5)", "Cost center is per branch/brand (e.g. branch 5)")}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{T("الموظف", "Employee")}</label>
                        <div className="relative">
                          <button type="button" onClick={() => { setDimSearch(""); setDimPicker(dimPicker?.field === "employee" ? null : { lineIdx: idx, field: "employee" }); }} className="w-full text-start px-3 py-2 rounded-lg bg-[#0e1117] border border-white/10 text-sm text-gray-300">{getEmployeeLabel(line.employee_id) || "—"}</button>
                          {dimPicker?.lineIdx === idx && dimPicker?.field === "employee" && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-[#1e2533] border border-white/10 rounded-lg overflow-hidden shadow-xl">
                              <input type="text" value={dimSearch} onChange={(e) => setDimSearch(e.target.value)} placeholder={T("بحث...", "Search...")} className="w-full px-3 py-2 bg-[#0e1117] border-b border-white/10 text-sm text-white" autoFocus />
                              <div className="max-h-40 overflow-y-auto">
                                <button type="button" className="w-full text-start px-3 py-2 text-sm hover:bg-white/5 text-gray-400" onClick={() => { setLineField(idx, "employee_id", null); setDimPicker(null); setDimSearch(""); }}>—</button>
                                {getFilteredEmployees().map((e) => <button key={e.id} type="button" className="w-full text-start px-3 py-2 text-sm hover:bg-white/5" onClick={() => { setLineField(idx, "employee_id", e.id); setDimPicker(null); setDimSearch(""); }}>{e.employee_id} {e.first_name} {e.last_name}</button>)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 border-t border-white/10 bg-[#0e1117]/50 flex justify-end">
                      <button type="button" onClick={() => { setDimPopoverLineIdx(null); setDimPicker(null); setDimSearch(""); }} className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 text-sm font-medium">{T("إغلاق", "Close")}</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        )}

        {/* ══ ENTRIES LIST (تبويب منفصل) ══ */}
        {activeTab === "log" && (
        <div className="bg-[#161b27] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-xl shadow-black/20 min-h-[420px]">
          <div className="px-5 py-4 border-b border-white/10 bg-[#1e2533]/50 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20">
                <ClipboardList className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">{T("سجل القيود", "Journal Entries Log")}</h2>
                <p className="text-xs text-gray-500">{T("عرض القيود حسب الفترة", "View entries by period")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="bg-[#0e1117] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
              <span className="text-gray-500 text-xs">–</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="bg-[#0e1117] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
              <button type="button" onClick={loadEntries}
                className="p-2 rounded-lg bg-[#0e1117] border border-white/10 text-gray-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors">
                <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[320px]">
            {loadingList ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
                <p className="text-sm text-gray-500">{T("جاري التحميل...", "Loading...")}</p>
              </div>
            ) : listError ? (
              <div className="text-center py-12 px-4">
                <AlertCircle className="h-10 w-10 mx-auto mb-2 text-red-400" />
                <p className="text-sm text-red-400">{listError}</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-gray-500">
                <div className="p-4 rounded-2xl bg-[#0e1117] border border-white/5 mb-4">
                  <ClipboardList className="h-12 w-12 opacity-50" />
                </div>
                <p className="text-sm font-medium text-gray-400">{T("لا توجد قيود في هذه الفترة", "No entries in this period")}</p>
                <p className="text-xs mt-1">{T("غيّر نطاق التاريخ أو أنشئ قيداً جديداً", "Change date range or create a new entry")}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <div key={entry.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-medium text-amber-400/90">#{entry.id}</span>
                          <span className="text-xs bg-[#1e2533] text-gray-400 px-2.5 py-1 rounded-lg border border-white/5">
                            {SOURCE_LABELS[entry.source_type] || entry.source_type}
                          </span>
                          <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                            entry.is_balanced
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>
                            {entry.is_balanced ? T("متوازن", "Balanced") : T("غير متوازن", "Unbalanced")}
                          </span>
                        </div>
                        <p className="text-sm text-white font-medium mt-2 truncate">{entry.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3" />{entry.entry_date}</span>
                          {entry.branch && <span className="text-gray-400">{entry.branch}</span>}
                          <span className="text-amber-400 font-mono font-semibold">{fmt(entry.total_debit)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          className="p-2 rounded-xl bg-[#1e2533] text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-colors"
                          title={T("عرض السطور", "View lines")}>
                          <Eye className="h-4 w-4" />
                        </button>
                        {entry.source_type === "manual" && (
                          <button type="button" onClick={() => handleDelete(entry.id)}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-transparent hover:border-red-500/30 transition-colors"
                            title={T("حذف القيد", "Delete entry")}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded lines — with optional dimensions */}
                    {expandedId === entry.id && (
                      <div className="mt-4 bg-[#0e1117] rounded-xl overflow-x-auto border border-white/10">
                        <table className="w-full text-xs" style={{ minWidth: 600 }}>
                          <thead>
                            <tr className="bg-[#1e2533]/80 text-gray-400 border-b border-white/10">
                              <th className="px-3 py-2.5 text-start font-medium">#</th>
                              <th className="px-3 py-2.5 text-start font-medium">{T("الحساب", "Account")}</th>
                              <th className="px-3 py-2.5 text-end font-medium">{T("مدين", "Debit")}</th>
                              <th className="px-3 py-2.5 text-end font-medium">{T("دائن", "Credit")}</th>
                              <th className="px-3 py-2.5 text-start font-medium">{T("الفرع", "Branch")}</th>
                              <th className="px-3 py-2.5 text-start font-medium">{T("العلامة", "Brand")}</th>
                              <th className="px-3 py-2.5 text-start font-medium">{T("مركز التكلفة", "Cost Center")}</th>
                              <th className="px-3 py-2.5 text-start font-medium">{T("الموظف", "Employee")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.lines.map((line, i) => (
                              <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                                <td className="px-3 py-2 text-gray-500 font-mono">{i + 1}</td>
                                <td className="px-3 py-2">
                                  <span className="font-mono text-amber-400/80 me-1">{line.account_code}</span>
                                  <span className="text-white">{line.account_name}</span>
                                </td>
                                <td className="px-3 py-2 text-end text-blue-400 font-mono">
                                  {parseFloat(line.debit) > 0 ? fmt(line.debit) : "—"}
                                </td>
                                <td className="px-3 py-2 text-end text-purple-400 font-mono">
                                  {parseFloat(line.credit) > 0 ? fmt(line.credit) : "—"}
                                </td>
                                <td className="px-3 py-2 text-gray-400">{line.branch_name ?? "—"}</td>
                                <td className="px-3 py-2 text-gray-400">{line.brand_name ?? "—"}</td>
                                <td className="px-3 py-2 text-gray-400">{line.cost_center_name ?? "—"}</td>
                                <td className="px-3 py-2 text-gray-400">{line.employee_name ?? "—"}</td>
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
        )}
      </div>
    </div>
  );
}
