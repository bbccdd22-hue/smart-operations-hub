import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchDistricts,
  fetchBranchTypes,
  type Brand,
  type Branch,
  type City,
  type District,
  type BranchType,
} from "../lib/api";
import SearchableSelect from "./SearchableSelect";

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
    district_id?: number | null;
    branch_type_id?: number | null;
    name: string;
    name_ar?: string;
    code?: string;
    branch_code?: string;
  }) => Promise<unknown>;
  updateBranch: (
    id: number,
    p: Partial<{
      name: string;
      name_ar: string;
      brand_id: number;
      city_id: number;
      district_id: number | null;
      branch_type_id: number | null;
      branch_code: string;
    }>
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
  const [districtId, setDistrictId] = useState<number | "">("");
  const [branchTypeId, setBranchTypeId] = useState<number | "">("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [branchTypes, setBranchTypes] = useState<BranchType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lang = i18n.language;
  const isEdit = !!editingBranch;

  useEffect(() => {
    if (open) {
      fetchBranchTypes().then(setBranchTypes);
    }
  }, [open]);

  useEffect(() => {
    if (cityId) {
      fetchDistricts(Number(cityId)).then(setDistricts);
    } else {
      setDistricts([]);
      setDistrictId("");
    }
  }, [cityId]);

  useEffect(() => {
    if (open) {
      if (editingBranch) {
        setName(editingBranch.name);
        setNameAr((editingBranch as { name_ar?: string }).name_ar ?? "");
        setBranchCode((editingBranch as { branch_code?: string }).branch_code ?? "");
        setBrandId(editingBranch.brand?.id ?? "");
        setCityId(editingBranch.city?.id ?? "");
        setDistrictId((editingBranch as { district?: { id: number } }).district?.id ?? "");
        setBranchTypeId((editingBranch as { branch_type?: { id: number } }).branch_type?.id ?? "");
      } else {
        setName("");
        setNameAr("");
        setBranchCode("");
        setBrandId("");
        setCityId("");
        setDistrictId("");
        setBranchTypeId("");
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
          district_id: districtId ? Number(districtId) : null,
          branch_type_id: branchTypeId ? Number(branchTypeId) : null,
          branch_code: branchCode.trim() || undefined,
        });
      } else {
        await createBranch({
          brand_id: Number(brandId),
          city_id: Number(cityId),
          district_id: districtId ? Number(districtId) : null,
          branch_type_id: branchTypeId ? Number(branchTypeId) : null,
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

            <SearchableSelect
              label={t("brand")}
              labelAr="العلامة التجارية"
              value={brandId}
              options={brands.map((b) => ({
                id: b.id,
                label: b.name ?? "",
                labelAr: (b as { name_ar?: string }).name_ar ?? "",
              }))}
              onChange={setBrandId}
              placeholder={lang === "ar" ? "اختر العلامة التجارية" : t("selectBrand")}
              required
              allowNone={false}
            />

            <SearchableSelect
              label={t("city")}
              labelAr="المدينة"
              value={cityId}
              options={cities.map((c) => ({
                id: c.id,
                label: c.name_en,
                labelAr: c.name_ar,
              }))}
              onChange={setCityId}
              placeholder={lang === "ar" ? "اختر المدينة" : "Select city"}
              required
              allowNone={false}
            />

            <SearchableSelect
              label={lang === "ar" ? "الحي" : "District"}
              labelAr="الحي"
              value={districtId}
              options={districts.map((d) => ({
                id: d.id,
                label: d.name_en,
                labelAr: d.name_ar,
              }))}
              onChange={setDistrictId}
              placeholder={lang === "ar" ? "اختر الحي (حسب المدينة)" : "Select district (by city)"}
              disabled={!cityId}
            />

            <SearchableSelect
              label={lang === "ar" ? "نوع الفرع" : "Branch Type"}
              labelAr="نوع الفرع"
              value={branchTypeId}
              options={branchTypes.map((b) => ({
                id: b.id,
                label: b.name_en,
                labelAr: b.name_ar,
              }))}
              onChange={setBranchTypeId}
              placeholder={lang === "ar" ? "فرع / كشك" : "Branch / Kiosk"}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {lang === "ar" ? "الاسم بالإنجليزية" : "Name (English)"} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="glass-input w-full rounded-xl px-4 py-2.5 text-white"
                placeholder={lang === "ar" ? "مثال: Al-Roseifa" : "e.g. Al-Roseifa"}
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
                placeholder={lang === "ar" ? "اختياري" : "Optional"}
              />
            </div>

            <details className="rounded-lg border border-white/10">
              <summary className="cursor-pointer px-3 py-2 text-xs text-white/60">
                {lang === "ar" ? "إعدادات النظام (للمطابقة البرمجية فقط)" : "System settings (for matching only)"}
              </summary>
              <div className="border-t border-white/10 p-3">
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  {lang === "ar" ? "كود الفرع" : "Branch Code"}
                </label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  className="glass-input w-full rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="B30, B34"
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
