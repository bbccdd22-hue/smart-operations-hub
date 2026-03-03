/**
 * Ingredient & Unit Management (IU1002/IU1003) – PR1002 context.
 * Route: /inventory/manage-ingredients
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { IU1002, IU1003, PR1002 } from "../lib/SystemCodes";
import { calculateWorkableUnits } from "../lib/calculateWorkableUnits";
import {
  fetchInventoryUnits,
  fetchIngredients,
  createIngredient,
  updateIngredient,
  type ManageIngredient,
  type InventoryUnit,
} from "../lib/api";

/** تحويل الأرقام العربية (٠١٢٣...) إلى إنجليزية (0123...) لقبول كلاهما */
function normalizeNumericInput(val: string): string {
  const arabicToWestern: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return val.split("").map((c) => arabicToWestern[c] ?? c).join("");
}

const SYSTEM_GROUPS = [
  { value: "", label: "All", labelAr: "الكل" },
  { value: "raw_materials", label: "Raw Materials", labelAr: "المواد الخام" },
  { value: "packaging", label: "Packaging", labelAr: "التعبئة" },
  { value: "other", label: "Other", labelAr: "أخرى" },
] as const;

export default function ManageIngredientsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSystemGroup = searchParams.get("system_group") ?? "";
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [ingredients, setIngredients] = useState<ManageIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemGroupFilter, setSystemGroupFilter] = useState(urlSystemGroup);
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name_en: "",
    name_ar: "",
    base_unit_id: 0,
    serial_code: "",
    system_group: "raw_materials",
    package_conversion_factor: "" as string | number,
    package_name_en: "",
    package_name_ar: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrimaryUnitWarning, setShowPrimaryUnitWarning] = useState(false);

  const loadIngredients = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchIngredients(systemGroupFilter || undefined);
      setIngredients(list);
    } finally {
      setLoading(false);
    }
  }, [systemGroupFilter]);

  useEffect(() => {
    setSystemGroupFilter(urlSystemGroup);
  }, [urlSystemGroup]);

  useEffect(() => {
    let cancelled = false;
    fetchInventoryUnits()
      .then((list) => {
        if (!cancelled) setUnits(list);
      })
      .catch(() => {
        if (!cancelled) setUnits([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchIngredients(systemGroupFilter || undefined)
      .then((list) => {
        if (!cancelled) setIngredients(list);
      })
      .catch(() => {
        if (!cancelled) setIngredients([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [systemGroupFilter]);

  const resetForm = () => {
    setForm({
      name_en: "",
      name_ar: "",
      base_unit_id: units[0]?.id ?? 0,
      serial_code: "",
      system_group: "raw_materials",
      package_conversion_factor: "",
      package_name_en: "",
      package_name_ar: "",
    });
    setEditingId(null);
    setFormOpen(false);
    setError(null);
  };

  const performSave = async (unitId: number) => {
    setSaving(true);
    setError(null);
    setShowPrimaryUnitWarning(false);
    try {
      if (editingId) {
        await updateIngredient(editingId, {
          name_en: form.name_en,
          name_ar: form.name_ar,
          base_unit_id: unitId,
          serial_code: form.serial_code,
          system_group: form.system_group,
          package_conversion_factor: form.package_conversion_factor
            ? Number(form.package_conversion_factor)
            : null,
          package_name_en: form.package_name_en,
          package_name_ar: form.package_name_ar,
        });
      } else {
        await createIngredient({
          name_en: form.name_en,
          name_ar: form.name_ar,
          base_unit_id: unitId,
          serial_code: form.serial_code || undefined,
          system_group: form.system_group,
          package_conversion_factor: form.package_conversion_factor
            ? Number(form.package_conversion_factor)
            : undefined,
          package_name_en: form.package_name_en || undefined,
          package_name_ar: form.package_name_ar || undefined,
        });
      }
      resetForm();
      loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const hasNoPrimaryUnit = !form.base_unit_id || form.base_unit_id === 0;
    const smallestUnit = units.length > 0 ? units[0] : null;
    if (hasNoPrimaryUnit && units.length > 0) {
      setShowPrimaryUnitWarning(true);
      setError(
        isRTL
          ? "يجب تحديد وحدة رئيسية لهذا الصنف لتجنب الخلل في التقارير"
          : "You must specify a primary unit for this item to avoid report errors"
      );
      return;
    }
    if (hasNoPrimaryUnit && !smallestUnit) {
      setError(isRTL ? "لا توجد وحدات. أضف وحدات أولاً." : "No units available. Add units first.");
      return;
    }
    const unitToUse = (form.base_unit_id || smallestUnit?.id) ?? 0;
    await performSave(unitToUse);
  };

  const handleSaveWithFallbackUnit = async () => {
    const smallestUnit = units.length > 0 ? units[0] : null;
    if (!smallestUnit) {
      setError(isRTL ? "لا توجد وحدات." : "No units available.");
      return;
    }
    await performSave(smallestUnit.id);
  };

  const startEdit = (ing: ManageIngredient) => {
    setForm({
      name_en: ing.name_en,
      name_ar: ing.name_ar,
      base_unit_id: ing.base_unit_id ?? 0,
      serial_code: ing.serial_code,
      system_group: ing.system_group,
      package_conversion_factor: ing.package_conversion_factor ?? "",
      package_name_en: ing.package_name_en,
      package_name_ar: ing.package_name_ar,
    });
    setEditingId(ing.id);
    setFormOpen(true);
  };

  const filteredIngredients = ingredients.filter((i) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      i.name_en.toLowerCase().includes(q) ||
      i.name_ar.includes(searchQuery) ||
      (i.serial_code || "").toLowerCase().includes(q)
    );
  });

  const baseUnit = (code: string) => units.find((u) => u.code === code) || { name_en: code, name_ar: code };

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-white/50">
            {IU1002} / {IU1003} · {PR1002}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {t("manageIngredients")}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {t("manageIngredientsSubtitle")}
          </p>
        </div>
        <Link
          to="/ingredients"
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
        >
          {t("back")}
        </Link>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <select
            value={systemGroupFilter}
            onChange={(e) => {
              const v = e.target.value;
              setSystemGroupFilter(v);
              if (v) {
                setSearchParams({ system_group: v });
              } else {
                setSearchParams({});
              }
            }}
            className="glass-input min-h-[40px] rounded-lg px-3 py-2 text-white"
          >
            {SYSTEM_GROUPS.map((g) => (
              <option key={g.value || "all"} value={g.value}>
                {isRTL ? g.labelAr : g.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input min-h-[40px] flex-1 min-w-[200px] rounded-lg px-3 py-2 text-white placeholder:text-white/40"
          />
          <button
            type="button"
            onClick={() => {
              setFormOpen(true);
              setEditingId(null);
              setForm({
                ...form,
                name_en: "",
                name_ar: "",
                base_unit_id: units[0]?.id ?? 0,
                serial_code: "",
                package_conversion_factor: "",
                package_name_en: "",
                package_name_ar: "",
              });
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            + {t("addIngredient")}
          </button>
        </div>

        {formOpen && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
          >
            <h3 className="mb-4 text-sm font-semibold text-emerald-200">
              {editingId ? t("editIngredient") : t("addIngredient")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-white/70">
                  {t("ingredientNameEn")}
                </label>
                <input
                  type="text"
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                  required
                  className="glass-input w-full rounded-lg px-3 py-2 text-white"
                  placeholder="Whole Milk"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/70">
                  {t("ingredientNameAr")}
                </label>
                <input
                  type="text"
                  value={form.name_ar}
                  onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                  className="glass-input w-full rounded-lg px-3 py-2 text-white"
                  placeholder="حليب كامل الدسم"
                  dir="rtl"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/70">
                  {isRTL ? "الوحدة الرئيسية (Primary Unit)" : `${t("baseUnit")} (Primary Unit)`}
                </label>
                <select
                  value={form.base_unit_id}
                  onChange={(e) => setForm((f) => ({ ...f, base_unit_id: Number(e.target.value) }))}
                  className="glass-input w-full rounded-lg px-3 py-2 text-white"
                >
                  <option value={0}>{isRTL ? "— اختر الوحدة الرئيسية —" : "— Select primary unit —"}</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} ({u.name_en})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/70">
                  {t("serialCode")}
                </label>
                <input
                  type="text"
                  value={form.serial_code}
                  onChange={(e) => setForm((f) => ({ ...f, serial_code: e.target.value }))}
                  className="glass-input w-full rounded-lg px-3 py-2 text-white"
                  placeholder="RM-001"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/70">
                  {t("systemGroup")}
                </label>
                <select
                  value={form.system_group}
                  onChange={(e) => setForm((f) => ({ ...f, system_group: e.target.value }))}
                  className="glass-input w-full rounded-lg px-3 py-2 text-white"
                >
                  <option value="raw_materials">Raw Materials</option>
                  <option value="packaging">Packaging</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs text-white/60">
                  {t("conversionLogic")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white/80">{t("every1")}</span>
                  <input
                    type="text"
                    value={form.package_name_en}
                    onChange={(e) => setForm((f) => ({ ...f, package_name_en: e.target.value }))}
                    className="glass-input w-24 rounded-lg px-2 py-1.5 text-sm text-white"
                    placeholder="Carton"
                  />
                  <span className="text-white/80">/</span>
                  <input
                    type="text"
                    value={form.package_name_ar}
                    onChange={(e) => setForm((f) => ({ ...f, package_name_ar: e.target.value }))}
                    className="glass-input w-24 rounded-lg px-2 py-1.5 text-sm text-white"
                    placeholder="كرتون"
                    dir="rtl"
                  />
                  <span className="text-white/80">{t("contains")}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={form.package_conversion_factor}
                    onChange={(e) => {
                      const v = normalizeNumericInput(e.target.value).replace(/[^\d.]/g, "");
                      const parts = v.split(".");
                      const sanitized = parts.length > 2
                        ? `${parts[0]}.${parts.slice(1).join("")}`
                        : v;
                      setForm((f) => ({ ...f, package_conversion_factor: sanitized }));
                    }}
                    className="glass-input w-20 rounded-lg px-2 py-1.5 text-sm text-white"
                    placeholder="12"
                  />
                  <span className="text-white/80">
                    {units.find((u) => u.id === form.base_unit_id)?.code ?? "unit"}
                  </span>
                </div>
              </div>
            </div>
            {error && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-red-400">{error}</p>
                {showPrimaryUnitWarning && units.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveWithFallbackUnit}
                    disabled={saving}
                    className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
                  >
                    {isRTL ? "تجاهل واستخدم أصغر وحدة تلقائياً (علامة تحذير)" : "Ignore & use smallest unit (with warning)"}
                  </button>
                )}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? t("saving") : t("save")}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center gap-3 py-8">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span className="text-white/60">{t("loading")}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/20 text-white/70">
                  <th className="pb-3 pr-4">{t("systemCode")}</th>
                  <th className="pb-3 pr-4">{t("ingredientName")}</th>
                  <th className="pb-3 pr-4">{t("baseUnit")}</th>
                  <th className="pb-3 pr-4">{t("packageBreakdown")}</th>
                  <th className="pb-3 pr-4">{t("systemGroup")}</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredIngredients.map((ing) => {
                  const factor = ing.package_conversion_factor
                    ? parseFloat(ing.package_conversion_factor)
                    : 0;
                  const sampleQty = 28; // example for display
                  const workable =
                    factor > 0 && (ing.package_name_en || ing.package_name_ar)
                      ? calculateWorkableUnits(
                          sampleQty,
                          factor,
                          ing.package_name_ar || ing.package_name_en || "علبة",
                          ing.package_name_en || ing.package_name_ar || "package",
                          ing.base_unit_name_ar || "وحدة",
                          ing.base_unit_name_en || "units"
                        )
                      : null;
                  return (
                    <tr
                      key={ing.id}
                      className="border-b border-white/10 text-white hover:bg-white/5"
                    >
                      <td className="py-3 pr-4 font-mono text-emerald-400">
                        {ing.serial_code || ing.system_code}
                      </td>
                      <td className="py-3 pr-4">
                        <span>{ing.name_en}</span>
                        {ing.name_ar && (
                          <span className="ml-2 text-white/60">| {ing.name_ar}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">{ing.base_unit_code}</td>
                      <td className="py-3 pr-4">
                        {workable ? (
                          <span>
                            {isRTL ? workable.display_ar : workable.display_en}{" "}
                            <span className="text-white/50">(e.g. {sampleQty})</span>
                          </span>
                        ) : (
                          <span className="text-white/50">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 capitalize text-white/80">
                        {ing.system_group.replace("_", " ")}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Link
                            to={`/inventory/item-file?id=${ing.id}`}
                            className="rounded px-2 py-1 text-sky-400 hover:bg-white/10"
                          >
                            {isRTL ? "ملف" : "File"}
                          </Link>
                          <button
                            type="button"
                            onClick={() => startEdit(ing)}
                            className="rounded px-2 py-1 text-emerald-400 hover:bg-white/10"
                          >
                            {t("edit")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredIngredients.length === 0 && (
              <p className="py-8 text-center text-white/50">{t("noIngredients")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
