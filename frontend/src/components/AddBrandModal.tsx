import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

type BrandEdit = { id: number; name: string; name_ar?: string; slug: string; brand_code?: string } | null;

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingBrand: BrandEdit;
  createBrand: (p: { name: string; name_ar?: string; brand_code?: string }) => Promise<unknown>;
  updateBrand: (id: number, payload: Partial<{ name: string; name_ar: string; brand_code: string }>) => Promise<unknown>;
};

export default function AddBrandModal({
  open,
  onClose,
  onSuccess,
  editingBrand,
  createBrand,
  updateBrand,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [brandCode, setBrandCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editingBrand;

  useEffect(() => {
    if (open) {
      const b = editingBrand as { name?: string; name_ar?: string; brand_code?: string } | null;
      setNameEn(b?.name ?? "");
      setNameAr(b?.name_ar ?? "");
      setBrandCode(b?.brand_code ?? "");
      setError(null);
    }
  }, [open, editingBrand]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && editingBrand) {
        await updateBrand(editingBrand.id, {
          name: nameEn.trim(),
          name_ar: nameAr.trim() || nameEn.trim(),
          brand_code: brandCode.trim() || "",
        });
      } else {
        await createBrand({
          name: nameEn.trim(),
          name_ar: nameAr.trim() || nameEn.trim(),
          brand_code: brandCode.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save brand");
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
          className="glass-card relative w-full max-w-md rounded-2xl p-6"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {isEdit ? t("edit") + " " + t("brands") : t("addBrand")}
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
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {lang === "ar" ? "الاسم بالإنجليزية" : "Name (English)"} *
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                required
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder={lang === "ar" ? "مثال: 8OZ" : "e.g. 8OZ"}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {lang === "ar" ? "الاسم بالعربية" : "Name (Arabic)"}
              </label>
              <input
                type="text"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder={lang === "ar" ? "مثال: هيمي" : "e.g. هيمي"}
              />
            </div>

            <details className="rounded-lg border border-white/10">
              <summary className="cursor-pointer px-3 py-2 text-xs text-white/60">
                {lang === "ar" ? "إعدادات النظام (للمطابقة البرمجية فقط)" : "System settings (for matching only)"}
              </summary>
              <div className="border-t border-white/10 p-3">
                <label className="mb-1.5 block text-xs font-medium text-white/60">Brand Code</label>
                <input
                  type="text"
                  value={brandCode}
                  onChange={(e) => setBrandCode(e.target.value)}
                  className="glass-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="001"
                />
                <p className="mt-1 text-xs text-white/40">
                  {lang === "ar" ? "للمطابقة الداخلية فقط – لا يظهر للمستخدم" : "Internal matching only – not shown to users"}
                </p>
              </div>
            </details>

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
                disabled={submitting || !nameEn.trim()}
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
