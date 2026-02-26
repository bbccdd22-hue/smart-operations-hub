/**
 * شاشة المطبخ المركزي – استقبال طلبات التحويل من الفروع
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchCentralKitchenTransfers,
  confirmStockTransfer,
  rejectStockTransfer,
  type StockTransferItem,
} from "../lib/api";

export default function CentralKitchenPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [transfers, setTransfers] = useState<StockTransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCentralKitchenTransfers();
      setTransfers(res.transfers);
    } catch {
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async (uuid: string) => {
    setConfirmingId(uuid);
    try {
      await confirmStockTransfer(uuid);
      load();
    } catch {
      // ignore
    } finally {
      setConfirmingId(null);
    }
  };

  const handleReject = async (uuid: string) => {
    if (!window.confirm(t("rejectTransferConfirm") ?? "Reject this transfer?")) return;
    setRejectingId(uuid);
    try {
      await rejectStockTransfer(uuid);
      load();
    } catch {
      // ignore
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="mx-auto max-w-6xl space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
        {t("centralKitchen") ?? "Central Kitchen"}
      </h1>
      <p className="text-slate-600 dark:text-slate-400">
        {t("centralKitchenDesc") ?? "Incoming transfer requests from branches"}
      </p>

      {loading ? (
        <p className="py-8 text-center text-slate-500">{t("loading") ?? "Loading..."}</p>
      ) : transfers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-slate-600 dark:text-slate-400">
            {t("noPendingTransfers") ?? "No pending transfer requests"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {transfers.map((tr) => (
            <div
              key={tr.uuid}
              className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {tr.from_branch_name}
                  </span>
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {tr.to_branch_name}
                  </span>
                </div>
                <div className="text-sm text-slate-500">
                  {tr.requested_at ? new Date(tr.requested_at).toLocaleString() : ""}
                  {tr.requested_by && ` · ${tr.requested_by}`}
                </div>
              </div>
              {tr.notes && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{tr.notes}</p>
              )}
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[320px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-left font-medium">{t("ingredient") ?? "Ingredient"}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("qty") ?? "Qty"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tr.lines.map((l, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="px-3 py-2">{l.ingredient_name}</td>
                        <td className="px-3 py-2 text-right">{l.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => tr.uuid && handleConfirm(tr.uuid)}
                  disabled={!!confirmingId || !!rejectingId || !tr.uuid}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {confirmingId === tr.uuid ? "..." : t("confirmReceive") ?? "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => tr.uuid && handleReject(tr.uuid)}
                  disabled={!!confirmingId || !!rejectingId}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  {rejectingId === tr.uuid ? "..." : t("reject") ?? "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
