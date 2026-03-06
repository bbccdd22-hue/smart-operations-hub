/**
 * التنبؤ الذكي للشراء – Smart Purchase Forecast
 * فلترة متقدمة + ترتيب + طباعة + PDF
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ShoppingCart, AlertTriangle, CheckCircle2, Clock,
  Search, Printer, RefreshCw, Building2,
  ChevronUp, ChevronDown, ChevronsUpDown, XCircle,
  Package2, TrendingDown, FileDown, SlidersHorizontal,
  CircleDot, ClipboardEdit, Trash2,
} from "lucide-react";
import { fetchPurchaseSuggestions, fetchBranches } from "../lib/api";
import type { Branch, PurchaseSuggestion } from "../lib/api";

/* ─── helpers ─────────────────────────────────────────────── */
const n = (v: string | number | undefined) =>
  v != null && v !== "" ? parseFloat(String(v)) : 0;

type Urgency = "urgent" | "low" | "ok";
function getUrgency(s: PurchaseSuggestion): Urgency {
  const sugg = n(s.suggested_purchase_qty);
  if (sugg <= 0) return "ok";
  const onHand = n(s.on_hand);
  const required = n(s.required_qty);
  if (required > 0 && onHand / required < 0.25) return "urgent";
  return "low";
}

type SortField = "name" | "required" | "on_hand" | "suggested" | "urgency";
type SortDir = "asc" | "desc";

