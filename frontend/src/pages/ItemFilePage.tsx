/**
 * ملف الصنف (Item File) – عرض وتحرير بيانات الصنف ووحداته
 * تصميم حديث مستوحى من واجهة ملف الأصناف التقليدية مع تحسينات UX
 * Route: /inventory/item-file
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Save,
  Plus,
  Search,
  ArrowUpDown,
  Package2,
  Pencil,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import {
  fetchInventoryUnits,
  fetchIngredients,
  fetchIngredientDetail,
  createIngredient,
  updateIngredient,
  type ManageIngredient,
  type InventoryUnit,
} from "../lib/api";

const SYSTEM_GROUPS = [
  { value: "raw_materials", label: "Raw Materials", labelAr: "المواد الخام" },
  { value: "packaging", label: "Packaging", labelAr: "التعبئة" },
  { value: "other", label: "Other", labelAr: "أخرى" },
] as const;

type SortOrder = "asc" | "desc";

/** تحويل الأرقام العربية (٠١٢٣...) إلى إنجليزية (0123...) لقبول كلاهما */
function normalizeNumericInput(val: string): string {
  const arabicToWestern: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return val
    .split("")
    .map((c) => arabicToWestern[c] ?? c)
    .join("");
}

export default function ItemFilePage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useNotifications() ?? { addToast: () => {} };
  const isRTL = i18n.language === "ar";
  const [searchParams, setSearchParams] = useSearchParams();
  const urlId = searchParams.get("id");
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [ingredients, setIngredients] = useState<ManageIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [searchBy, setSearchBy] = useState<"serial" | "name">("name");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [form, setForm] = useState({
    name_en: "",
    name_ar: "",
    base_unit_id: 0,
    serial_code: "",
    system_group: "raw_materials" as "raw_materials" | "packaging" | "other",
    package_conversion_factor: "" as string | number,
    package_name_en: "",
    package_name_ar: "",
    package_is_active: true,
    default_display_unit: "base" as "base" | "package",
    unit_cost: "" as string | number,
  });
  const packageConversionRef = useRef<HTMLDivElement>(null);
  const packageNameEnRef = useRef<HTMLInputElement>(null);
  const skipFormSyncRef = useRef(false);
  const lastSyncedIngredientIdRef = useRef<number | null>(null);
  const formRef = useRef(form);
  const [packageSectionHighlight, setPackageSectionHighlight] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingDefaultUnit, setSavingDefaultUnit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const loadUnits = useCallback(async () => {
    const list = await fetchInventoryUnits();
    setUnits(list);
  }, []);

  const loadIngredients = useCallback(async (noCache = false) => {
    setLoading(true);
    try {
      const list = await fetchIngredients(undefined, noCache);
      setIngredients(list);
      return list;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  formRef.current = form;

  const filteredAndSorted = useMemo(() => {
    let list = ingredients;
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      if (searchBy === "serial") {
        list = list.filter((i) => (i.serial_code || "").toLowerCase().includes(q));
      } else {
        list = list.filter(
          (i) =>
            i.name_en.toLowerCase().includes(q) ||
            (i.name_ar || "").includes(searchQuery)
        );
      }
    }
    list = [...list].sort((a, b) => {
      const cmp = sortOrder === "asc"
        ? a.name_en.localeCompare(b.name_en)
        : b.name_en.localeCompare(a.name_en);
      return cmp;
    });
    return list;
  }, [ingredients, searchQuery, searchBy, sortOrder]);

  const currentIngredient = isAddingNew ? null : (filteredAndSorted[currentIndex] ?? null);
  const currentId = currentIngredient?.id ?? null;
  const totalCount = filteredAndSorted.length;

  useEffect(() => {
    if (urlId && totalCount > 0) {
      const idx = filteredAndSorted.findIndex((i) => String(i.id) === urlId);
      if (idx >= 0 && idx !== currentIndex) setCurrentIndex(idx);
    }
  }, [urlId, filteredAndSorted, totalCount]);

  useEffect(() => {
    if (skipFormSyncRef.current) {
      skipFormSyncRef.current = false;
      return;
    }
    if (currentIngredient) {
      setSearchParams({ id: String(currentIngredient.id) }, { replace: true });
      lastSyncedIngredientIdRef.current = currentIngredient.id;
      setForm({
        name_en: currentIngredient.name_en,
        name_ar: currentIngredient.name_ar || "",
        base_unit_id: currentIngredient.base_unit_id ?? units[0]?.id ?? 0,
        serial_code: currentIngredient.serial_code || "",
        system_group: (currentIngredient.system_group as "raw_materials" | "packaging" | "other") || "raw_materials",
        package_conversion_factor: currentIngredient.package_conversion_factor ?? "",
        package_name_en: currentIngredient.package_name_en || "",
        package_name_ar: currentIngredient.package_name_ar || "",
        package_is_active: currentIngredient.package_is_active ?? true,
        default_display_unit: (currentIngredient.default_display_unit ?? "base") as "base" | "package",
        unit_cost: currentIngredient.unit_cost ?? "",
      });
      setDirty(false);
    }
  }, [currentIngredient, units]);

  const showSearchDropdown =
    searchFocused && searchQuery.trim().length > 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSearchResult = (index: number) => {
    goTo(index);
    setSearchFocused(false);
  };

  const goTo = (index: number) => {
    if (dirty && !window.confirm(isRTL ? "توجد تغييرات غير محفوظة. إلغاء؟" : "Unsaved changes. Discard?"))
      return;
    setIsAddingNew(false);
    setCurrentIndex(Math.max(0, Math.min(index, totalCount - 1)));
  };

  const cancelAddNew = () => {
    if (dirty && !window.confirm(isRTL ? "توجد تغييرات غير محفوظة. إلغاء؟" : "Unsaved changes. Discard?"))
      return;
    setIsAddingNew(false);
    setDirty(false);
    setCurrentIndex(0);
  };

  const handleSave = async () => {
    if (!currentId) return;
    const latestForm = formRef.current;
    setSaving(true);
    setError(null);
    try {
      await updateIngredient(currentId, {
        name_en: latestForm.name_en,
        name_ar: latestForm.name_ar,
        base_unit_id: latestForm.base_unit_id || undefined,
        serial_code: latestForm.serial_code,
        system_group: latestForm.system_group,
        package_conversion_factor: latestForm.package_conversion_factor
          ? Number(latestForm.package_conversion_factor)
          : null,
        package_name_en: latestForm.package_name_en,
        package_name_ar: latestForm.package_name_ar,
        package_is_active: latestForm.package_is_active,
        default_display_unit: latestForm.default_display_unit,
        unit_cost: latestForm.unit_cost !== "" ? String(latestForm.unit_cost) : null,
      });
      setDirty(false);
      skipFormSyncRef.current = true;
      lastSyncedIngredientIdRef.current = currentId;
      const detail = await fetchIngredientDetail(currentId, true);
      if (detail) {
        setForm({
          name_en: detail.name_en,
          name_ar: detail.name_ar || "",
          base_unit_id: detail.base_unit_id ?? units[0]?.id ?? 0,
          serial_code: detail.serial_code || "",
          system_group: (detail.system_group as "raw_materials" | "packaging" | "other") || "raw_materials",
          package_conversion_factor: detail.package_conversion_factor ?? "",
          package_name_en: detail.package_name_en || "",
          package_name_ar: detail.package_name_ar || "",
          package_is_active: detail.package_is_active ?? true,
          default_display_unit: detail.default_display_unit ?? "base",
          unit_cost: detail.unit_cost ?? "",
        });
        setIngredients((prev) =>
          prev.map((ing) => (ing.id === currentId ? { ...ing, ...detail } : ing)),
        );
      }
      addToast(isRTL ? "تم حفظ التغييرات بنجاح" : "Changes saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = () => {
    if (dirty && !window.confirm(isRTL ? "توجد تغييرات غير محفوظة. إلغاء؟" : "Unsaved changes. Discard?"))
      return;
    lastSyncedIngredientIdRef.current = null;
    setForm({
      name_en: "",
      name_ar: "",
      base_unit_id: units[0]?.id ?? 0,
      serial_code: "",
      system_group: "raw_materials" as "raw_materials" | "packaging" | "other",
      package_conversion_factor: "",
      package_name_en: "",
      package_name_ar: "",
      package_is_active: true,
      default_display_unit: "base" as "base" | "package",
      unit_cost: "",
    });
    setIsAddingNew(true);
    setDirty(true);
  };

  const handleCreate = async () => {
    if (!form.name_en.trim()) {
      setError(isRTL ? "اسم الصنف مطلوب" : "Item name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createIngredient({
        name_en: form.name_en.trim(),
        name_ar: form.name_ar?.trim(),
        base_unit_id: form.base_unit_id || units[0]?.id!,
        serial_code: form.serial_code?.trim(),
        system_group: form.system_group,
        package_conversion_factor: form.package_conversion_factor
          ? Number(form.package_conversion_factor)
          : undefined,
        package_name_en: form.package_name_en?.trim(),
        package_name_ar: form.package_name_ar?.trim(),
        default_display_unit: form.default_display_unit,
        unit_cost: form.unit_cost !== "" ? String(form.unit_cost) : undefined,
      });
      setDirty(false);
      setIsAddingNew(false);
      const list = await loadIngredients();
      const idx = (list ?? []).findIndex((i) => i.id === created.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const baseUnit = units.find((u) => u.id === form.base_unit_id);
  const factor = form.package_conversion_factor ? parseFloat(String(form.package_conversion_factor)) : 0;
  const unitCost = form.unit_cost !== "" ? parseFloat(String(form.unit_cost)) : null;

  const hasTransactions = currentIngredient?.has_transactions ?? false;
  const packageIsActive = form.package_is_active;

  const unitsGridRows = useMemo(() => {
    const rows: Array<{
      type: "base" | "package";
      name: string;
      qty: number;
      unitCode: string;
      isPackage: boolean;
      cost: number | null;
    }> = [];
    rows.push({
      type: "base",
      name: baseUnit?.name_en || form.name_en || "—",
      qty: 1,
      unitCode: baseUnit?.code || "—",
      isPackage: false,
      cost: unitCost ?? null,
    });
    if (factor > 0 && (form.package_name_en || form.package_name_ar)) {
      rows.push({
        type: "package",
        name: isRTL ? (form.package_name_ar || form.package_name_en) : (form.package_name_en || form.package_name_ar),
        qty: factor,
        unitCode: baseUnit?.code || "—",
        isPackage: true,
        cost: unitCost != null ? unitCost * factor : null,
      });
    }
    return rows;
  }, [baseUnit, form, factor, unitCost, isRTL]);

  const scrollToPackageConversion = () => {
    packageConversionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setPackageSectionHighlight(true);
    setTimeout(() => setPackageSectionHighlight(false), 2500);
    setTimeout(() => packageNameEnRef.current?.focus(), 450);
  };

  const handleSetDefaultUnit = useCallback(
    async (type: "base" | "package") => {
      const val = type;
      if (!currentId) return;
      const prevVal = form.default_display_unit;
      if (val === prevVal) return;
      setError(null);
      formRef.current = { ...formRef.current, default_display_unit: val };
      setForm((f) => ({ ...f, default_display_unit: val }));
      setDirty(true);
      setSavingDefaultUnit(true);
      try {
        await updateIngredient(currentId, { default_display_unit: val });
        skipFormSyncRef.current = true;
        lastSyncedIngredientIdRef.current = currentId;
        const detail = await fetchIngredientDetail(currentId, true);
        if (detail) {
          const savedVal = (detail.default_display_unit ?? "base") as "base" | "package";
          formRef.current = { ...formRef.current, default_display_unit: savedVal };
          setForm((f) => ({ ...f, default_display_unit: savedVal }));
          setIngredients((prev) =>
            prev.map((ing) => (ing.id === currentId ? { ...ing, ...detail } : ing)),
          );
        }
        await loadIngredients(true);
        addToast(
          isRTL ? "تم تغيير العبوة الافتراضية بنجاح" : "Default unit updated successfully",
        );
      } catch (err) {
        formRef.current = { ...formRef.current, default_display_unit: prevVal };
        setForm((f) => ({ ...f, default_display_unit: prevVal }));
        setError(err instanceof Error ? err.message : isRTL ? "فشل تحديث الوحدة الافتراضية" : "Failed to update default unit");
      } finally {
        setSavingDefaultUnit(false);
      }
    },
    [currentId, form.default_display_unit, isRTL, addToast, loadIngredients],
  );

  const handleDeletePackage = async () => {
    if (!currentId) return;
    if (hasTransactions) {
      setError(isRTL ? "لا يمكن حذف العبوة لوجود حركات مخزنية. يمكن إيقافها فقط." : "Cannot delete package due to inventory movements. You can only disable it.");
      return;
    }
    if (!window.confirm(isRTL ? "حذف العبوة؟" : "Delete package?")) return;
    setSaving(true);
    setError(null);
    try {
      await updateIngredient(currentId, {
        package_conversion_factor: null,
        package_name_en: "",
        package_name_ar: "",
      });
      setForm((f) => ({ ...f, package_conversion_factor: "", package_name_en: "", package_name_ar: "" }));
      setDirty(false);
      loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDisablePackage = async () => {
    if (!currentId) return;
    setSaving(true);
    setError(null);
    try {
      await updateIngredient(currentId, { package_is_active: false });
      setForm((f) => ({ ...f, package_is_active: false }));
      setDirty(false);
      loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePackage = async () => {
    if (!currentId) return;
    setSaving(true);
    setError(null);
    try {
      await updateIngredient(currentId, { package_is_active: true });
      setForm((f) => ({ ...f, package_is_active: true }));
      setDirty(false);
      loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading && ingredients.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            {isRTL ? "ملف الأصناف" : "Item File"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "عرض وتحكم في بيانات الصنف ووحداته" : "View and manage item details and units"}
          </p>
        </div>
        <Link
          to="/inventory/manage-ingredients"
          className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          {t("back")}
        </Link>
      </div>

      {/* Search & Sort Bar */}
      <div className={`float-card flex flex-wrap items-center gap-4 rounded-2xl p-4 ${showSearchDropdown ? "relative z-[9999]" : ""}`}>
        <div ref={searchContainerRef} className="relative flex flex-1 min-w-[280px] flex-col">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder={isRTL ? "ابحث عن صنف (مثل: حليب)..." : "Search items (e.g. milk)..."}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentIndex(0);
              }}
              onFocus={() => setSearchFocused(true)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              autoComplete="off"
            />
          </div>
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 z-[9999] mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
              <div className="p-1">
                {filteredAndSorted.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    {isRTL ? "لا توجد أصناف تطابق البحث" : "No items match your search"}
                  </p>
                ) : (
                  <>
                    <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {isRTL
                        ? `${filteredAndSorted.length} صنف مطابق`
                        : `${filteredAndSorted.length} matching item(s)`}
                    </p>
                    {filteredAndSorted.map((ing, idx) => (
                  <button
                    key={ing.id}
                    type="button"
                    onClick={() => selectSearchResult(idx)}
                    className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-emerald-500/15 focus:bg-emerald-500/15 ${
                      idx === currentIndex && !isAddingNew
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <span className="font-medium">
                      {isRTL ? (ing.name_ar || ing.name_en) : ing.name_en}
                      {ing.name_ar && !isRTL && (
                        <span className="ml-2 text-slate-500 dark:text-slate-400">
                          | {ing.name_ar}
                        </span>
                      )}
                      {ing.name_en && isRTL && ing.name_ar && (
                        <span className="mr-2 text-slate-500 dark:text-slate-400">
                          | {ing.name_en}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {ing.serial_code || ing.system_code || `#${ing.id}`}
                    </span>
                  </button>
                ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "بحث حسب" : "Search by"}
          </span>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="searchBy"
              checked={searchBy === "name"}
              onChange={() => setSearchBy("name")}
              className="rounded"
            />
            {isRTL ? "الاسم" : "Name"}
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="searchBy"
              checked={searchBy === "serial"}
              onChange={() => setSearchBy("serial")}
              className="rounded"
            />
            {isRTL ? "رقم الصنف" : "Serial"}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-slate-500" />
          <span className="text-sm text-slate-500">{isRTL ? "ترتيب" : "Sort"}</span>
          <button
            type="button"
            onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
          >
            {sortOrder === "asc"
              ? (isRTL ? "تصاعدي" : "Asc")
              : (isRTL ? "تنازلي" : "Desc")}
          </button>
        </div>
      </div>

      {/* Main Item Card */}
      {totalCount === 0 ? (
        <div className="float-card rounded-2xl p-12 text-center">
          <Package2 className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-slate-500 dark:text-slate-400">
            {searchQuery.trim()
              ? (isRTL ? "لا توجد أصناف تطابق البحث. جرّب كلمة أخرى." : "No items match your search. Try different keywords.")
              : (isRTL ? "لا توجد أصناف. أضف صنفاً من إدارة المكونات." : "No items. Add from Manage Ingredients.")}
          </p>
          {searchQuery.trim() ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-4 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
            >
              {isRTL ? "مسح البحث" : "Clear search"}
            </button>
          ) : (
            <Link
              to="/inventory/manage-ingredients"
              className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              + {t("addIngredient")}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="float-card overflow-hidden rounded-2xl">
            {/* Identification & Categorization */}
            <div className="grid gap-6 border-b border-slate-200 p-6 dark:border-slate-700 lg:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isRTL ? "بيانات التعريف" : "Identification"}
                </h3>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    {isRTL ? "اسم الصنف" : "Item Name"} (EN)
                  </label>
                  <input
                    type="text"
                    value={form.name_en}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, name_en: e.target.value }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    placeholder="e.g. Whole Milk"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    {isRTL ? "اسم الصنف" : "Item Name"} (AR)
                  </label>
                  <input
                    type="text"
                    value={form.name_ar}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, name_ar: e.target.value }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    placeholder="حليب كامل الدسم"
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    {isRTL ? "رقم الصنف / الرمز" : "Serial Code"}
                  </label>
                  <input
                    type="text"
                    value={form.serial_code}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, serial_code: e.target.value }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    placeholder="RM-001"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isRTL ? "التصنيف والشراء" : "Category & Purchase"}
                </h3>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    {isRTL ? "مجموعة النظام" : "System Group"}
                  </label>
                  <select
                    value={form.system_group}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, system_group: e.target.value as typeof form.system_group }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    {SYSTEM_GROUPS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {isRTL ? g.labelAr : g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    {isRTL ? "الوحدة الرئيسية" : "Base Unit"}
                  </label>
                  <select
                    value={form.base_unit_id}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, base_unit_id: Number(e.target.value) }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} – {u.name_en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    {isRTL ? "تكلفة الوحدة (ر.س)" : "Unit Cost (SAR)"}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={form.unit_cost}
                    onChange={(e) => {
                      const v = normalizeNumericInput(e.target.value).replace(/[^\d.]/g, "");
                      const parts = v.split(".");
                      const sanitized = parts.length > 2
                        ? `${parts[0]}.${parts.slice(1).join("")}`
                        : v;
                      setForm((f) => ({ ...f, unit_cost: sanitized }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Package Conversion */}
            <div
              ref={packageConversionRef}
              className={`scroll-mt-4 border-b border-slate-200 p-6 transition-all duration-500 dark:border-slate-700 ${
                packageSectionHighlight ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900" : ""
              }`}
            >
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isRTL ? "تحويل العبوة" : "Package Conversion"}
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-600 dark:text-slate-400">
                  {isRTL ? "كل 1" : "Every 1"}
                </span>
                <input
                  ref={packageNameEnRef}
                  type="text"
                  value={form.package_name_en}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, package_name_en: e.target.value }));
                    setDirty(true);
                  }}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  placeholder="Carton"
                />
                <span className="text-slate-400">/</span>
                <input
                  type="text"
                  value={form.package_name_ar}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, package_name_ar: e.target.value }));
                    setDirty(true);
                  }}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  placeholder="كرتون"
                  dir="rtl"
                />
                <span className="text-slate-600 dark:text-slate-400">
                  {isRTL ? "يحتوي" : "contains"}
                </span>
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
                    setDirty(true);
                  }}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  placeholder="12"
                />
                <span className="text-slate-500 font-medium">
                  {baseUnit?.code ?? "unit"}
                </span>
              </div>
            </div>

            {/* Item Units Grid */}
            <div className="p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isRTL ? "عبوات الصنف" : "Item Units"}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        {isRTL ? "الاسم" : "Name"}
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        {isRTL ? "الكمية" : "Qty"}
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        {isRTL ? "الوحدة" : "Unit"}
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        {isRTL ? "عبوة" : "Package"}
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        {isRTL ? "التكلفة" : "Cost"}
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        {isRTL ? "افتراضي" : "Default"}
                      </th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                        {isRTL ? "إجراءات" : "Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitsGridRows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-slate-100 last:border-0 dark:border-slate-700 ${row.type === "package" && !packageIsActive ? "opacity-60" : ""}`}
                      >
                        <td className="px-4 py-3 text-slate-800 dark:text-white">
                          <span>{row.name}</span>
                          {row.isPackage && !packageIsActive && (
                            <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                              {isRTL ? "موقفة" : "Disabled"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono">{row.qty}</td>
                        <td className="px-4 py-3">{row.unitCode}</td>
                        <td className="px-4 py-3">
                          {row.isPackage ? (
                            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                              ✓
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {row.cost != null ? `${row.cost.toFixed(2)} ر.س` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={
                              (row.type === "base" && form.default_display_unit === "base") ||
                              (row.type === "package" && form.default_display_unit === "package")
                            }
                            disabled={savingDefaultUnit}
                            onClick={() => handleSetDefaultUnit(row.type)}
                            className="flex w-full cursor-pointer items-center justify-center gap-1 rounded p-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span
                              className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                                (row.type === "base" && form.default_display_unit === "base") ||
                                (row.type === "package" && form.default_display_unit === "package")
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-slate-300 dark:border-slate-500"
                              }`}
                            >
                              {((row.type === "base" && form.default_display_unit === "base") ||
                                (row.type === "package" && form.default_display_unit === "package")) && (
                                <span className="h-2 w-2 rounded-full bg-white" aria-hidden />
                              )}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {row.type === "base" ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={scrollToPackageConversion}
                                title={isRTL ? "تعديل" : "Edit"}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {!hasTransactions && (
                                <button
                                  type="button"
                                  onClick={handleDeletePackage}
                                  disabled={saving}
                                  title={isRTL ? "حذف العبوة" : "Delete package"}
                                  className="rounded p-1.5 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                              {hasTransactions && packageIsActive && (
                                <button
                                  type="button"
                                  onClick={handleDisablePackage}
                                  disabled={saving}
                                  title={isRTL ? "إيقاف العبوة" : "Disable package"}
                                  className="rounded p-1.5 text-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
                                >
                                  <PowerOff className="h-4 w-4" />
                                </button>
                              )}
                              {hasTransactions && !packageIsActive && (
                                <button
                                  type="button"
                                  onClick={handleEnablePackage}
                                  disabled={saving}
                                  title={isRTL ? "تفعيل العبوة" : "Enable package"}
                                  className="rounded p-1.5 text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50"
                                >
                                  <Power className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="border-t border-slate-200 px-6 py-3 dark:border-slate-700">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/30">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goTo(0)}
                  disabled={isAddingNew || currentIndex <= 0}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                  title={isRTL ? "الأول" : "First"}
                >
                  <ChevronsLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(currentIndex - 1)}
                  disabled={isAddingNew || currentIndex <= 0}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                  title={isRTL ? "السابق" : "Previous"}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="min-w-[120px] text-center text-sm text-slate-600 dark:text-slate-400">
                  {isAddingNew ? (isRTL ? "جديد" : "New") : `${currentIndex + 1} / ${totalCount}`}
                </span>
                <button
                  type="button"
                  onClick={() => goTo(currentIndex + 1)}
                  disabled={isAddingNew || currentIndex >= totalCount - 1}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                  title={isRTL ? "التالي" : "Next"}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(totalCount - 1)}
                  disabled={isAddingNew || currentIndex >= totalCount - 1}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                  title={isRTL ? "الأخير" : "Last"}
                >
                  <ChevronsRight className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={currentId ? handleSave : handleCreate}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? t("saving") : t("save")}
                </button>
                {isAddingNew ? (
                  <button
                    type="button"
                    onClick={cancelAddNew}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {t("cancel")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddNew}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Plus className="h-4 w-4" />
                    + {t("addIngredient")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
