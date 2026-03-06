/**
 * نموذج فاتورة شراء — Purchase Invoice Form
 * إنشاء فاتورة شراء جديدة: المورد، الفرع، رقم الفاتورة، التاريخ، وجدول ديناميكي للبنود مع VAT
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  FileText,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Loader2,
} from "lucide-react";
import {
  fetchSuppliers,
  fetchBranches,
  fetchIngredients,
  fetchInventoryUnits,
  createPurchaseInvoice,
  getPurchaseInvoice,
  updatePurchaseInvoice,
  type PurchaseInvoiceCreatePayload,
  type PurchaseInvoiceLinePayload,
  type PurchaseInvoiceDetail,
} from "../../lib/api";
import type { ManageIngredient } from "../../lib/api";
import type { InventoryUnit } from "../../lib/api";
import type { Branch } from "../../lib/api";

const DEFAULT_VAT_RATE = 15;

interface InvoiceLine {
  ingredient_id: number | null;
  description: string;
  quantity: number;
  unit_id: number | null;
  unit_price_excl_vat: number;
  vat_rate: number;
}

function emptyLine(): InvoiceLine {
  return {
    ingredient_id: null,
    description: "",
    quantity: 0,
    unit_id: null,
    unit_price_excl_vat: 0,
    vat_rate: DEFAULT_VAT_RATE,
  };
}

function lineTotalExcl(line: InvoiceLine): number {
  return line.quantity * line.unit_price_excl_vat;
}

function lineVat(line: InvoiceLine): number {
  return lineTotalExcl(line) * (line.vat_rate / 100);
}

function lineTotalIncl(line: InvoiceLine): number {
  return lineTotalExcl(line) + lineVat(line);
}

const fmtNum = (n: number) => {
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PurchaseInvoiceForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string; name_ar?: string; brand: number }>>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ingredients, setIngredients] = useState<ManageIngredient[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);

  const [supplierId, setSupplierId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<PurchaseInvoiceDetail | null>(null);

  useEffect(() => {
    fetchSuppliers().then((r) => setSuppliers(Array.isArray(r) ? r : [])).catch(() => setSuppliers([]));
    fetchBranches().then((r) => setBranches(Array.isArray(r) ? r : [])).catch(() => setBranches([]));
    fetchIngredients().then((r) => setIngredients(Array.isArray(r) ? r : [])).catch(() => setIngredients([]));
    fetchInventoryUnits().then((r) => setUnits(Array.isArray(r) ? r : [])).catch(() => setUnits([]));
  }, []);

  const loadInvoice = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const inv = await getPurchaseInvoice(Number(id));
      setInvoice(inv);
      setSupplierId(String(inv.supplier));
      setBranchId(String(inv.branch));
      setInvoiceNumber(inv.invoice_number);
      setInvoiceDate(inv.invoice_date.slice(0, 10));
      setNotes(inv.notes || "");
      if (inv.lines?.length) {
        setLines(
          inv.lines.map((l) => ({
            ingredient_id: l.ingredient ?? null,
            description: l.description || "",
            quantity: parseFloat(l.quantity) || 0,
            unit_id: l.unit ?? null,
            unit_price_excl_vat: parseFloat(l.unit_price_excl_vat) || 0,
            vat_rate: parseFloat(l.vat_rate) || DEFAULT_VAT_RATE,
          }))
        );
      } else {
        setLines([emptyLine()]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEdit) loadInvoice();
  }, [isEdit, loadInvoice]);

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) => {
    setLines((prev) => (prev.length <= 1 ? [emptyLine()] : prev.filter((_, i) => i !== index)));
  };

  const updateLine = (index: number, patch: Partial<InvoiceLine>) => {
    setLines((prev) => {
      const next = [...prev];
      const current = next[index];
      next[index] = { ...current, ...patch };
      if (patch.ingredient_id != null) {
        const ing = ingredients.find((i) => i.id === patch.ingredient_id);
        if (ing?.base_unit_id != null && current.unit_id === null) next[index].unit_id = ing.base_unit_id;
      }
      return next;
    });
  };

  const subtotalExcl = lines.reduce((s, l) => s + lineTotalExcl(l), 0);
  const totalVat = lines.reduce((s, l) => s + lineVat(l), 0);
  const grandTotal = subtotalExcl + totalVat;

  const buildPayload = (): PurchaseInvoiceCreatePayload => ({
    supplier_id: Number(supplierId) || 0,
    branch_id: Number(branchId) || 0,
    invoice_number: invoiceNumber.trim(),
    invoice_date: invoiceDate,
    notes: notes.trim() || undefined,
    lines: lines
      .filter((l) => l.quantity > 0 && (l.ingredient_id != null || l.description.trim()))
      .map(
        (l): PurchaseInvoiceLinePayload => ({
          ingredient_id: l.ingredient_id || undefined,
          description: l.description.trim() || undefined,
          quantity: l.quantity,
          unit_id: l.unit_id || undefined,
          unit_price_excl_vat: l.unit_price_excl_vat,
          vat_rate: l.vat_rate,
        })
      ),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supplierId || !branchId || !invoiceNumber.trim() || !invoiceDate) {
      setError(T("يرجى تعبئة المورد والفرع ورقم الفاتورة والتاريخ", "Please fill Supplier, Branch, Invoice number and Date"));
      return;
    }
    const payload = buildPayload();
    if (payload.lines.length === 0) {
      setError(T("أضف بنداً واحداً على الأقل بكمية و (مكوّن أو وصف)", "Add at least one line with quantity and (ingredient or description)"));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updatePurchaseInvoice(Number(id), {
          invoice_number: payload.invoice_number,
          invoice_date: payload.invoice_date,
          notes: payload.notes ?? "",
        });
        navigate("/procurement/invoices", { replace: true });
      } else {
        await createPurchaseInvoice(payload);
        navigate("/procurement/invoices", { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e1117] text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/procurement/invoices")}
              className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/30">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">
                {isEdit ? T("تعديل فاتورة الشراء", "Edit Purchase Invoice") : T("فاتورة شراء جديدة", "New Purchase Invoice")}
              </h1>
              <p className="text-xs text-gray-400">
                {T("المورد، الفرع، رقم الفاتورة، التاريخ والبنود مع الضريبة", "Supplier, Branch, Invoice #, Date and lines with VAT")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {T("حفظ", "Save")}
          </button>
        </div>
        {error && (
          <div className="mt-3 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="px-4 md:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl p-4 md:p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">{T("بيانات الفاتورة", "Invoice details")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{T("المورد", "Supplier")}</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">{T("اختر المورد", "Select supplier")}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {isRTL ? s.name_ar || s.name : s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{T("الفرع", "Branch")}</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">{T("اختر الفرع", "Select branch")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{T("رقم الفاتورة", "Invoice number")}</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
                placeholder="INV-001"
                className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{T("التاريخ", "Date")}</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
                className="w-full bg-[#0e1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <div className="mt-4">
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

        {/* Lines */}
        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h2 className="text-sm font-semibold text-gray-300">{T("بنود الفاتورة", "Invoice lines")}</h2>
            <button type="button" onClick={addLine} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30">
              <Plus className="h-4 w-4" /> {T("إضافة بند", "Add line")}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase">
                  <th className="px-3 py-2 text-start w-[20%]">{T("المكوّن / الوصف", "Ingredient / Description")}</th>
                  <th className="px-3 py-2 text-end w-[10%]">{T("الكمية", "Qty")}</th>
                  <th className="px-3 py-2 text-start w-[12%]">{T("الوحدة", "Unit")}</th>
                  <th className="px-3 py-2 text-end w-[12%]">{T("السعر بدون ضريبة", "Price Excl. VAT")}</th>
                  <th className="px-3 py-2 text-end w-[8%]">{T("ضريبة %", "VAT %")}</th>
                  <th className="px-3 py-2 text-end w-[14%]">{T("الإجمالي", "Line total")}</th>
                  <th className="px-3 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <select
                          value={line.ingredient_id ?? ""}
                          onChange={(e) => updateLine(idx, { ingredient_id: e.target.value ? Number(e.target.value) : null })}
                          className="w-full bg-[#0e1117] border border-white/10 rounded px-2 py-1.5 text-white text-xs"
                        >
                          <option value="">{T("— أو وصف حر —", "— or free text —")}</option>
                          {ingredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {isRTL ? ing.name_ar : ing.name_en}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(idx, { description: e.target.value })}
                          placeholder={T("وصف البند إن لم تختر مكوّناً", "Line description")}
                          className="w-full bg-[#0e1117] border border-white/10 rounded px-2 py-1 text-white text-xs"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-end">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={line.quantity || ""}
                        onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#0e1117] border border-white/10 rounded px-2 py-1.5 text-white text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={line.unit_id ?? ""}
                        onChange={(e) => updateLine(idx, { unit_id: e.target.value ? Number(e.target.value) : null })}
                        className="w-full bg-[#0e1117] border border-white/10 rounded px-2 py-1.5 text-white text-xs"
                      >
                        <option value="">—</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {isRTL ? u.name_ar || u.name_en : u.name_en}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-end">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unit_price_excl_vat || ""}
                        onChange={(e) => updateLine(idx, { unit_price_excl_vat: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#0e1117] border border-white/10 rounded px-2 py-1.5 text-white text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-end">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={line.vat_rate ?? ""}
                        onChange={(e) => updateLine(idx, { vat_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#0e1117] border border-white/10 rounded px-2 py-1.5 text-white text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-end font-mono text-emerald-400 whitespace-nowrap">
                      {fmtNum(lineTotalIncl(line))}
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeLine(idx)} className="p-1.5 rounded text-red-400 hover:bg-red-500/20">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer totals */}
          <div className="border-t border-white/10 px-4 py-4 flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-6">
              <span className="text-gray-400">{T("المجموع بدون ضريبة:", "Subtotal (excl. VAT):")}</span>
              <span className="font-mono text-white">{fmtNum(subtotalExcl)}</span>
            </div>
            <div className="flex gap-6">
              <span className="text-gray-400">{T("إجمالي الضريبة:", "Total VAT:")}</span>
              <span className="font-mono text-white">{fmtNum(totalVat)}</span>
            </div>
            <div className="flex gap-6 pt-2 border-t border-white/10">
              <span className="text-gray-300 font-semibold">{T("الإجمالي الكلي:", "Grand total:")}</span>
              <span className="font-mono text-lg font-bold text-emerald-400">{fmtNum(grandTotal)}</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