/* ─── component ─────────────────────────────────────────────── */
export default function SmartPurchasePage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  /* state */
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [branchId, setBranchId]     = useState<number | "">("");
  const [horizonDays, setHorizonDays] = useState(7);
  const [lookbackDays, setLookbackDays] = useState(90);
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [hasLoaded, setHasLoaded]   = useState(false);

  /* filters */
  const [searchQ, setSearchQ]         = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | Urgency>("all");
  const [showOnlyNeed, setShowOnlyNeed] = useState(false);

  /* sort */
  const [sortField, setSortField] = useState<SortField>("urgency");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");

  /* real-stock manual overrides: ingredient_id → raw string input */
  const [realStockMap, setRealStockMap] = useState<Record<number, string>>({});

  /* refs */
  const tableRef    = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  /* branches */
  useEffect(() => {
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
  }, []);

  /* load */
  const load = useCallback(async () => {
    if (branchId === "") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPurchaseSuggestions({
        branch_id: branchId as number,
        horizon_days: horizonDays,
        lookback_days: lookbackDays,
      });
      setSuggestions(res.suggestions);
      setHasLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : T("فشل التحميل", "Failed"));
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, horizonDays, lookbackDays]);

  /* ── real-stock helpers ──────────────────────────────────── */
  /** Returns entered real stock qty, or system on_hand if not entered */
  const getEffectiveOnHand = useCallback((s: PurchaseSuggestion): number => {
    const raw = realStockMap[s.ingredient_id];
    if (raw !== undefined && raw !== "") return Math.max(0, parseFloat(raw) || 0);
    return n(s.on_hand);
  }, [realStockMap]);

  /** Recalculates suggested purchase using real stock if provided */
  const getEffectiveSuggested = useCallback((s: PurchaseSuggestion): number => {
    const raw = realStockMap[s.ingredient_id];
    if (raw !== undefined && raw !== "") {
      const realQty = Math.max(0, parseFloat(raw) || 0);
      return Math.max(0, n(s.required_qty) - realQty);
    }
    return n(s.suggested_purchase_qty);
  }, [realStockMap]);

  /** Re-evaluates urgency using effective on_hand */
  const getEffectiveUrgency = useCallback((s: PurchaseSuggestion): Urgency => {
    const raw = realStockMap[s.ingredient_id];
    if (raw !== undefined && raw !== "") {
      const effSugg = Math.max(0, n(s.required_qty) - Math.max(0, parseFloat(raw) || 0));
      if (effSugg <= 0) return "ok";
      const realQty = Math.max(0, parseFloat(raw) || 0);
      const required = n(s.required_qty);
      if (required > 0 && realQty / required < 0.25) return "urgent";
      return "low";
    }
    return getUrgency(s);
  }, [realStockMap]);

  /** Format a numeric qty for display */
  const fmtQty = (v: number) =>
    v % 1 === 0 ? String(v) : parseFloat(v.toFixed(4)).toString();

  /* set / clear a single real-stock entry */
  const setReal = (id: number, val: string) =>
    setRealStockMap(prev => ({ ...prev, [id]: val }));
  const clearReal = (id: number) =>
    setRealStockMap(prev => { const next = { ...prev }; delete next[id]; return next; });
  const clearAllReal = () => setRealStockMap({});
  const realCount = Object.values(realStockMap).filter(v => v !== "").length;

  /* derived: filtered + sorted */
  const processed = useMemo(() => {
    let rows = suggestions.map(s => ({
      ...s,
      _urgency:    getEffectiveUrgency(s),
      _effOnHand:  getEffectiveOnHand(s),
      _effSugg:    getEffectiveSuggested(s),
      _hasReal:    realStockMap[s.ingredient_id] !== undefined && realStockMap[s.ingredient_id] !== "",
    }));

    /* search */
    const q = searchQ.trim().toLowerCase();
    if (q) {
      rows = rows.filter(s =>
        s.ingredient_name.toLowerCase().includes(q) ||
        (s.ingredient_name_ar ?? "").includes(searchQ) ||
        (s.serial_code ?? "").toLowerCase().includes(q)
      );
    }

    /* urgency filter */
    if (urgencyFilter !== "all") rows = rows.filter(s => s._urgency === urgencyFilter);

    /* show only needs purchase */
    if (showOnlyNeed) rows = rows.filter(s => s._effSugg > 0);

    /* sort */
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name")     cmp = (isRTL ? a.ingredient_name_ar ?? a.ingredient_name : a.ingredient_name).localeCompare(isRTL ? b.ingredient_name_ar ?? b.ingredient_name : b.ingredient_name);
      else if (sortField === "required")  cmp = n(a.required_qty) - n(b.required_qty);
      else if (sortField === "on_hand")   cmp = a._effOnHand - b._effOnHand;
      else if (sortField === "suggested") cmp = a._effSugg - b._effSugg;
      else if (sortField === "urgency") {
        const order: Record<Urgency, number> = { urgent: 2, low: 1, ok: 0 };
        cmp = order[a._urgency] - order[b._urgency];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [suggestions, searchQ, urgencyFilter, showOnlyNeed, sortField, sortDir, isRTL,
      getEffectiveUrgency, getEffectiveOnHand, getEffectiveSuggested, realStockMap]);

  /* stats — uses effective urgency/suggestion */
  const stats = useMemo(() => {
    const all = suggestions.map(s => ({
      _urgency: getEffectiveUrgency(s),
      _effSugg: getEffectiveSuggested(s),
    }));
    return {
      total:  suggestions.length,
      urgent: all.filter(s => s._urgency === "urgent").length,
      needs:  all.filter(s => s._effSugg > 0).length,
      ok:     all.filter(s => s._urgency === "ok").length,
    };
  }, [suggestions, getEffectiveUrgency, getEffectiveSuggested]);

  /* sort toggle */
  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("desc"); }
  };

  const SortIcon = ({ f }: { f: SortField }) => {
    if (sortField !== f) return <ChevronsUpDown className="inline h-3.5 w-3.5 opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp className="inline h-3.5 w-3.5 text-emerald-500" />
      : <ChevronDown className="inline h-3.5 w-3.5 text-emerald-500" />;
  };

  /* branch name */
  const branchName = branches.find(b => b.id === branchId)?.name ?? "";

  /* ── PDF / Print ── */
  const handlePrint = () => window.print();

  const handlePDF = async () => {
    if (!tableRef.current || pdfLoading) return;
    setPdfLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { default: jsPDF } = await import("jspdf");

      const el = tableRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgW = 210; // A4 width mm
      const imgH = (canvas.height * imgW) / canvas.width;
      const pdf = new jsPDF({ orientation: imgH > imgW ? "portrait" : "landscape", unit: "mm", format: "a4" });

      const pageH = pdf.internal.pageSize.getHeight();
      let yPos = 0;
      const pageImgH = (pageH / imgH) * imgH;

      let remainingH = imgH;
      while (remainingH > 0) {
        const sliceH = Math.min(pageH, remainingH);
        const srcY = yPos * (canvas.height / imgH);
        const srcH = sliceH * (canvas.height / imgH);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        const pageImg = pageCanvas.toDataURL("image/png");
        if (yPos > 0) pdf.addPage();
        pdf.addImage(pageImg, "PNG", 0, 0, imgW, sliceH);

        yPos += pageH;
        remainingH -= pageH;
      }

      const date = new Date().toISOString().split("T")[0];
      pdf.save(`smart-purchase-${branchName}-${date}.pdf`);
    } catch {
      alert(T("فشل إنشاء PDF", "Failed to generate PDF"));
    } finally {
      setPdfLoading(false);
    }
  };

  /* urgency UI */
  const urgencyBadge = (u: Urgency) => {
    if (u === "urgent") return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertTriangle className="h-3 w-3" />
        {T("عاجل","Urgent")}
      </span>
    );
    if (u === "low") return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <TrendingDown className="h-3 w-3" />
        {T("منخفض","Low")}
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {T("كافٍ","OK")}
      </span>
    );
  };

  /* ─── render ──────────────────────────────────────────────── */
  return (
    <div dir={isRTL ? "rtl" : "ltr"} className={`w-full space-y-5 ${isRTL ? "font-arabic" : ""}`}>

      {/* ═══════════════ PRINT STYLES (injected) ═══════════════ */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #smart-purchase-printable,
          #smart-purchase-printable * { visibility: visible !important; }
          #smart-purchase-printable { position: fixed !important; inset: 0 !important; background: white !important; z-index: 9999 !important; padding: 12mm !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="no-print flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-800 dark:text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40">
              <ShoppingCart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </span>
            {T("التنبؤ الذكي للشراء", "Smart Purchase Forecast")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {T(
              "اقتراح كميات الشراء بناءً على استهلاك الكاشير وبيانات المخزون",
              "Purchase quantity suggestions based on POS consumption and stock data"
            )}
          </p>
        </div>
        {/* Action buttons */}
        {hasLoaded && suggestions.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Printer className="h-4 w-4" />
              {T("طباعة", "Print")}
            </button>
            <button
              type="button"
              onClick={handlePDF}
              disabled={pdfLoading}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {pdfLoading
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <FileDown className="h-4 w-4" />}
              {pdfLoading ? T("جاري التحميل…", "Generating…") : T("تنزيل PDF", "Download PDF")}
            </button>
          </div>
        )}
      </div>

      {/* ── Control Panel ── */}
      <div className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <SlidersHorizontal className="h-4 w-4 text-emerald-500" />
          {T("معايير التنبؤ", "Forecast Settings")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Branch */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Building2 className="h-3.5 w-3.5" />
              {T("الفرع", "Branch")}
          </label>
          <select
            value={branchId}
              onChange={e => setBranchId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">-- {T("اختر الفرع", "Select branch")} --</option>
              {(Array.isArray(branches) ? branches : []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

          {/* Horizon */}
        <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              {T("أفق التنبؤ", "Forecast Horizon")}
          </label>
          <select
            value={horizonDays}
              onChange={e => setHorizonDays(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              {[
                { v: 3,  ar: "3 أيام",   en: "3 days" },
                { v: 7,  ar: "7 أيام",   en: "7 days" },
                { v: 14, ar: "14 يوم",   en: "14 days" },
                { v: 30, ar: "30 يوم",   en: "30 days" },
              ].map(o => <option key={o.v} value={o.v}>{T(o.ar, o.en)}</option>)}
            </select>
          </div>

          {/* Lookback */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <RefreshCw className="h-3.5 w-3.5" />
              {T("فترة تحليل البيانات", "Data Lookback")}
            </label>
            <select
              value={lookbackDays}
              onChange={e => setLookbackDays(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              {[
                { v: 30,  ar: "آخر 30 يوم",  en: "Last 30 days" },
                { v: 60,  ar: "آخر 60 يوم",  en: "Last 60 days" },
                { v: 90,  ar: "آخر 90 يوم",  en: "Last 90 days" },
                { v: 180, ar: "آخر 6 أشهر",  en: "Last 6 months" },
              ].map(o => <option key={o.v} value={o.v}>{T(o.ar, o.en)}</option>)}
          </select>
        </div>

          {/* Fetch button */}
        <div className="flex items-end">
          <button
            type="button"
            onClick={load}
            disabled={!branchId || loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
              {loading
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <ShoppingCart className="h-4 w-4" />}
              {loading ? T("جاري التحليل…", "Analyzing…") : T("تحليل واقتراح", "Analyze & Suggest")}
          </button>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="no-print flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ms-auto"><XCircle className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Stats cards ── */}
      {hasLoaded && suggestions.length > 0 && (
        <div className="no-print grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: Package2,       color: "blue",    label: T("إجمالي الأصناف","Total Items"),     value: stats.total },
            { icon: AlertTriangle,  color: "red",     label: T("يحتاج شراء عاجل","Urgent"),         value: stats.urgent },
            { icon: TrendingDown,   color: "amber",   label: T("المخزون منخفض","Needs Purchase"),   value: stats.needs - stats.urgent },
            { icon: CheckCircle2,   color: "emerald", label: T("المخزون كافٍ","Stock OK"),          value: stats.ok },
          ].map(({ icon: Icon, color, label, value }) => (
            <div key={label} className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900
              ${color === "red"     ? "border-red-200 dark:border-red-800/50"    : ""}
              ${color === "amber"   ? "border-amber-200 dark:border-amber-800/50": ""}
              ${color === "emerald" ? "border-emerald-200 dark:border-emerald-800/50": ""}
              ${color === "blue"    ? "border-blue-200 dark:border-blue-800/50"  : ""}
            `}>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl
                ${color === "red"     ? "bg-red-100 dark:bg-red-900/30"     : ""}
                ${color === "amber"   ? "bg-amber-100 dark:bg-amber-900/30" : ""}
                ${color === "emerald" ? "bg-emerald-100 dark:bg-emerald-900/30": ""}
                ${color === "blue"    ? "bg-blue-100 dark:bg-blue-900/30"   : ""}
              `}>
                <Icon className={`h-5 w-5
                  ${color === "red"     ? "text-red-600 dark:text-red-400"     : ""}
                  ${color === "amber"   ? "text-amber-600 dark:text-amber-400" : ""}
                  ${color === "emerald" ? "text-emerald-600 dark:text-emerald-400": ""}
                  ${color === "blue"    ? "text-blue-600 dark:text-blue-400"   : ""}
                `} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Results section ── */}
      {hasLoaded && suggestions.length > 0 && (
        <>
          {/* Table filters bar */}
          <div className="no-print flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1">
              <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isRTL ? "right-3" : "left-3"}`} />
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder={T("بحث بالاسم أو الكود…", "Search by name or code…")}
                className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white ${isRTL ? "pl-3 pr-10" : "pr-3 pl-10"}`}
              />
              {searchQ && (
                <button onClick={() => setSearchQ("")} className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "left-2" : "right-2"}`}>
                  <XCircle className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            {/* Urgency filter */}
            <div className="flex items-center gap-1">
              {(["all", "urgent", "low", "ok"] as const).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgencyFilter(u)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    urgencyFilter === u
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  {u === "all"    && T("الكل","All")}
                  {u === "urgent" && T("عاجل","Urgent")}
                  {u === "low"    && T("منخفض","Low")}
                  {u === "ok"     && T("كافٍ","OK")}
                </button>
              ))}
            </div>

            {/* Show only needs */}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <div
                onClick={() => setShowOnlyNeed(v => !v)}
                className={`relative h-5 w-9 rounded-full transition-colors ${showOnlyNeed ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${showOnlyNeed ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              {T("يحتاج شراءً فقط","Needs purchase only")}
            </label>

            {/* Count + clear real */}
            <span className="ms-auto flex items-center gap-3 text-xs text-slate-400">
              {realCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllReal}
                  className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-600 transition hover:bg-blue-100 dark:border-blue-700/50 dark:bg-blue-900/20 dark:text-blue-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {T("مسح الأوضاع الحقيقية", "Clear actual entries")} ({realCount})
                </button>
              )}
              {processed.length} / {suggestions.length} {T("صنف","items")}
            </span>
          </div>

          {/* ══════════════ PRINTABLE TABLE ══════════════ */}
          <div id="smart-purchase-printable" ref={tableRef}>

            {/* Print header (only shows when printing) */}
            <div className="mb-4 hidden border-b border-slate-300 pb-4 print:block">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {T("قائمة الشراء الذكية", "Smart Purchase List")}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {T("الفرع: ", "Branch: ")} {branchName} &nbsp;|&nbsp;
                    {T("أفق التنبؤ: ", "Horizon: ")} {horizonDays} {T("يوم", "days")} &nbsp;|&nbsp;
                    {T("التاريخ: ", "Date: ")} {new Date().toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <div className="text-left text-sm text-slate-400">
                  {processed.length} {T("صنف", "items")}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 print:rounded-none print:border-0 print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">

            <thead>
                    <tr className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/50">
                      <th className="w-10 px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">#</th>

                      <th className="cursor-pointer select-none px-4 py-3 text-start text-xs font-semibold text-slate-600 hover:text-emerald-600 dark:text-slate-300" onClick={() => toggleSort("name")}>
                        {T("الصنف / الكود", "Item / Code")} <SortIcon f="name" />
                      </th>

                      <th className="cursor-pointer select-none px-4 py-3 text-center text-xs font-semibold text-slate-600 hover:text-emerald-600 dark:text-slate-300" onClick={() => toggleSort("urgency")}>
                        {T("الحالة", "Status")} <SortIcon f="urgency" />
                      </th>

                      <th className="cursor-pointer select-none px-4 py-3 text-center text-xs font-semibold text-slate-600 hover:text-emerald-600 dark:text-slate-300" onClick={() => toggleSort("required")}>
                        {T("الاحتياج", "Required")} <SortIcon f="required" />
                      </th>

                      <th className="cursor-pointer select-none px-4 py-3 text-center text-xs font-semibold text-slate-600 hover:text-emerald-600 dark:text-slate-300" onClick={() => toggleSort("on_hand")}>
                        {T("الرصيد الحالي", "On Hand")} <SortIcon f="on_hand" />
                      </th>

                      {/* ── NEW: Actual / Real Stock ── */}
                      <th className="px-4 py-3 text-center text-xs font-semibold dark:text-blue-400"
                          style={{ color: "#2563eb" }}>
                        <div className="flex items-center justify-center gap-1.5">
                          <ClipboardEdit className="h-3.5 w-3.5" />
                          {T("الوضع الحقيقي", "Actual Stock")}
                        </div>
                        <div className="mt-0.5 text-[10px] font-normal text-slate-400 dark:text-slate-500">
                          {T("يُسجّله الموظف", "entered by staff")}
                        </div>
                      </th>

                      <th className="cursor-pointer select-none px-4 py-3 text-center text-xs font-semibold text-emerald-700 hover:text-emerald-600 dark:text-emerald-400" onClick={() => toggleSort("suggested")}>
                        {T("اقتراح الشراء", "Suggested Purchase")} <SortIcon f="suggested" />
                      </th>

                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {T("الوحدة", "Unit")}
                      </th>
              </tr>
            </thead>

            <tbody>
                    {processed.map((s, idx) => {
                      const urgency = s._urgency;
                      const effSugg = s._effSugg;
                      const needsPurchase = effSugg > 0;
                      const hasReal = s._hasReal;
                      const rowBg =
                        urgency === "urgent"
                          ? "bg-red-50/40 dark:bg-red-900/10"
                          : urgency === "low" && needsPurchase
                          ? "bg-amber-50/30 dark:bg-amber-900/10"
                          : "";

                      return (
                        <tr
                          key={s.ingredient_id}
                          className={`border-b border-slate-100 transition-colors hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/50 ${rowBg}`}
                        >
                          {/* Row number */}
                          <td className="px-4 py-3 text-center text-xs font-mono text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Item name */}
                  <td className="px-4 py-3">
                            <p className="font-medium text-slate-800 dark:text-white">
                    {isRTL && s.ingredient_name_ar ? s.ingredient_name_ar : s.ingredient_name}
                            </p>
                            {isRTL && s.ingredient_name && (
                              <p className="text-xs text-slate-400">{s.ingredient_name}</p>
                            )}
                    {s.serial_code && (
                              <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                        {s.serial_code}
                      </span>
                    )}
                          </td>

                          {/* Status badge */}
                          <td className="px-4 py-3 text-center">
                            {urgencyBadge(urgency)}
                          </td>

                          {/* Required */}
                          <td className="px-4 py-3 text-center">
                            <div className="font-mono font-medium text-slate-700 dark:text-slate-200">
                              {s.required_qty} <span className="text-xs font-normal text-slate-400">{s.unit_code}</span>
                    </div>
                    {s.display_unit_source === "package" && s.required_base_qty && s.base_unit_code && (
                              <div className="text-xs text-slate-400">
                                {s.required_base_qty} <span className="text-slate-300">{s.base_unit_code}</span>
                      </div>
                    )}
                  </td>

                          {/* On hand (system) */}
                          <td className="px-4 py-3 text-center">
                            <div className={`font-mono font-medium ${
                              !hasReal
                                ? urgency === "urgent" ? "text-red-600 dark:text-red-400"
                                  : urgency === "low"  ? "text-amber-600 dark:text-amber-400"
                                  : "text-slate-700 dark:text-slate-200"
                                : "text-slate-400 line-through dark:text-slate-500"
                            }`}>
                              {s.on_hand} <span className="text-xs font-normal text-slate-400">{s.unit_code}</span>
                            </div>
                    {s.display_unit_source === "package" && s.on_hand_base_qty && s.base_unit_code && (
                              <div className="text-xs text-slate-400">
                                {s.on_hand_base_qty} <span className="text-slate-300">{s.base_unit_code}</span>
                              </div>
                            )}
                          </td>

                          {/* ── Actual / Real Stock input ── */}
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={realStockMap[s.ingredient_id] ?? ""}
                                onChange={e => setReal(s.ingredient_id, e.target.value)}
                                placeholder="—"
                                className="w-24 rounded-lg border border-blue-200 bg-blue-50/60 px-2 py-1.5 text-center text-sm font-mono text-slate-800 placeholder:text-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300/20 dark:border-blue-700/50 dark:bg-blue-900/10 dark:text-white dark:placeholder:text-slate-600"
                              />
                              {hasReal && (
                                <button
                                  type="button"
                                  onClick={() => clearReal(s.ingredient_id)}
                                  title={T("مسح", "Clear")}
                                  className="text-slate-300 transition hover:text-red-400 dark:text-slate-600 dark:hover:text-red-400"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            {hasReal && (
                              <div className="mt-1 text-[10px] font-medium text-blue-500 dark:text-blue-400">
                                {T("وضع حقيقي ✓", "actual ✓")}
                      </div>
                    )}
                  </td>

                          {/* Suggested (effective) */}
                          <td className="px-4 py-3 text-center">
                            {needsPurchase ? (
                              <div>
                                <span className={`rounded-lg px-2.5 py-1 font-mono text-sm font-bold ${
                                  urgency === "urgent"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                }`}>
                                  {hasReal ? fmtQty(effSugg) : s.suggested_purchase_qty}
                                </span>
                                {hasReal && (
                                  <div className="mt-0.5 text-[10px] text-blue-500 dark:text-blue-400">
                                    {T("محتسب على الحقيقي", "based on actual")}
                                  </div>
                                )}
                                {!hasReal && s.display_unit_source === "package" && s.suggested_purchase_base_qty && s.base_unit_code && (
                                  <div className="mt-0.5 text-xs text-slate-400">
                        {s.suggested_purchase_base_qty} {s.base_unit_code}
                      </div>
                    )}
                              </div>
                            ) : (
                              <span className={`text-xs ${hasReal ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                                {hasReal ? T("✓ لا حاجة", "✓ No need") : "—"}
                              </span>
                            )}
                          </td>

                          {/* Unit */}
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              <CircleDot className="h-3 w-3 text-slate-400" />
                              {s.unit_code}
                            </div>
                  </td>
                </tr>
                      );
                    })}
            </tbody>

                  {/* Footer row */}
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                      <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {T("الإجمالي", "Total")} — {processed.length} {T("صنف", "items")}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">—</td>
                      <td className="px-4 py-3 text-center text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">—</td>
                      {/* real-stock count */}
                      <td className="px-4 py-3 text-center text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {realCount > 0
                          ? `${realCount} ${T("تم تسجيلها", "recorded")}`
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {processed.filter(s => s._effSugg > 0).length} {T("صنف يحتاج شراء", "items to buy")}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
          </table>
              </div>
            </div>

            {/* Print footer */}
            <div className="mt-4 hidden justify-between text-xs text-slate-400 print:flex">
              <span>{T("نظام Smart Operations Hub", "Smart Operations Hub")}</span>
              <span>{new Date().toLocaleString(isRTL ? "ar-SA" : "en-US")}</span>
            </div>
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {!loading && hasLoaded && suggestions.length === 0 && !error && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <Package2 className="mx-auto mb-3 h-14 w-14 text-slate-300 dark:text-slate-600" />
          <p className="text-base font-semibold text-slate-500 dark:text-slate-400">
            {T("لا توجد اقتراحات", "No suggestions available")}
          </p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            {T(
              "تأكد من رفع مبيعات المنتجات (Product Sales) للفرع المختار",
              "Make sure product sales are uploaded for the selected branch"
            )}
          </p>
        </div>
      )}

      {/* ── Initial state ── */}
      {!hasLoaded && !loading && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <ShoppingCart className="mx-auto mb-3 h-14 w-14 text-slate-300 dark:text-slate-600" />
          <p className="text-base font-semibold text-slate-500 dark:text-slate-400">
            {T("اختر الفرع وابدأ التحليل", "Select a branch to start analysis")}
          </p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            {T(
              "سيتم تحليل بيانات المبيعات وبيانات المخزون واقتراح كميات الشراء المثلى",
              "Sales and stock data will be analyzed to suggest optimal purchase quantities"
            )}
          </p>
        </div>
      )}
    </div>
  );
}
