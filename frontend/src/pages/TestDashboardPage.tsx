/**
 * Test Dashboard — Superuser Only
 * Shows integration test suite results and allows one-click execution.
 * Accessible at: /test-dashboard
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestDetail {
  name: string;
  node_id: string;
  status: "PASS" | "FAIL";
  duration_ms: number;
  error?: string | null;
}

interface Category {
  label: string;
  key: string;
  passed: number;
  failed: number;
  tests: TestDetail[];
}

interface TableRow {
  حركة: string;
  الاختبارات: number;
  نجح: number;
  فشل: number;
  الحالة: string;
}

interface Summary {
  total: number;
  passed: number;
  failed: number;
  duration_s: number;
  status: string;
}

interface DashboardData {
  has_results: boolean;
  summary?: Summary;
  table?: TableRow[];
  categories?: Category[];
  run_at?: string;
  elapsed_s?: number;
  detail?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fetchStatus = (): Promise<DashboardData> =>
  api.get("/test-dashboard/status/").then((r) => r.data);

const triggerRun = (): Promise<DashboardData> =>
  api.post("/test-dashboard/run/", {}).then((r) => r.data);

// ─── Sub-components ───────────────────────────────────────────────────────────

const Badge: React.FC<{ pass: boolean; count: number }> = ({ pass, count }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      pass
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    }`}
  >
    {pass ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
    {count}
  </span>
);

const SummaryBar: React.FC<{ data: DashboardData }> = ({ data }) => {
  const s = data.summary!;
  const pct = s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0;
  const allPass = s.failed === 0;

  return (
    <div
      className={`rounded-2xl p-6 text-white shadow-lg ${
        allPass
          ? "bg-gradient-to-r from-emerald-500 to-teal-600"
          : "bg-gradient-to-r from-red-500 to-orange-600"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium opacity-80">حالة الاختبارات</p>
          <p className="mt-1 text-3xl font-bold">{s.status}</p>
          {data.run_at && (
            <p className="mt-1 text-xs opacity-70">
              آخر تشغيل: {new Date(data.run_at).toLocaleString("ar-SA")}
            </p>
          )}
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-3xl font-bold">{s.total}</p>
            <p className="text-sm opacity-80">إجمالي</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-emerald-200">{s.passed}</p>
            <p className="text-sm opacity-80">نجح</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-red-200">{s.failed}</p>
            <p className="text-sm opacity-80">فشل</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{s.duration_s}s</p>
            <p className="text-sm opacity-80">الوقت</p>
          </div>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-4 h-2 w-full rounded-full bg-white/30">
        <div
          className="h-2 rounded-full bg-white transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs opacity-70">{pct}% passed</p>
    </div>
  );
};

const SummaryTable: React.FC<{ rows: TableRow[] }> = ({ rows }) => (
  <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm dark:border-gray-700">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 dark:bg-gray-800">
        <tr>
          {["الحركة", "الاختبارات", "نجح", "فشل", "الحالة"].map((h) => (
            <th
              key={h}
              className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map((row) => (
          <tr
            key={row["حركة"]}
            className="bg-white transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
              {row["حركة"]}
            </td>
            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
              {row["الاختبارات"]}
            </td>
            <td className="px-4 py-3">
              <Badge pass count={row["نجح"]} />
            </td>
            <td className="px-4 py-3">
              {row["فشل"] > 0 ? (
                <Badge pass={false} count={row["فشل"]} />
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </td>
            <td className="px-4 py-3 font-semibold">
              <span
                className={
                  row["الحالة"].startsWith("✅")
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }
              >
                {row["الحالة"]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const CategoryAccordion: React.FC<{ categories: Category[] }> = ({ categories }) => {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const isOpen = open.has(cat.key);
        const allPass = cat.failed === 0;
        return (
          <div
            key={cat.key}
            className="overflow-hidden rounded-xl border border-gray-200 shadow-sm dark:border-gray-700"
          >
            <button
              onClick={() => toggle(cat.key)}
              className={`flex w-full items-center justify-between px-5 py-4 text-right font-semibold transition-colors ${
                allPass
                  ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50"
                  : "bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50"
              }`}
            >
              <div className="flex items-center gap-3">
                {allPass ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <XCircle size={18} className="text-red-600" />
                )}
                <span className="text-gray-900 dark:text-gray-100">{cat.label}</span>
                <span className="text-xs text-gray-500">
                  ({cat.passed + cat.failed} اختبار)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge pass count={cat.passed} />
                {cat.failed > 0 && <Badge pass={false} count={cat.failed} />}
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </button>

            {isOpen && (
              <div className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-900">
                {cat.tests.map((t, idx) => (
                  <div key={idx} className="flex items-start gap-3 px-5 py-3">
                    {t.status === "PASS" ? (
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
                        {t.name}
                      </p>
                      {t.error && (
                        <pre className="mt-1 overflow-x-auto rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          {t.error}
                        </pre>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{t.duration_ms}ms</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const TestDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Superuser guard
  if (!user?.is_superuser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            هذه الصفحة للمشرف العام فقط
          </p>
        </div>
      </div>
    );
  }

  const loadStatus = useCallback(async () => {
    try {
      const result = await fetchStatus();
      setData(result);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "فشل تحميل الحالة");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleRunAll = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await triggerRun();
      setData(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "فشل تشغيل الاختبارات");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 rtl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardList size={28} className="text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Test Dashboard
            </h1>
            <p className="text-sm text-gray-500">لوحة تحكم الاختبارات – للمشرف العام فقط</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadStatus}
            disabled={running}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <RefreshCw size={15} className={running ? "animate-spin" : ""} />
            تحديث
          </button>
          <button
            onClick={handleRunAll}
            disabled={running}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {running ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                جاري التشغيل...
              </>
            ) : (
              <>
                <Play size={15} />
                Execute All Tests
              </>
            )}
          </button>
        </div>
      </div>

      {/* Running overlay message */}
      {running && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-indigo-50 p-4 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200">
          <Loader2 size={20} className="animate-spin" />
          <div>
            <p className="font-semibold">جاري تشغيل 47 اختبار...</p>
            <p className="text-sm opacity-75">قد يستغرق 30-90 ثانية. لا تغلق الصفحة.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-red-800 dark:bg-red-900/30 dark:text-red-200">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      {/* No results yet */}
      {!running && data && !data.has_results && (
        <div className="mb-6 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600">
          <ClipboardList size={40} className="mx-auto mb-3 text-gray-400" />
          <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
            لم يتم تشغيل الاختبارات بعد
          </p>
          <p className="mt-1 text-sm text-gray-400">
            اضغط <strong>Execute All Tests</strong> لتشغيل جميع الاختبارات
          </p>
        </div>
      )}

      {/* Results */}
      {data?.has_results && data.summary && (
        <div className="space-y-6">
          {/* Summary banner */}
          <SummaryBar data={data} />

          {/* Info bar */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>⏱ وقت التنفيذ: <strong>{data.summary.duration_s}s</strong></span>
            <span>🗄 قاعدة البيانات: <strong>in-memory SQLite (--no-migrations)</strong></span>
            <span>📁 ملف التقرير: <strong>integration_tests/last_run.json</strong></span>
          </div>

          {/* Coverage table */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-200">
              ملخص التغطية
            </h2>
            <SummaryTable rows={data.table || []} />
          </div>

          {/* Category accordion */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-200">
              تفاصيل الاختبارات
            </h2>
            <CategoryAccordion categories={data.categories || []} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TestDashboardPage;
