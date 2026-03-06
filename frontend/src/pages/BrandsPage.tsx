import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  fetchBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  type Brand,
} from "../lib/api";
import { dispatchOrgsChanged } from "../contexts/OrgsContext";
import { getBrandDisplayName } from "../lib/localization";
import AddBrandModal from "../components/AddBrandModal";

export default function BrandsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadBrands = () => {
    setLoading(true);
    fetchBrands()
      .then((r) => setBrands(Array.isArray(r) ? r : []))
      .catch(() => setBrands([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBrands();
  }, []);

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingBrand(null);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`${t("delete")} ${name}?`)) return;
    setDeletingId(id);
    try {
      await deleteBrand(id);
      setBrands((prev) => prev.filter((b) => b.id !== id));
      dispatchOrgsChanged();
    } catch {
      // Error could be shown via toast
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/admin-hub" className="text-sm text-white/70 hover:text-white">
            ← {t("adminDashboard")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">{t("brands")}</h1>
          <p className="mt-1 text-sm text-white/60">{t("brandsSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingBrand(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-[#6d28d9]"
        >
          <span>+</span>
          {t("addBrand")}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card overflow-hidden rounded-xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] table-fixed text-sm" dir="rtl">
            <thead>
              <tr className="glass-table-header border-b">
                <th className="w-24 shrink-0 px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "إجراءات" : t("actions")}
                </th>
                <th className="min-w-[8rem] px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "الاسم" : t("name")}
                </th>
                <th className="min-w-[6rem] px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "الرابط الدائم" : "Slug"}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-white/60">
                      Loading…
                    </td>
                  </tr>
                ) : brands.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-white/60">
                    No brands found
                  </td>
                </tr>
              ) : (
                (Array.isArray(brands) ? brands : []).map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-white/5 transition hover:bg-white/5"
                  >
                    <td className="w-24 shrink-0 px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBrand(b);
                            setModalOpen(true);
                          }}
                          className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                          title={t("edit")}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(b.id, getBrandDisplayName(b, lang))}
                          disabled={deletingId === b.id}
                          className="rounded-lg p-2 text-white/60 transition hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-50"
                          title={t("delete")}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="min-w-[8rem] px-4 py-3 text-right font-medium text-white/95">
                      {getBrandDisplayName(b, lang)}
                    </td>
                    <td className="min-w-[6rem] px-4 py-3 text-right text-white/70">
                      {b.slug}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AddBrandModal
        open={modalOpen}
        onClose={handleModalClose}
        onSuccess={() => { loadBrands(); dispatchOrgsChanged(); }}
        editingBrand={editingBrand}
        createBrand={createBrand}
        updateBrand={updateBrand}
      />
    </div>
  );
}
