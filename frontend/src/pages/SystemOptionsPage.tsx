/**
 * System Settings – Master Data: Cities, Districts, Branch Types.
 * Aqua Glass cards, Edit/Delete, unique codes (CITY-001, etc).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchCities,
  fetchDistricts,
  fetchBranchTypes,
  createCity,
  createDistrict,
  createBranchType,
  updateCity,
  updateDistrict,
  updateBranchType,
  deleteCity,
  deleteDistrict,
  deleteBranchType,
  clearAllCities,
  type City,
  type District,
  type BranchType,
} from "../lib/api";
import SearchableSelect from "../components/SearchableSelect";

type Tab = "cities" | "districts" | "branch_types";

export default function SystemOptionsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [tab, setTab] = useState<Tab>("cities");
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [branchTypes, setBranchTypes] = useState<BranchType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCityEn, setNewCityEn] = useState("");
  const [newCityAr, setNewCityAr] = useState("");
  const [clearingCities, setClearingCities] = useState(false);
  const [newDistrictCityId, setNewDistrictCityId] = useState<number | "">("");
  const [newDistrictEn, setNewDistrictEn] = useState("");
  const [newDistrictAr, setNewDistrictAr] = useState("");
  const [newTypeEn, setNewTypeEn] = useState("");
  const [newTypeAr, setNewTypeAr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<{ type: Tab; id: number } | null>(null);
  const [editEn, setEditEn] = useState("");
  const [editAr, setEditAr] = useState("");
  const [editCityId, setEditCityId] = useState<number | "">("");

  const loadAll = () => {
    setLoading(true);
    Promise.all([fetchCities(), fetchDistricts(), fetchBranchTypes()]).then(
      ([c, d, bt]) => {
        setCities(c);
        setDistricts(d);
        setBranchTypes(bt);
      }
    ).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityEn.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await createCity({ name_en: newCityEn.trim(), name_ar: newCityAr.trim() });
      setNewCityEn("");
      setNewCityAr("");
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setNewCityEn("");
      setNewCityAr("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearCities = async () => {
    if (!confirm(isRTL ? "حذف جميع المدن والأحياء؟ لا يمكن التراجع." : "Delete all cities and districts? This cannot be undone."))
      return;
    setError(null);
    setClearingCities(true);
    try {
      const { deleted_cities, deleted_districts } = await clearAllCities();
      setSuccessMessage(
        isRTL
          ? `تم حذف ${deleted_cities} مدينة و ${deleted_districts} حي`
          : `Deleted ${deleted_cities} city(ies) and ${deleted_districts} district(s)`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setClearingCities(false);
    }
  };

  const handleAddDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDistrictCityId || !newDistrictEn.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await createDistrict({
        city_id: Number(newDistrictCityId),
        name_en: newDistrictEn.trim(),
        name_ar: newDistrictAr.trim(),
      });
      setNewDistrictCityId("");
      setNewDistrictEn("");
      setNewDistrictAr("");
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBranchType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeEn.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await createBranchType({ name_en: newTypeEn.trim(), name_ar: newTypeAr.trim() });
      setNewTypeEn("");
      setNewTypeAr("");
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (type: Tab, id: number, en: string, ar: string, cityId?: number) => {
    setEditingId({ type, id });
    setEditEn(en);
    setEditAr(ar || "");
    if (type === "districts" && cityId) setEditCityId(cityId);
    else setEditCityId("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setError(null);
    setSubmitting(true);
    try {
      if (editingId.type === "cities") {
        await updateCity(editingId.id, { name_en: editEn.trim(), name_ar: editAr.trim() });
      } else if (editingId.type === "districts") {
        await updateDistrict(editingId.id, {
          name_en: editEn.trim(),
          name_ar: editAr.trim(),
          ...(editCityId ? { city_id: Number(editCityId) } : {}),
        });
      } else {
        await updateBranchType(editingId.id, { name_en: editEn.trim(), name_ar: editAr.trim() });
      }
      setEditingId(null);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (type: Tab, id: number) => {
    if (!confirm(isRTL ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) return;
    setError(null);
    setSubmitting(true);
    try {
      if (type === "cities") await deleteCity(id);
      else if (type === "districts") await deleteDistrict(id);
      else await deleteBranchType(id);
      setEditingId(null);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const cardClass = "aqua-glass-card overflow-hidden rounded-2xl p-6";
  const inputClass =
    "rounded-xl border border-slate-200/60 bg-white/50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <div
      className="min-h-[calc(100vh-8rem)]"
      style={{ fontFamily: "Inter, Lexend, Tajawal, system-ui, sans-serif" }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/admin-hub"
            className="text-sm text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            ← {t("adminDashboard")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-800 dark:text-white">
            {isRTL ? "إعدادات النظام" : "System Settings"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "البيانات المرجعية: المدن، الأحياء، أنواع الفروع" : "Master Data: Cities, Districts, Branch Types"}
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(["cities", "districts", "branch_types"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
            }`}
          >
            {t === "cities" && (isRTL ? "المدن" : "Cities")}
            {t === "districts" && (isRTL ? "الأحياء" : "Districts")}
            {t === "branch_types" && (isRTL ? "أنواع الفروع" : "Branch Types")}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-500/20 px-4 py-2 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          ✓ {successMessage}
        </div>
      )}
      {tab === "cities" && cities.length === 0 && !loading && !successMessage && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          ✓ {isRTL ? "قائمة المدن فارغة. المدينة التالية ستكون CITY-01." : "Cities list is empty. Next city will be CITY-01."}
        </div>
      )}

      {loading ? (
        <div className={cardClass}>
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">{isRTL ? "جاري التحميل…" : "Loading…"}</p>
        </div>
      ) : (
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {tab === "cities" && (
            <div className={cardClass}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {isRTL ? "المدن" : "Cities"} ({cities.length})
                </h2>
                {cities.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(isRTL ? "حذف جميع المدن والأحياء؟ لا يمكن التراجع." : "Delete ALL cities and districts? This cannot be undone.")) return;
                      setError(null);
                      setSubmitting(true);
                      try {
                        const res = await clearAllCities();
                        loadAll();
                        setError(null);
                        setSuccessMessage(res ? `${res.deleted_cities} ${isRTL ? "مدن" : "cities"}, ${res.deleted_districts} ${isRTL ? "أحياء" : "districts"} ${isRTL ? "محذوفة" : "deleted"}` : (isRTL ? "تم المسح." : "Cleared."));
                        setTimeout(() => setSuccessMessage(null), 6000);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to clear");
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting}
                    className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/30 disabled:opacity-50"
                  >
                    {isRTL ? "مسح الكل" : "Clear All"}
                  </button>
                )}
              </div>
              <form onSubmit={handleAddCity} className="mb-6 flex flex-wrap gap-3">
                <input
                  type="text"
                  value={newCityEn}
                  onChange={(e) => setNewCityEn(e.target.value)}
                  placeholder={isRTL ? "الاسم (إنجليزي)" : "Name (EN)"}
                  className={inputClass}
                />
                <input
                  type="text"
                  value={newCityAr}
                  onChange={(e) => setNewCityAr(e.target.value)}
                  placeholder={isRTL ? "الاسم (عربي)" : "Name (AR)"}
                  dir="rtl"
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={submitting || !newCityEn.trim()}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  + {isRTL ? "إضافة مدينة" : "Add City"}
                </button>
                {cities.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCities}
                    disabled={clearingCities}
                    className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                  >
                    {clearingCities ? "…" : isRTL ? "🗑 حذف الكل" : "🗑 Clear All"}
                  </button>
                )}
              </form>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" dir={isRTL ? "rtl" : "ltr"}>
                  <thead>
                    <tr
                      className="border-b border-slate-200/60 dark:border-white/10"
                      style={{ background: "rgba(16, 185, 129, 0.06)" }}
                    >
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isRTL ? "الرمز" : "Code"}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isRTL ? "الاسم (EN)" : "Name (EN)"}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isRTL ? "الاسم (عربي)" : "Name (AR)"}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300 w-24">
                        {isRTL ? "إجراءات" : "Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cities.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100/80 dark:border-white/5">
                        <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400">
                          {c.option_code || "—"}
                        </td>
                        {editingId?.type === "cities" && editingId.id === c.id ? (
                          <>
                            <td>
                              <input
                                value={editEn}
                                onChange={(e) => setEditEn(e.target.value)}
                                className={`${inputClass} w-32`}
                              />
                            </td>
                            <td>
                              <input
                                value={editAr}
                                onChange={(e) => setEditAr(e.target.value)}
                                dir="rtl"
                                className={`${inputClass} w-32`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={submitting}
                                className="mr-1 rounded-lg bg-emerald-500 px-2 py-1 text-xs text-white"
                              >
                                {isRTL ? "حفظ" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-lg bg-slate-200 px-2 py-1 text-xs dark:bg-white/10"
                              >
                                {t("cancel")}
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{c.name_en}</td>
                            <td className="px-4 py-3" dir="rtl">
                              {c.name_ar || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => handleEdit("cities", c.id, c.name_en, c.name_ar || "")}
                                className="rounded-lg px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                              >
                                {t("edit")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete("cities", c.id)}
                                disabled={submitting}
                                className="ml-1 rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                              >
                                {t("delete")}
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "districts" && (
            <div className={cardClass}>
              <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-white">
                {isRTL ? "الأحياء" : "Districts"} ({districts.length})
              </h2>
              <form onSubmit={handleAddDistrict} className="mb-6 flex flex-wrap gap-3 items-end">
                <div className="min-w-[200px]">
                  <SearchableSelect
                    label={isRTL ? "المدينة" : "City"}
                    labelAr="المدينة"
                    value={newDistrictCityId}
                    options={cities.map((c) => ({
                      id: c.id,
                      label: c.name_en,
                      labelAr: c.name_ar,
                    }))}
                    onChange={setNewDistrictCityId}
                    placeholder={isRTL ? "اختر المدينة" : "Select City"}
                    required
                    allowNone={false}
                  />
                </div>
                <input
                  type="text"
                  value={newDistrictEn}
                  onChange={(e) => setNewDistrictEn(e.target.value)}
                  placeholder={isRTL ? "الحي (إنجليزي)" : "District (EN)"}
                  className={inputClass}
                />
                <input
                  type="text"
                  value={newDistrictAr}
                  onChange={(e) => setNewDistrictAr(e.target.value)}
                  placeholder={isRTL ? "الحي (عربي)" : "District (AR)"}
                  dir="rtl"
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={submitting || !newDistrictCityId || !newDistrictEn.trim()}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  + {isRTL ? "إضافة حي" : "Add District"}
                </button>
              </form>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" dir={isRTL ? "rtl" : "ltr"}>
                  <thead>
                    <tr
                      className="border-b border-slate-200/60 dark:border-white/10"
                      style={{ background: "rgba(16, 185, 129, 0.06)" }}
                    >
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isRTL ? "الرمز" : "Code"}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isRTL ? "المدينة" : "City"}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isRTL ? "الاسم (EN)" : "Name (EN)"}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isRTL ? "الاسم (عربي)" : "Name (AR)"}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300 w-24">
                        {isRTL ? "إجراءات" : "Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {districts.map((d) => {
                      const city = cities.find((c) => c.id === d.city);
                      return (
                        <tr key={d.id} className="border-b border-slate-100/80 dark:border-white/5">
                          <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400">
                            {d.option_code || "—"}
                          </td>
                          {editingId?.type === "districts" && editingId.id === d.id ? (
                            <>
                              <td>
                                <select
                                  value={editCityId}
                                  onChange={(e) => setEditCityId(e.target.value ? Number(e.target.value) : "")}
                                  className={inputClass}
                                >
                                  {cities.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {isRTL && c.name_ar ? c.name_ar : c.name_en}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  value={editEn}
                                  onChange={(e) => setEditEn(e.target.value)}
                                  className={`${inputClass} w-32`}
                                />
                              </td>
                              <td>
                                <input
                                  value={editAr}
                                  onChange={(e) => setEditAr(e.target.value)}
                                  dir="rtl"
                                  className={`${inputClass} w-32`}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={handleSaveEdit}
                                  disabled={submitting}
                                  className="mr-1 rounded-lg bg-emerald-500 px-2 py-1 text-xs text-white"
                                >
                                  {isRTL ? "حفظ" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="rounded-lg bg-slate-200 px-2 py-1 text-xs dark:bg-white/10"
                                >
                                  {t("cancel")}
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3">
                                {isRTL ? d.city_name_ar : d.city_name_en || city?.name_en || "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{d.name_en}</td>
                              <td className="px-4 py-3" dir="rtl">
                                {d.name_ar || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cid = typeof d.city === "object" && d.city ? (d.city as { id: number }).id : d.city;
                                    handleEdit("districts", d.id, d.name_en, d.name_ar || "", cid);
                                  }}
                                  className="rounded-lg px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                                >
                                  {t("edit")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete("districts", d.id)}
                                  disabled={submitting}
                                  className="ml-1 rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                                >
                                  {t("delete")}
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "branch_types" && (
            <div className={cardClass}>
              <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-white">
                {isRTL ? "أنواع الفروع" : "Branch Types"} ({branchTypes.length})
              </h2>
              <form onSubmit={handleAddBranchType} className="mb-6 flex flex-wrap gap-3">
                <input
                  type="text"
                  value={newTypeEn}
                  onChange={(e) => setNewTypeEn(e.target.value)}
                  placeholder={isRTL ? "مثال: فرع، كشك" : "e.g. Branch, Kiosk"}
                  className={inputClass}
                />
                <input
                  type="text"
                  value={newTypeAr}
                  onChange={(e) => setNewTypeAr(e.target.value)}
                  placeholder={isRTL ? "فرع، كشك" : "Branch, Kiosk"}
                  dir="rtl"
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={submitting || !newTypeEn.trim()}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  + {isRTL ? "إضافة نوع" : "Add Type"}
                </button>
              </form>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" dir={isRTL ? "rtl" : "ltr"}>
                  <thead>
                    <tr
                      className="border-b border-slate-200/60 dark:border-white/10"
                      style={{ background: "rgba(16, 185, 129, 0.06)" }}
                    >
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isRTL ? "الرمز" : "Code"}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isRTL ? "الاسم (EN)" : "Name (EN)"}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">
                        {isRTL ? "الاسم (عربي)" : "Name (AR)"}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300 w-24">
                        {isRTL ? "إجراءات" : "Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchTypes.map((bt) => (
                      <tr key={bt.id} className="border-b border-slate-100/80 dark:border-white/5">
                        <td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-400">
                          {bt.option_code || "—"}
                        </td>
                        {editingId?.type === "branch_types" && editingId.id === bt.id ? (
                          <>
                            <td>
                              <input
                                value={editEn}
                                onChange={(e) => setEditEn(e.target.value)}
                                className={`${inputClass} w-32`}
                              />
                            </td>
                            <td>
                              <input
                                value={editAr}
                                onChange={(e) => setEditAr(e.target.value)}
                                dir="rtl"
                                className={`${inputClass} w-32`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={submitting}
                                className="mr-1 rounded-lg bg-emerald-500 px-2 py-1 text-xs text-white"
                              >
                                {isRTL ? "حفظ" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-lg bg-slate-200 px-2 py-1 text-xs dark:bg-white/10"
                              >
                                {t("cancel")}
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{bt.name_en}</td>
                            <td className="px-4 py-3" dir="rtl">
                              {bt.name_ar || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => handleEdit("branch_types", bt.id, bt.name_en, bt.name_ar || "")}
                                className="rounded-lg px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                              >
                                {t("edit")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete("branch_types", bt.id)}
                                disabled={submitting}
                                className="ml-1 rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                              >
                                {t("delete")}
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
