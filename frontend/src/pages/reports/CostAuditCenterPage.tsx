/**
 * سجل تدقيق التكاليف التشغيلية – مركز التدقيق
 * شريط بحث ذكي + تصميم القالب (ترتيب وعرض الأعمدة)
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { fetchCostAuditEntries, excludeCostAuditEntry, type CostAuditEntry } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import TemplateLayoutToolbar from "../../components/TemplateLayoutToolbar";
import {
  loadLayout,
  getDisplayColumnOrder,
  getColumnWidth,
  getColumnLabel,
  type TemplateLayout,
} from "../../config/templateTableConfig";

const TEMPLATE_KEY = "cost_audit";

const SEARCH_HISTORY_KEY = "cost-audit-search-history";
const SEARCH_HISTORY_MAX = 5;

function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, SEARCH_HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(items: string[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items.slice(0, SEARCH_HISTORY_MAX)));
  } catch {
    /* ignore */
  }
}

/** هل المصطلح يشير لمبلغ ضخم – للتفعيل التلقائي للفلتر */
function suggestsBigAmount(term: string): boolean {
  const t = term.trim().toLowerCase();
  return (
    /\d{4,}/.test(t) ||
    /مليون|مليار|million|billion/.test(t) ||
    (/\d+/.test(t) && parseFloat(t.replace(/[^\d.]/g, "")) >= 10000)
  );
}

const COGS_PREFIX = "05101";
const OPEX_PREFIXES = ["05102", "05103", "05104", "05105"];
const BIG_AMOUNT_THRESHOLD = 10000;

function getCostCategory(code: string): "cogs" | "opex" | "other" {
  if (code.startsWith(COGS_PREFIX)) return "cogs";
  if (OPEX_PREFIXES.some((p) => code.startsWith(p))) return "opex";
  return "other";
}

