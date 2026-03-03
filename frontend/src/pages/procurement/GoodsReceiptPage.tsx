/**
 * إشعارات استلام البضاعة — Goods Receipt Notes (GRN)
 * قائمة استلامات، إنشاء من أمر شراء، وتأكيد الاستلام (تحديث المخزون + قيد الاستحقاق).
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  PackageCheck,
  RefreshCw,
  Plus,
  CheckCircle,
  FileText,
  Truck,
  Loader2,
} from "lucide-react";
import {
  fetchBranches,
  fetchBrands,
  listGoodsReceipts,
  listPurchaseOrders,
  getPurchaseOrderDetail,
  createGoodsReceipt,
  confirmGoodsReceipt,
  type GoodsReceiptResponse,
  type PurchaseOrderDetail,
  type PurchaseOrderListItem,
  type Branch,
  type Brand,
} from "../../lib/api";

const fmtDate = (d: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function GoodsReceiptPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [receipts, setReceipts] = useState<GoodsReceiptResponse[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const [brandFilter, setBrandFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [orders, setOrders] = useState<PurchaseOrderListItem[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>("");
  const [poDetail, setPoDetail] = useState<PurchaseOrderDetail | null>(null);
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lineQuantities, setLineQuantities] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const d = await listGoodsReceipts({
        brand_id: brandFilter || undefined,
        branch_id: branchFilter || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setReceipts(d.receipts || []);
    } catch {
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [brandFilter, branchFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (showForm) {
      listPurchaseOrders({}).then((d) => setOrders(d.orders || [])).catch(() => setOrders([]));
    }
  }, [showForm]);

  useEffect(() => {
    if (!selectedPoId) {
      setPoDetail(null);
      setLineQuantities({});
      return;
    }
    const id = parseInt(selectedPoId, 10);
    if (isNaN(id)) return;
    getPurchaseOrderDetail(id)
      .then((po) => {
        setPoDetail(po);
        const initial: Record<number, number> = {};
        po.lines.forEach((l) => {
          initial[l.id] = parseFloat(l.quantity) || 0;
        });
        setLineQuantities(initial);
      })
      .catch(() => {
        setPoDetail(null);
        setLineQuantities({});
      });
  }, [selectedPoId]);

  const handleConfirm = useCallback(
    async (id: number) => {
      setConfirmingId(id);
      try {
        await confirmGoodsReceipt(id);
        await loadReceipts();
      } catch {
        // could toast
      } finally {
        setConfirmingId(null);
      }
    },
    [loadReceipts]
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedPoId || !poDetail) {
      setFormError(T("اختر أمر شراء", "Select a purchase order"));
      return;
    }
    const poId = parseInt(selectedPoId, 10);
    const lines = poDetail.lines
      .map((l) => ({
        order_line_id: l.id,
        quantity_received: lineQuantities[l.id] ?? 0,
      }))
      .filter((l) => l.quantity_received > 0);
    if (lines.length === 0) {
      setFormError(T("أدخل كمية مستلمة لصنف واحد على الأقل", "Enter received quantity for at least one line"));
      return;
    }
    setSaving(true);
    try {
      await createGoodsReceipt({
        purchase_order_id: poId,
        receipt_date: receiptDate,
        notes: notes.trim() || undefined,
        lines,
      });
      setShowForm(false);
      setSelectedPoId("");
      setPoDetail(null);
      setNotes("");
      setLineQuantities({});
      await loadReceipts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create receipt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <PackageCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("استلام البضاعة", "Goods Receipt Notes")}</h1>
              <p className="text-xs text-gray-400">
                {T("إنشاء وتأكيد إشعارات الاستلام وربطها بأوامر الشراء", "Create and confirm receipts linked to purchase orders")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> {T("استلام جديد", "New receipt")}
            </button>
            <button
              type="button"
              onClick={loadReceipts}
              className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mt-4 p-4 rounded-xl bg-[#161b27] border border-white/10">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">{T("إنشاء إشعار استلام من أمر شراء", "Create receipt from purchase order")}</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{T("أمر الشراء", "Purchase order")}</label>
                  <select
                    value={selectedPoId}
                    onChange={(e) => setSelectedPoId(e.target.value)}
                    className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="">{T("اختر الأمر", "Select order")}</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.order_number} — {isRTL ? o.supplier_name_ar || o.supplier_name : o.supplier_name} / {o.branch_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{T("تاريخ الاستلام", "Receipt date")}</label>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{T("ملاحظات", "Notes")}</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={T("اختياري", "Optional")}
                    className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {poDetail && poDetail.lines.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                        <th className="px-3 py-2 text-start">{T("الصنف", "Item")}</th>
                        <th className="px-3 py-2 text-end">{T("الكمية المطلوبة", "Ordered")}</th>
                        <th className="px-3 py-2 text-end">{T("الكمية المستلمة", "Received")}</th>
                        <th className="px-3 py-2 text-start">{T("الوحدة", "Unit")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poDetail.lines.map((l) => (
                        <tr key={l.id} className="border-t border-white/5">
                          <td className="px-3 py-2">
                            {isRTL ? l.ingredient_name_ar || l.ingredient_name : l.ingredient_name}
                          </td>
                          <td className="px-3 py-2 text-end font-mono text-gray-400">{l.quantity}</td>
                          <td className="px-3 py-2 text-end">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={lineQuantities[l.id] ?? ""}
                              onChange={(e) =>
                                setLineQuantities((prev) => ({
                                  ...prev,
                                  [l.id]: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-24 bg-[#0e1117] border border-white/10 rounded px-2 py-1 text-right text-white text-sm"
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-400">{l.unit_code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {formError && (
                <p className="text-sm text-red-400">{formError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                  {T("حفظ مسودة الاستلام", "Save draft receipt")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                    setSelectedPoId("");
                    setPoDetail(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#1e2533] border border-white/10 text-gray-300 text-sm"
                >
                  {T("إلغاء", "Cancel")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        {!showForm && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">{T("كل العلامات", "All brands")}</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">{T("كل الفروع", "All branches")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">{T("كل الحالات", "All statuses")}</option>
              <option value="draft">{T("مسودة", "Draft")}</option>
              <option value="confirmed">{T("مؤكد", "Confirmed")}</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
        )}
      </div>

      <div className="px-4 md:px-6 py-4">
        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{T("لا توجد إشعارات استلام", "No goods receipts found")}</p>
              <p className="text-xs mt-1">{T("أنشئ استلاماً من أمر شراء أو عدّل الفلاتر", "Create a receipt from a purchase order or adjust filters")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3 text-start">{T("رقم الاستلام", "Receipt #")}</th>
                    <th className="px-4 py-3 text-start">{T("التاريخ", "Date")}</th>
                    <th className="px-4 py-3 text-start">{T("أمر الشراء", "PO")}</th>
                    <th className="px-4 py-3 text-start">{T("المورد", "Supplier")}</th>
                    <th className="px-4 py-3 text-start">{T("الفرع", "Branch")}</th>
                    <th className="px-4 py-3 text-center">{T("الحالة", "Status")}</th>
                    <th className="px-4 py-3 text-start">{T("مرتبط بفاتورة", "Linked invoice(s)")}</th>
                    <th className="px-4 py-3 text-center">{T("إجراءات", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-300">{r.receipt_number}</td>
                      <td className="px-4 py-3 text-gray-300">{fmtDate(r.receipt_date)}</td>
                      <td className="px-4 py-3 text-gray-300">{r.purchase_order_number}</td>
                      <td className="px-4 py-3">
                        {isRTL ? r.supplier_name_ar || r.supplier_name : r.supplier_name}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{r.branch_name}</td>
                      <td className="px-4 py-3 text-center">
                        {r.status === "confirmed" ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                            <CheckCircle className="h-3 w-3" /> {T("مؤكد", "Confirmed")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                            <PackageCheck className="h-3 w-3" /> {T("مسودة", "Draft")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.invoice_ids && r.invoice_ids.length > 0 ? (
                          <span className="flex flex-wrap gap-1">
                            {r.invoice_ids.map((invId) => (
                              <button
                                key={invId}
                                type="button"
                                onClick={() => navigate(`/procurement/invoices/${invId}/edit`)}
                                className="inline-flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded hover:bg-blue-500/30"
                              >
                                <FileText className="h-3 w-3" /> #{invId}
                              </button>
                            ))}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "draft" && (
                          <button
                            type="button"
                            onClick={() => handleConfirm(r.id)}
                            disabled={confirmingId === r.id}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 text-xs disabled:opacity-50"
                          >
                            {confirmingId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}
                            {T("تأكيد الاستلام", "Confirm receipt")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {T(`إجمالي: ${receipts.length} إشعار`, `Total: ${receipts.length} receipt(s)`)}
        </p>
      </div>
    </div>
  );
}
