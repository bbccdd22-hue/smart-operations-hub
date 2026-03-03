/**
 * إدخال الموردين — Suppliers List & Entry
 * قائمة الموردين مع إضافة وتعديل وحذف.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Users, Plus, Pencil, Trash2, Search, RefreshCw, X, Save,
  Mail, FileText,
} from "lucide-react";
import { fetchWithCsrf } from "../../lib/api";
import { fetchBrands, type Brand } from "../../lib/api";

interface Supplier {
  id: number;
  brand: number;
  brand_name: string;
  brand_slug: string;
  name: string;
  name_ar: string;
  tax_number: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  credit_days: number;
  payment_terms: string;
  is_active: boolean;
  created_at?: string;
}

const fmt = (v: string | number) =>
  typeof v === "number" ? v.toLocaleString("ar-SA") : (v || "—");

export default function SuppliersPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const T = (ar: string, en: string) => (isRTL ? ar : en);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Supplier>>({
    name: "",
    name_ar: "",
    tax_number: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    credit_days: 0,
    payment_terms: "",
    is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (brandFilter) params.set("brand_id", brandFilter);
      if (search) params.set("search", search);
      const res = await fetchWithCsrf(`/api/procurement/suppliers/?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : data.results || data.suppliers || []);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [brandFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchBrands().then((r) => setBrands(Array.isArray(r) ? r : [])).catch(() => setBrands([]));
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      brand: brands[0]?.id,
      name: "",
      name_ar: "",
      tax_number: "",
      contact_email: "",
      contact_phone: "",
      address: "",
      credit_days: 0,
      payment_terms: "",
      is_active: true,
    });
    setModalOpen(true);
    setSaveError(null);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      brand: s.brand,
      name: s.name,
      name_ar: s.name_ar || "",
      tax_number: s.tax_number || "",
      contact_email: s.contact_email || "",
      contact_phone: s.contact_phone || "",
      address: s.address || "",
      credit_days: s.credit_days || 0,
      payment_terms: s.payment_terms || "",
      is_active: s.is_active ?? true,
    });
    setModalOpen(true);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        brand: form.brand || (brands[0]?.id),
        name: form.name.trim(),
        name_ar: (form.name_ar || "").trim(),
        tax_number: (form.tax_number || "").trim(),
        contact_email: (form.contact_email || "").trim(),
        contact_phone: (form.contact_phone || "").trim(),
        address: (form.address || "").trim(),
        credit_days: parseInt(String(form.credit_days), 10) || 0,
        payment_terms: (form.payment_terms || "").trim(),
        is_active: form.is_active ?? true,
      };
      if (editing) {
        const res = await fetchWithCsrf(`/api/procurement/suppliers/${editing.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.detail || "فشل التحديث");
        }
      } else {
        const res = await fetchWithCsrf("/api/procurement/suppliers/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.detail || "فشل الإضافة");
        }
      }
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(T("هل تريد حذف هذا المورد؟", "Delete this supplier?"))) return;
    try {
      await fetchWithCsrf(`/api/procurement/suppliers/${id}/`, { method: "DELETE" });
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-[#0e1117] text-white" dir={isRTL ? "rtl" : "ltr"}>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0e1117] border-b border-white/10 px-4 md:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
              <Users className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{T("إدخال الموردين", "Suppliers")}</h1>
              <p className="text-xs text-gray-400">{T("إدارة سجل الموردين", "Manage supplier records")}</p>
            </div>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-colors">
            <Plus className="h-4 w-4" /> {T("إضافة مورد", "Add Supplier")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={T("ابحث بالاسم أو الهاتف...", "Search by name or phone...")}
              className="w-full bg-[#161b27] border border-white/10 rounded-lg py-2 px-3 ps-8 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
          </div>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
            className="bg-[#161b27] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500">
            <option value="">{T("جميع العلامات", "All Brands")}</option>
            {(Array.isArray(brands) ? brands : []).map((b) => (
              <option key={b.id} value={b.id}>{isRTL ? (b.name_ar || b.name) : b.name}</option>
            ))}
          </select>
          <button onClick={load} className="p-2 rounded-lg bg-[#161b27] border border-white/10 text-gray-400 hover:text-white">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 md:px-6 py-4">
        <div className="bg-[#161b27] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{T("لا يوجد موردين", "No suppliers")}</p>
              <button onClick={openAdd} className="mt-3 text-amber-400 hover:text-amber-300 text-sm">
                {T("إضافة أول مورد", "Add first supplier")}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 640 }}>
                <thead>
                  <tr className="bg-[#1e2533] text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 text-start">{T("الاسم", "Name")}</th>
                    <th className="px-4 py-3 text-start hidden md:table-cell">{T("الهاتف", "Phone")}</th>
                    <th className="px-4 py-3 text-start hidden md:table-cell">{T("العلامة", "Brand")}</th>
                    <th className="px-4 py-3 text-center">{T("أيام الائتمان", "Credit Days")}</th>
                    <th className="px-4 py-3 text-center w-24">{T("إجراءات", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(suppliers) ? suppliers : []).map((s) => (
                    <tr key={s.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-white">{isRTL ? (s.name_ar || s.name) : s.name}</span>
                          {s.contact_email && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3" /> {s.contact_email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-400">{s.contact_phone || "—"}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs bg-[#1e2533] text-gray-400 px-2 py-0.5 rounded">{s.brand_name}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-amber-400">{s.credit_days}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <Link to={`/suppliers/statement/${s.id}`} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10" title={T("كشف حساب", "Statement")}>
                            <FileText className="h-3.5 w-3.5" />
                          </Link>
                          <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-semibold">{editing ? T("تعديل المورد", "Edit Supplier") : T("إضافة مورد", "Add Supplier")}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!editing && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{T("العلامة", "Brand")}</label>
                  <select value={form.brand || ""} onChange={(e) => setForm((p) => ({ ...p, brand: parseInt(e.target.value, 10) }))}
                    className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white">
                    {(Array.isArray(brands) ? brands : []).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{T("الاسم (إنجليزي)", "Name (EN)")}</label>
                  <input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white" placeholder="Supplier Name" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{T("الاسم (عربي)", "Name (AR)")}</label>
                  <input value={form.name_ar || ""} onChange={(e) => setForm((p) => ({ ...p, name_ar: e.target.value }))}
                    className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white" dir="rtl" placeholder="اسم المورد" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{T("الهاتف", "Phone")}</label>
                  <input value={form.contact_phone || ""} onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
                    className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{T("البريد", "Email")}</label>
                  <input type="email" value={form.contact_email || ""} onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
                    className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T("الرقم الضريبي", "Tax Number")}</label>
                <input value={form.tax_number || ""} onChange={(e) => setForm((p) => ({ ...p, tax_number: e.target.value }))}
                  className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T("أيام الائتمان", "Credit Days")}</label>
                <input type="number" min="0" value={form.credit_days ?? 0} onChange={(e) => setForm((p) => ({ ...p, credit_days: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T("شروط الدفع", "Payment Terms")}</label>
                <input value={form.payment_terms || ""} onChange={(e) => setForm((p) => ({ ...p, payment_terms: e.target.value }))}
                  className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white" placeholder="نقدي | 30 يوم | 60 يوم" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{T("العنوان", "Address")}</label>
                <textarea value={form.address || ""} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  rows={2} className="w-full bg-[#0e1117] border border-white/15 rounded-xl px-3 py-2 text-sm text-white resize-none" />
              </div>
              {saveError && (
                <div className="text-red-400 text-sm">{saveError}</div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#0e1117] border border-white/10 text-gray-400 hover:text-white">
                {T("إلغاء", "Cancel")}
              </button>
              <button onClick={handleSave} disabled={saving || !form.name?.trim()}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 text-white font-medium flex items-center gap-2">
                <Save className="h-4 w-4" /> {saving ? T("جارٍ...", "Saving...") : T("حفظ", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