/** تصنيف المصروف حسب الكلمات المفتاحية (إيجار، رواتب، مواد خام) */
function getExpenseType(entry: CostAuditEntry): "rent" | "salaries" | "raw_materials" | "other" {
  const text = `${entry.account_name || ""} ${entry.description || ""}`.toLowerCase();
  if (/إيجار|rent|ايجار/.test(text)) return "rent";
  if (/رواتب|راتب|أجور|salaries|wages/.test(text)) return "salaries";
  if (/خام|مواد خام|raw material|مشتريات خامات/.test(text)) return "raw_materials";
  return "other";
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function CostAuditCenterPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";
  const isSAIF = user?.username === "SAIF";

  const [entries, setEntries] = useState<CostAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOutliers, setShowOutliers] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "cogs" | "opex" | "other">("all");
  const [showExcluded, setShowExcluded] = useState(true);
  const [excludingId, setExcludingId] = useState<number | null>(null);
  const [bigAmountsOnly, setBigAmountsOnly] = useState(false);
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<"all" | "rent" | "salaries" | "raw_materials">("all");
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchHistory());
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [tableLayout, setTableLayout] = useState<TemplateLayout | null>(() => loadLayout(TEMPLATE_KEY));
  const displayColumnOrder = useMemo(
    () => getDisplayColumnOrder(TEMPLATE_KEY, tableLayout, []),
    [tableLayout]
  );

  const debouncedSearch = useDebouncedValue(searchQuery, 150);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCostAuditEntries({ show_excluded: showExcluded })
      .then((r) => {
        if (!cancelled) {
          setEntries(r.entries);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showExcluded]);

  const filteredAndSorted = useMemo(() => {
    let list = [...entries];
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.account_code.toLowerCase().includes(q) ||
          (e.account_name || "").toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q) ||
          (e.source_file || "").toLowerCase().includes(q) ||
          String(e.amount).includes(q) ||
          String(parseFloat(e.amount || "0")).includes(q)
      );
    }
    if (categoryFilter !== "all") {
      list = list.filter((e) => getCostCategory(e.account_code) === categoryFilter);
    }
    if (bigAmountsOnly) {
      list = list.filter((e) => parseFloat(e.amount || "0") >= BIG_AMOUNT_THRESHOLD);
    }
    if (expenseTypeFilter !== "all") {
      list = list.filter((e) => getExpenseType(e) === expenseTypeFilter);
    }
    if (showOutliers) {
      list.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
    }
    return list;
  }, [entries, debouncedSearch, categoryFilter, showOutliers, bigAmountsOnly, expenseTypeFilter]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setShowHistoryDropdown(false);
  }, []);

  const addToHistory = useCallback((term: string) => {
    const t = term.trim();
    if (!t || !isSAIF) return;
    setSearchHistory((prev) => {
      const next = [t, ...prev.filter((x) => x !== t)].slice(0, SEARCH_HISTORY_MAX);
      saveSearchHistory(next);
      return next;
    });
  }, [isSAIF]);

  const removeFromHistory = useCallback((term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory((prev) => {
      const next = prev.filter((x) => x !== term);
      saveSearchHistory(next);
      return next;
    });
  }, []);

  const applyHistoryItem = useCallback((term: string) => {
    setSearchQuery(term);
    setShowHistoryDropdown(false);
    if (suggestsBigAmount(term)) {
      setBigAmountsOnly(true);
      setShowOutliers(true);
    }
  }, []);

  const handleSearchBlur = useCallback(() => {
    if (searchQuery.trim()) addToHistory(searchQuery.trim());
  }, [searchQuery, addToHistory]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && searchQuery.trim()) {
        addToHistory(searchQuery.trim());
      }
    },
    [searchQuery, addToHistory]
  );

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(ev.target as Node)) {
        setShowHistoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setBigAmountsOnly(false);
    setExpenseTypeFilter("all");
    setCategoryFilter("all");
    setShowOutliers(false);
  }, []);

  const handleExclude = async (id: number, isExcluded: boolean) => {
    if (!isSAIF) return;
    setExcludingId(id);
    try {
      await excludeCostAuditEntry(id, isExcluded);
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, is_excluded: isExcluded } : e))
      );
    } catch (err) {
      // toast or inline error
    } finally {
      setExcludingId(null);
    }
  };

  const totalIncluded = useMemo(
    () =>
      filteredAndSorted
        .filter((e) => !e.is_excluded)
        .reduce((s, e) => s + parseFloat(e.amount || "0"), 0),
    [filteredAndSorted]
  );

  const visibleColumns = useMemo(
    () => (isSAIF ? displayColumnOrder : displayColumnOrder.filter((c) => c !== "actions")),
    [displayColumnOrder, isSAIF]
  );

  const renderCell = useCallback(
    (colId: string, row: CostAuditEntry, rowIndex: number) => {
      switch (colId) {
        case "index":
          return rowIndex + 1;
        case "date":
          return row.recorded_at
            ? new Date(row.recorded_at).toLocaleString(isRTL ? "ar-SA" : "en")
            : "—";
        case "account_code":
          return <span className="font-mono text-slate-800 dark:text-white">{row.account_code}</span>;
        case "account_name":
          return <span className="text-xs text-slate-500">{row.account_name || "—"}</span>;
        case "description":
          return <span className="max-w-[200px] truncate text-slate-600 dark:text-slate-400">{row.description || "—"}</span>;
        case "amount":
          return <span className="font-mono font-medium">{parseFloat(row.amount || "0").toLocaleString("ar-SA")} ر.س</span>;
        case "source":
          return <span className="max-w-[160px] truncate text-xs text-slate-500">{row.source_file || "—"}</span>;
        case "category": {
          const cat = getCostCategory(row.account_code);
          return (
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                cat === "cogs"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                  : cat === "opex"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {cat === "cogs" ? "COGS" : cat === "opex" ? "OpEx" : isRTL ? "أخرى" : "Other"}
            </span>
          );
        }
        case "actions":
          return (
            <button
              type="button"
              disabled={excludingId === row.id}
              onClick={() => handleExclude(row.id, !row.is_excluded)}
              className={`rounded px-2 py-1 text-xs font-medium transition ${
                row.is_excluded
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200"
                  : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200"
              }`}
            >
              {excludingId === row.id
                ? "..."
                : row.is_excluded
                  ? isRTL ? "إعادة" : "Restore"
                  : isRTL ? "استبعاد من الحساب" : "Exclude"}
            </button>
          );
        default:
          return "—";
      }
    },
    [isRTL, excludingId, handleExclude]
  );

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          to="/finance"
          className="text-sm font-medium text-emerald-500 hover:text-emerald-600 dark:text-emerald-400"
        >
          ← {isRTL ? "العودة للمركز المالي" : "Back to Finance Hub"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
          {isRTL ? "سجل تدقيق التكاليف التشغيلية" : "Cost Audit Center"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isRTL
            ? "شفافية كاملة – تتبع كل تكلفة إلى مصدرها في ملف الإكسل"
            : "Full transparency – trace every cost to its Excel source"}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* شريط البحث الذكي – أعلى الجدول */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div ref={searchContainerRef} className="relative flex-1 min-w-0">
            <span className="pointer-events-none absolute inset-y-0 flex items-center text-slate-400" style={{ [isRTL ? "right" : "left"]: "0.75rem" }}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              ref={searchInputRef}
              type="search"
              role="searchbox"
              aria-label={isRTL ? "بحث شامل في التكاليف" : "Search costs"}
              aria-expanded={showHistoryDropdown}
              aria-haspopup="listbox"
              placeholder={isRTL ? "اسم المورد، المادة، الوصف، القيمة... (مثال: 136 أو حليب)" : "Supplier, material, description, amount... (e.g. 136 or milk)"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => !searchQuery && setShowHistoryDropdown(true)}
              onBlur={handleSearchBlur}
              onKeyDown={handleSearchKeyDown}
              className={`block w-full rounded-xl border border-slate-300 bg-slate-50 py-3 text-sm placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:placeholder-slate-500 ${
                isRTL ? "pr-10 pl-12" : "pl-10 pr-12"
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label={isRTL ? "مسح البحث" : "Clear search"}
                className={`absolute inset-y-0 flex items-center rounded-r-xl bg-slate-200/80 px-3 text-slate-500 hover:bg-slate-300 hover:text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 ${
                  isRTL ? "left-0" : "right-0"
                }`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* سجل البحث – قائمة منسدلة */}
            {showHistoryDropdown && isSAIF && searchHistory.length > 0 && (
              <div
                ref={dropdownRef}
                role="listbox"
                className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isRTL ? "بحث سابق" : "Recent searches"}
                </div>
                {searchHistory.map((term) => (
                  <div
                    key={term}
                    role="option"
                    tabIndex={0}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyHistoryItem(term);
                    }}
                    className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <span className="min-w-0 truncate">{term}</span>
                    <button
                      type="button"
                      onClick={(e) => removeFromHistory(term, e)}
                      onMouseDown={(e) => e.stopPropagation()}
                      aria-label={isRTL ? "حذف من السجل" : "Remove from history"}
                      className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearAllFilters}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              {isRTL ? "عرض الكل" : "Show all"}
            </button>
          </div>
        </div>

        {/* فلاتر البحث السريعة */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isRTL ? "فلاتر سريعة:" : "Quick filters:"}
          </span>
          <button
            type="button"
            onClick={() => setBigAmountsOnly((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              bigAmountsOnly
                ? "bg-amber-500 text-white dark:bg-amber-600"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            {isRTL ? "المبالغ الضخمة (>10,000 ر.س)" : "Big amounts (>10,000 SAR)"}
          </button>
          <select
            value={expenseTypeFilter}
            onChange={(e) => setExpenseTypeFilter(e.target.value as typeof expenseTypeFilter)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">{isRTL ? "التصنيف: الكل" : "Type: All"}</option>
            <option value="rent">{isRTL ? "إيجار" : "Rent"}</option>
            <option value="salaries">{isRTL ? "رواتب" : "Salaries"}</option>
            <option value="raw_materials">{isRTL ? "مواد خام" : "Raw materials"}</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">{isRTL ? "كل التكاليف" : "All costs"}</option>
            <option value="cogs">{isRTL ? "COGS" : "COGS"}</option>
            <option value="opex">{isRTL ? "مصاريف تشغيلية" : "OpEx"}</option>
            <option value="other">{isRTL ? "أخرى" : "Other"}</option>
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 dark:border-slate-600">
            <input
              type="checkbox"
              checked={showOutliers}
              onChange={(e) => setShowOutliers(e.target.checked)}
            />
            <span className="text-xs">
              {isRTL ? "إظهار المبالغ غير المنطقية" : "Show illogical amounts"}
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={showExcluded}
              onChange={(e) => setShowExcluded(e.target.checked)}
            />
            <span className="text-xs">{isRTL ? "المستبعدة" : "Excluded"}</span>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/80">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {isRTL ? "المجموع المعتمد (غير المستبعد)" : "Approved total (non-excluded)"}:{" "}
            <strong>{totalIncluded.toLocaleString("ar-SA")} ر.س</strong>
          </span>
          <TemplateLayoutToolbar
            templateKey={TEMPLATE_KEY}
            onLayoutChange={(l) => setTableLayout(l)}
            isRTL={isRTL}
            T={(ar, en) => (isRTL ? ar : en)}
          />
          {(debouncedSearch || bigAmountsOnly || expenseTypeFilter !== "all" || categoryFilter !== "all") && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isRTL ? `${filteredAndSorted.length} نتيجة` : `${filteredAndSorted.length} results`}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-700/50">
                {visibleColumns.map((colId) => (
                  <th
                    key={colId}
                    className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200"
                    style={{
                      width: getColumnWidth(TEMPLATE_KEY, tableLayout, colId, false),
                      minWidth: getColumnWidth(TEMPLATE_KEY, tableLayout, colId, true),
                    }}
                  >
                    {getColumnLabel(TEMPLATE_KEY, colId, undefined, isRTL)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-slate-500">
                    {isRTL ? "جاري التحميل..." : "Loading..."}
                  </td>
                </tr>
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-slate-500">
                    {isRTL
                      ? "لا توجد إدخالات. قم برفع ملف قائمة الدخل أولاً."
                      : "No entries. Upload an income statement file first."}
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((e, idx) => (
                  <tr
                    key={e.id}
                    className={`border-b border-slate-100 dark:border-slate-700 ${
                      e.is_excluded ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
                    }`}
                    style={{
                      height: tableLayout?.rowHeight
                        ? `${tableLayout.rowHeight}px`
                        : undefined,
                    }}
                  >
                    {visibleColumns.map((colId) => (
                      <td
                        key={colId}
                        className="px-4 py-2"
                        style={{
                          width: getColumnWidth(TEMPLATE_KEY, tableLayout, colId, false),
                          minWidth: getColumnWidth(TEMPLATE_KEY, tableLayout, colId, true),
                        }}
                      >
                        {renderCell(colId, e, idx)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
