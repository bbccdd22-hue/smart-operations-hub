/**
 * دليل الشجرة المحاسبية الرسمي – نظام سيف المالي
 * Chart of Accounts – Official Saif Financial Tree (Levels 1–5)
 * محرك بحث: بحث فوري، فتح تلقائي للأبناء، تمييز النتيجة
 */
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import {
  fetchChartAccounts,
  createChartAccount,
  updateChartAccount,
  deleteChartAccount,
  type ChartAccount,
} from "../lib/api";

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-[#00ffcc]/25 text-[#00ffcc]",
  2: "bg-[#00ffcc]/15 text-[#00ffcc]/90",
  3: "bg-slate-500/20 text-slate-300",
  4: "bg-slate-500/10 text-slate-400",
  5: "bg-slate-500/5 text-slate-500",
};

/** Direct children = accounts whose immediate parent (longest existing prefix) is this account */
function getChildren(account: ChartAccount, all: ChartAccount[]): ChartAccount[] {
  const parentCode = account.code;
  return all.filter((c) => {
    if (c.code === parentCode || !c.code.startsWith(parentCode)) return false;
    const childCode = c.code;
    const middle = all.find(
      (m) => m.code !== parentCode && m.code !== childCode && childCode.startsWith(m.code) && m.code.startsWith(parentCode) && m.code.length > parentCode.length && m.code.length < childCode.length
    );
    return !middle;
  });
}

