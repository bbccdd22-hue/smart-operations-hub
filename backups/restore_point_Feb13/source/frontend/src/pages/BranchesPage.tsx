import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  fetchBranches,
  fetchBrands,
  fetchCities,
  createBranch,
  updateBranch,
  deleteBranch,
  branchDisplayName,
  type Brand,
  type Branch,
  type City,
} from "../lib/api";
import AddBranchModal from "../components/AddBranchModal";

export default function BranchesPage() {
  const { t, i18n } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadBranches = () => {
    setLoading(true);
    fetchBranches()
      .then(setBranches)
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBranches();
    fetchBrands().then(setBrands);
    fetchCities().then(setCities);
  }, []);

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingBranch(null);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`${t("delete")} ${name}?`)) return;
    setDeletingId(id);
    try {
      await deleteBranch(id);
      setBranches((prev) => prev.filter((b) => b.id !== id));
    } catch {
      // Error could be shown via toast
    } finally {
      setDeletingId(null);
    }
  };

  const lang = i18n.language;

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/admin-hub" className="text-sm text-white/70 hover:text-white">
            ← {t("adminDashboard")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">{t("branches")}</h1>
          <p className="mt-1 text-sm text-white/60">{t("branchesSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingBranch(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-[#6d28d9]"
        >
          <span>+</span>
          {t("addBranch")}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card overflow-hidden rounded-xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] table-fixed text-sm" dir="rtl">
            <thead>
              <tr className="glass-table-header border-b">
                <th className="w-24 shrink-0 px-4 py-3 text-right font-semibold text-white/90">
                  {t("actions")}
                </th>
                <th className="min-w-[5rem] px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "كود الفرع" : "Branch Code"}
                </th>
                <th className="min-w-[10rem] px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "الاسم" : t("name")}
                </th>
                <th className="min-w-[6rem] px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "العلامة" : t("brand")}
                </th>
                <th className="min-w-[6rem] px-4 py-3 text-right font-semibold text-white/90">
                  {lang === "ar" ? "المدينة" : t("city")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-white/60">
                    Loading…
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-white/60">
                    No branches found
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-white/5 transition hover:bg-white/5"
                  >
                    <td className="w-24 shrink-0 px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBranch(b);
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
                          onClick={() => handleDelete(b.id, branchDisplayName(b, lang))}
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
                    <td className="min-w-[5rem] px-4 py-3 text-right font-mono text-white/90">
                      {b.branch_code ?? "—"}
                    </td>
                    <td className="min-w-[10rem] px-4 py-3 text-right font-medium text-white/95">
                      {branchDisplayName(b, lang)}
                    </td>
                    <td className="min-w-[6rem] px-4 py-3 text-right text-white/70">
                      {b.brand?.name ?? "—"}
                    </td>
                    <td className="min-w-[6rem] px-4 py-3 text-right text-white/70">
                      {(lang === "ar" ? b.city?.name_ar : b.city?.name_en) ||
                        b.city?.name_en ||
                        b.city?.name_ar ||
                        "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AddBranchModal
        open={modalOpen}
        onClose={handleModalClose}
        onSuccess={loadBranches}
        editingBranch={editingBranch}
        brands={brands}
        cities={cities}
        createBranch={createBranch}
        updateBranch={updateBranch}
      />
    </div>
  );
}
