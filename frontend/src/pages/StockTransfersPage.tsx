/**
 * صفحة التحويل بين الفروع – طلب وتحويل وتأكيد استلام.
 * الجداول تدعم التمرير الأفقي على الآيباد.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  confirmStockTransfer,
  createStockTransfer,
  fetchBranches,
  fetchIngredients,
  fetchStockTransfers,
  rejectStockTransfer,
  type StockTransferItem,
} from "../lib/api";
import type { Branch, ManageIngredient } from "../lib/api";

export default function StockTransfersPage() {
  const { t } = useTranslation();
  const [transfers, setTransfers] = useState<StockTransferItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ingredients, setIngredients] = useState<ManageIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromBranch, setFromBranch] = useState<number | "">("");
  const [toBranch, setToBranch] = useState<number | "">("");
  const [lines, setLines] = useState<Array<{ ingredient_id: number; qty: string }>>([
    { ingredient_id: 0, qty: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | string | null>(null);
  const [rejectingId, setRejectingId] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, br, ing] = await Promise.all([
        fetchStockTransfers(),
        fetchBranches(),
        fetchIngredients(),
      ]);
      setTransfers(Array.isArray(tr?.transfers) ? tr.transfers : []);
      const brList = Array.isArray(br) ? br : [];
      setBranches(brList.filter((b) => (b as { branch_code?: string }).branch_code !== "IN_TRANSIT"));
      setIngredients(Array.isArray(ing) ? ing : []);
    } catch {
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddLine = () => {
    setLines((prev) => [...prev, { ingredient_id: 0, qty: "" }]);
  };

  const handleRemoveLine = (i: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleLineChange = (i: number, field: "ingredient_id" | "qty", value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: field === "ingredient_id" ? Number(value) : String(value) };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!fromBranch || !toBranch || fromBranch === toBranch) {
      setError(t("selectBranches") ?? "Select from and to branches");
      return;
    }
    const validLines = lines.filter((l) => l.ingredient_id > 0 && parseFloat(l.qty) > 0);
    if (validLines.length === 0) {
      setError(t("addLine") ?? "Add at least one line");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createStockTransfer({
        from_branch_id: fromBranch,
        to_branch_id: toBranch,
        lines: validLines.map((l) => ({
          ingredient_id: l.ingredient_id,
          qty: parseFloat(l.qty),
        })),
        notes: notes || undefined,
      });
      setFromBranch("");
      setToBranch("");
      setLines([{ ingredient_id: 0, qty: "" }]);
      setNotes("");
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (uuid: string) => {
    setConfirmingId(uuid);
    try {
      await confirmStockTransfer(uuid);
      loadData();
    } catch {
      // ignore
    } finally {
      setConfirmingId(null);
    }
  };

  const handleReject = async (uuid: string) => {
    if (!window.confirm(t("rejectTransferConfirm") ?? "هل تريد رفض استلام هذا التحويل؟ سيُعاد المخزون للفرع المرسل.")) return;
    setRejectingId(uuid);
    try {
      await rejectStockTransfer(uuid);
      loadData();
    } catch {
      // ignore
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
        {t("stockTransfers") ?? "التحويل بين الفروع"}
      </h1>

      {/* نموذج إنشاء تحويل */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-200">
          {t("newTransfer") ?? "طلب تحويل جديد"}
        </h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
              {t("fromBranch") ?? "من الفرع"}
            </label>
            <select
              value={fromBranch}
              onChange={(e) => setFromBranch(e.target.value ? Number(e.target.value) : "")}
              className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="">--</option>
              {(Array.isArray(branches) ? branches : []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
              {t("toBranch") ?? "إلى الفرع"}
            </label>
            <select
              value={toBranch}
              onChange={(e) => setToBranch(e.target.value ? Number(e.target.value) : "")}
              className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="">--</option>
              {(Array.isArray(branches) ? branches : []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
              {t("notes") ?? "ملاحظات"}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesOptional") ?? "اختياري"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {t("lines") ?? "البنود"}
            </span>
            <button
              type="button"
              onClick={handleAddLine}
              className="rounded-lg bg-slate-200 px-3 py-1 text-sm dark:bg-slate-600"
            >
              + {t("add") ?? "إضافة"}
            </button>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="mt-2 flex gap-2">
              <select
                value={line.ingredient_id}
                onChange={(e) => handleLineChange(i, "ingredient_id", e.target.value)}
                className="flex-1 rounded-lg border px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value={0}>-- {t("ingredient") ?? "مكوّن"} --</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name_en}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.qty}
                onChange={(e) => handleLineChange(i, "qty", e.target.value)}
                placeholder="Qty"
                className="w-24 rounded-lg border px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() => handleRemoveLine(i)}
                className="rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {error && (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-4 rounded-xl bg-emerald-600 px-6 py-2.5 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "..." : t("createTransfer") ?? "إنشاء التحويل"}
        </button>
      </section>

      {/* جدول التحويلات – دعم التمرير الأفقي */}
      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <h2 className="border-b px-6 py-4 text-lg font-semibold dark:border-slate-700 dark:text-slate-200">
          {t("transfersList") ?? "قائمة التحويلات"}
        </h2>
        <div className="overflow-x-auto overflow-y-visible" style={{ WebkitOverflowScrolling: "touch" }}>
          <table className="min-w-[600px] w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("from") ?? "من"}
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("to") ?? "إلى"}
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("status") ?? "الحالة"}
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("date") ?? "التاريخ"}
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  {t("actions") ?? "إجراءات"}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    {t("loading") ?? "جاري التحميل..."}
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    {t("noTransfers") ?? "لا توجد تحويلات"}
                  </td>
                </tr>
              ) : (
                (Array.isArray(transfers) ? transfers : []).map((tr) => (
                  <tr
                    key={tr.id}
                    className="border-b border-slate-100 dark:border-slate-700"
                  >
                    <td className="px-4 py-3 text-sm">{tr.from_branch_name}</td>
                    <td className="px-4 py-3 text-sm">{tr.to_branch_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          tr.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : tr.status === "rejected"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {tr.status === "confirmed"
                          ? (t("confirmed") ?? "مؤكد")
                          : tr.status === "rejected"
                            ? (t("rejected") ?? "مرفوض")
                            : (t("pending") ?? "قيد الانتظار")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {tr.requested_at?.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      {tr.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleConfirm(tr.uuid ?? String(tr.id))}
                            disabled={confirmingId === (tr.uuid ?? tr.id)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {confirmingId === (tr.uuid ?? tr.id) ? "..." : t("confirmReceipt") ?? "تأكيد الاستلام"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(tr.uuid ?? String(tr.id))}
                            disabled={rejectingId === (tr.uuid ?? tr.id)}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            {rejectingId === (tr.uuid ?? tr.id) ? "..." : t("rejectReceipt") ?? "رفض الاستلام"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* تفاصيل البنود – جدول متداخل مع تمرير أفقي */}
        {transfers.some((t) => t.lines?.length) ? (
          <div className="border-t dark:border-slate-700">
            <div className="overflow-x-auto px-4 py-3" style={{ WebkitOverflowScrolling: "touch" }}>
              <table className="min-w-[400px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-4">{t("transfer") ?? "التحويل"}</th>
                    <th className="py-2 pr-4">{t("ingredient") ?? "المكوّن"}</th>
                    <th className="py-2">{t("qty") ?? "الكمية"}</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.flatMap((tr) =>
                    (tr.lines || []).map((line, i) => (
                      <tr key={`${tr.id}-${i}`} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="py-2 pr-4">#{tr.id}</td>
                        <td className="py-2 pr-4">{line.ingredient_name}</td>
                        <td className="py-2">{line.qty}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