/** Tree node with expand/collapse */
function TreeBranch({
  account,
  all,
  expanded,
  onToggle,
  isRTL,
  editingId,
  editForm,
  onStartEdit,
  onEditFormChange,
  onUpdate,
  onCancelEdit,
  onDelete,
  matchedCodes,
  canEdit,
}: {
  account: ChartAccount;
  all: ChartAccount[];
  expanded: Set<string>;
  onToggle: (code: string) => void;
  isRTL: boolean;
  editingId: number | null;
  editForm: Partial<ChartAccount>;
  onStartEdit: (acc: ChartAccount) => void;
  onEditFormChange: (u: Partial<ChartAccount>) => void;
  onUpdate: (id: number) => void;
  onCancelEdit: () => void;
  onDelete: (acc: ChartAccount) => void;
  matchedCodes: Set<string>;
  canEdit?: boolean;
}) {
  const isHighlighted = matchedCodes.has(account.code);
  const children = getChildren(account, all);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(account.code);
  const isBalanceSheet = account.statement.includes("المركز") || account.statement.includes("Financial");

  return (
    <div className="tree-node">
      <div
        className={`account-row flex items-center gap-2 border-b py-2 transition ${isHighlighted ? "account-row-highlight" : "border-white/5"}`}
        style={{ [isRTL ? "paddingRight" : "paddingLeft"]: `${12 + (account.level - 1) * 24}px`, [isRTL ? "paddingLeft" : "paddingRight"]: "16px" }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(account.code)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:text-[#00ffcc]"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            isExpanded ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )
          ) : (
            <span className="text-slate-500">•</span>
          )}
        </button>
        <span className="font-mono text-sm text-slate-400">{account.code}</span>
        <span className="min-w-0 flex-1 font-medium text-slate-200" dir="rtl">
          {editingId === account.id ? (
            <span className="flex gap-2">
              <input
                value={editForm.name_ar ?? account.name_ar}
                onChange={(e) => onEditFormChange({ name_ar: e.target.value })}
                className="w-32 rounded border border-white/20 bg-white/5 px-2 py-1 text-xs"
              />
              <input
                value={editForm.name_en ?? account.name_en}
                onChange={(e) => onEditFormChange({ name_en: e.target.value })}
                className="w-32 rounded border border-white/20 bg-white/5 px-2 py-1 text-xs"
              />
              <button type="button" onClick={() => onUpdate(account.id)} className="rounded bg-emerald-500 px-2 py-1 text-xs text-white">✓</button>
              <button type="button" onClick={onCancelEdit} className="rounded bg-slate-500 px-2 py-1 text-xs">✕</button>
            </span>
          ) : (
            <>
              {account.name_ar}
              <span className="ml-2 text-xs italic text-slate-500">({account.name_en})</span>
            </>
          )}
        </span>
        <span
          className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] ${
            isBalanceSheet ? "bg-soft-primary" : "bg-soft-success"
          }`}
        >
          {account.statement}
        </span>
        {canEdit && editingId !== account.id && (
          <span className="flex shrink-0 gap-1">
            <button type="button" onClick={() => onStartEdit(account)} className="rounded px-2 py-1 text-xs text-[#00ffcc] hover:bg-[#00ffcc]/10">📝</button>
            {!account.has_balance && (
              <button type="button" onClick={() => onDelete(account)} className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">🗑️</button>
            )}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="child-container">
          {children.map((child) => (
            <TreeBranch
              key={child.id}
              account={child}
              all={all}
              expanded={expanded}
              onToggle={onToggle}
              isRTL={isRTL}
              editingId={editingId}
              editForm={editForm}
              onStartEdit={onStartEdit}
              onEditFormChange={onEditFormChange}
              onUpdate={onUpdate}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              matchedCodes={matchedCodes}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Get all parent codes for an account (prefixes that exist in all) */
function getParentCodes(code: string, all: ChartAccount[]): string[] {
  const codes = new Set(all.map((a) => a.code));
  const parents: string[] = [];
  for (let len = 1; len < code.length; len++) {
    const prefix = code.slice(0, len);
    if (codes.has(prefix)) parents.push(prefix);
  }
  return parents;
}

export default function ChartOfAccountsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canEditChart = user?.username === "SAIF" || !!user?.permissions?.edit_chart_of_accounts;
  const isRTL = i18n.language === "ar";
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ChartAccount>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const { matchedCodes, parentsToExpand } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { matchedCodes: new Set<string>(), parentsToExpand: new Set<string>() };
    const matched = new Set<string>();
    const parents = new Set<string>();
    accounts.forEach((a) => {
      const text = `${a.code} ${a.name_ar} ${a.name_en}`.toLowerCase();
      if (text.includes(q)) {
        matched.add(a.code);
        getParentCodes(a.code, accounts).forEach((p) => parents.add(p));
      }
    });
    return { matchedCodes: matched, parentsToExpand: parents };
  }, [searchQuery, accounts]);

  useEffect(() => {
    if (parentsToExpand.size > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        parentsToExpand.forEach((c) => next.add(c));
        return next;
      });
    }
  }, [searchQuery, parentsToExpand]);

  const toggleExpand = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const rootAccounts = accounts.filter((a) => a.level === 1);

  const load = () => {
    setLoading(true);
    fetchChartAccounts()
      .then((r) => setAccounts(Array.isArray(r) ? r : []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget;
    const code = (form.querySelector('[name="code"]') as HTMLInputElement)?.value?.trim();
    const name_ar = (form.querySelector('[name="name_ar"]') as HTMLInputElement)?.value?.trim();
    const name_en = (form.querySelector('[name="name_en"]') as HTMLInputElement)?.value?.trim();
    const level = parseInt((form.querySelector('[name="level"]') as HTMLSelectElement)?.value || "1", 10);
    const account_type = (form.querySelector('[name="account_type"]') as HTMLSelectElement)?.value;
    const statement = (form.querySelector('[name="statement"]') as HTMLSelectElement)?.value;
    const parentCode = (form.querySelector('[name="parent"]') as HTMLSelectElement)?.value || null;

    if (!code || !name_ar || !name_en) {
      setError(isRTL ? "رقم الحساب والاسم مطلوبان" : "Code and name required");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      const parent = parentCode ? accounts.find((a) => a.code === parentCode) : null;
      await createChartAccount({
        code,
        name_ar,
        name_en,
        level,
        parent: parent?.id ?? null,
        account_type: account_type || "تحليلي",
        statement: statement || "المركز المالي",
      });
      (form as HTMLFormElement).reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editForm.name_ar && !editForm.name_en) return;
    setError(null);
    try {
      await updateChartAccount(id, editForm);
      setEditingId(null);
      setEditForm({});
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async (acc: ChartAccount) => {
    if (acc.has_balance) {
      setError(isRTL ? "لا يمكن حذف حساب له رصيد أو حركات مالية" : "Cannot delete account with balance");
      return;
    }
    if (!confirm(isRTL ? `حذف الحساب ${acc.code}؟` : `Delete account ${acc.code}?`)) return;
    setError(null);
    try {
      await deleteChartAccount(acc.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          to="/finance"
          className="text-sm font-medium text-emerald-500 hover:text-emerald-600 dark:text-emerald-400"
        >
          ← {isRTL ? "العودة للمركز المالي" : "Back to Finance Hub"}
        </Link>
        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          FIN-006
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
          {isRTL ? "دليل الشجرة المحاسبية الرسمي" : "Official Chart of Accounts"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isRTL ? "نظام سيف المالي – المستويات 1 إلى 5" : "Saif Financial System – Levels 1–5"}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-[#00ffcc]/20 shadow-lg"
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#00ffcc]/20 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <svg className="h-5 w-5 text-[#00ffcc]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {isRTL ? "دليل الحسابات" : "Chart of Accounts"}
          </h2>
          <div className="flex min-w-[200px] max-w-[300px] items-center rounded-xl border border-[#00ffcc]/30 bg-white/5">
            <span className="px-3 py-2 text-[#00ffcc]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? "ابحث برقم أو اسم الحساب..." : "Search by code or name..."}
              className="flex-1 border-0 bg-transparent px-2 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0"
              dir={isRTL ? "rtl" : "ltr"}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const form = document.getElementById("add-account-form");
              form?.scrollIntoView({ behavior: "smooth" });
            }}
            className="rounded-xl bg-[#00ffcc] px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-[#00ffcc]/90"
          >
            + {isRTL ? "إضافة حساب جديد" : "Add New Account"}
          </button>
        </div>

        <form id="add-account-form" onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 border-b border-white/10 p-4">
          <input name="code" placeholder={isRTL ? "رقم الحساب" : "Code"} required className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder-slate-500" />
          <input name="name_ar" placeholder={isRTL ? "الاسم (عربي)" : "Name (AR)"} required dir="rtl" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder-slate-500" />
          <input name="name_en" placeholder={isRTL ? "الاسم (EN)" : "Name (EN)"} required className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder-slate-500" />
          <select name="level" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select name="account_type" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100">
            <option value="رئيسي">رئيسي</option>
            <option value="تحليلي">تحليلي</option>
          </select>
          <select name="statement" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100">
            <option value="المركز المالي">المركز المالي</option>
            <option value="قائمة الدخل">قائمة الدخل</option>
          </select>
          <select name="parent" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100">
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.code}>{a.code} {isRTL ? a.name_ar : a.name_en}</option>
            ))}
          </select>
          <button type="submit" disabled={adding} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {adding ? "…" : isRTL ? "إضافة" : "Add"}
          </button>
        </form>

        <div id="tree-display-container" className="overflow-x-auto" dir={isRTL ? "rtl" : "ltr"}>
          {loading ? (
            <div className="px-4 py-12 text-center text-slate-400">
              {isRTL ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : accounts.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-400">
              {isRTL ? "لا توجد حسابات. أضف حساباً أولاً." : "No accounts. Add one first."}
            </div>
          ) : (
            <div className="chart-tree divide-y divide-white/5">
              {rootAccounts.map((acc) => (
                <TreeBranch
                  key={acc.id}
                  account={acc}
                  all={accounts}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  isRTL={isRTL}
                  editingId={editingId}
                  editForm={editForm}
                  onStartEdit={(a) => { setEditingId(a.id); setEditForm({}); }}
                  onEditFormChange={(u) => setEditForm((f) => ({ ...f, ...u }))}
                  onUpdate={handleUpdate}
                  onCancelEdit={() => { setEditingId(null); setEditForm({}); }}
                  onDelete={handleDelete}
                  matchedCodes={matchedCodes}
                  canEdit={canEditChart}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
