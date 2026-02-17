import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import type { Brand, Branch, City } from "../lib/api";

type BranchEdit = Branch | null;

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingBranch: BranchEdit;
  brands: Brand[];
  cities: City[];
  createBranch: (p: {
    brand_id: number;
    city_id: number;
    name: string;
    name_ar?: string;
    code?: string;
    branch_code?: string;
  }) => Promise<unknown>;
  updateBranch: (
    id: number,
    p: Partial<{ name: string; name_ar: string; brand_id: number; city_id: number; branch_code: string }>
  ) => Promise<unknown>;
};

export default function AddBranchModal({
  open,
  onClose,
  onSuccess,
  editingBranch,
  brands,
  cities,
  createBranch,
  updateBranch,
}: Props) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [brandId, setBrandId] = useState<number | "">("");
  const [cityId, setCityId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lang = i18n.language;
  const isEdit = !!editingBranch;

  useEffect(() => {
    if (open) {
      if (editingBranch) {
        setName(editingBranch.name);
        setNameAr((editingBranch as { name_ar?: string }).name_ar ?? "");
        setBranchCode((editingBranch as { branch_code?: string }).branch_code ?? "");
        setBrandId(editingBranch.brand?.id ?? "");
        setCityId(editingBranch.city?.id ?? "");
      } else {
        setName("");
        setNameAr("");
        setBranchCode("");
        setBrandId("");
        setCityId("");
      }
      setError(null);
    }
  }, [open, editingBranch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !cityId || !name.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && editingBranch) {
        await updateBranch(editingBranch.id, {
          name: name.trim(),
          name_ar: nameAr.trim() || name.trim(),
          brand_id: Number(brandId),
          city_id: Number(cityId),
          branch_code: branchCode.trim() || undefined,
        });
      } else {
        await createBranch({
          brand_id: Number(brandId),
          city_id: Number(cityId),
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          branch_code: branchCode.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branch");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-6"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {isEdit ? t("edit") + " " + t("branches") : t("addBranch")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm text-rose-200">{error}</div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("brand")} *</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : "")}
                required
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
              >
                <option value="">{t("selectBrand")}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("city")} *</label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : "")}
                required
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
              >
                <option value="">Select city</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {lang === "ar" && c.name_ar ? c.name_ar : c.name_en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("name")} *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="e.g. Al-Roseifa"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t("name")} (AR)</label>
              <input
                type="text"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="اختياري"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">Branch Code</label>
              <input
                type="text"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder="e.g. B30, B34"
              />
              <p className="mt-1 text-xs text-white/50">Unique code for Excel mapping (كود الفرع)</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="glass-btn flex-1 rounded-xl py-2.5 font-medium text-white/80"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim() || !brandId || !cityId}
                className="flex-1 rounded-xl bg-[#7c3aed] py-2.5 font-medium text-white transition hover:bg-[#6d28d9] disabled:opacity-50"
              >
                {submitting ? "…" : t("save")}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
