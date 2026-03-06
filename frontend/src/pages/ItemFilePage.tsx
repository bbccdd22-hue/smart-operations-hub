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
  Check,
  X,
  Star,
} from "lucide-react";
import {
  fetchInventoryUnits,
  fetchIngredients,
  fetchIngredientDetail,
  createIngredient,
  updateIngredient,
  createIngredientPackage,
  updateIngredientPackage,
  deleteIngredientPackage,
  type ManageIngredient,
  type InventoryUnit,
  type IngredientPackageData,
} from "../lib/api";

const SYSTEM_GROUPS = [
  { value: "raw_materials", label: "Raw Materials", labelAr: "المواد الخام" },
  { value: "packaging", label: "Packaging", labelAr: "التعبئة" },
  { value: "other", label: "Other", labelAr: "أخرى" },
] as const;

type SortOrder = "asc" | "desc";
type SystemGroup = (typeof SYSTEM_GROUPS)[number]["value"];
type DefaultDisplayUnit = "base" | "package";
type ItemFormState = {
  name_en: string;
  name_ar: string;
  base_unit_id: number;
  serial_code: string;
  system_group: SystemGroup;
  package_conversion_factor: string | number;
  package_name_en: string;
  package_name_ar: string;
  package_is_active: boolean;
  default_display_unit: DefaultDisplayUnit;
  unit_cost: string | number;
};

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
  const [form, setForm] = useState<ItemFormState>({
    name_en: "",
    name_ar: "",
    base_unit_id: 0,
    serial_code: "",
    system_group: "raw_materials",
    package_conversion_factor: "",
    package_name_en: "",
    package_name_ar: "",
    package_is_active: true,
    default_display_unit: "base",
    unit_cost: "",
  });
  /* ── Multi-package state ── */
  const [pkgs, setPkgs] = useState<IngredientPackageData[]>([]);
  const [editingPkgId, setEditingPkgId] = useState<number | null>(null);
  const [editingPkg, setEditingPkg] = useState({ name_en: "", name_ar: "", conversion_factor: "" });
  const [addingPkg, setAddingPkg] = useState(false);
  const [newPkg, setNewPkg] = useState({ name_en: "", name_ar: "", conversion_factor: "" });
  const [pkgSaving, setPkgSaving] = useState(false);

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
        system_group: (currentIngredient.system_group as SystemGroup) || "raw_materials",
        package_conversion_factor: currentIngredient.package_conversion_factor ?? "",
        package_name_en: currentIngredient.package_name_en || "",
        package_name_ar: currentIngredient.package_name_ar || "",
        package_is_active: currentIngredient.package_is_active ?? true,
        default_display_unit: (currentIngredient.default_display_unit ?? "base") as DefaultDisplayUnit,
        unit_cost: currentIngredient.unit_cost ?? "",
      });
      setDirty(false);
    }
  }, [currentIngredient, units]);

  /* Sync packages when the selected ingredient changes */
  useEffect(() => {
    setPkgs(currentIngredient?.packages ?? []);
    setEditingPkgId(null);
    setAddingPkg(false);
    setNewPkg({ name_en: "", name_ar: "", conversion_factor: "" });
  }, [currentIngredient?.id]);

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
          system_group: (detail.system_group as SystemGroup) || "raw_materials",
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
      system_group: "raw_materials",
      package_conversion_factor: "",
      package_name_en: "",
      package_name_ar: "",
      package_is_active: true,
      default_display_unit: "base",
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
  const packageOptionEnabled = factor > 0 && packageIsActive;
  const packageDefaultLabel = isRTL
    ? `عبوة مرتبطة (${form.package_name_ar || form.package_name_en || "—"})`
    : `Linked Package (${form.package_name_en || form.package_name_ar || "—"})`;

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
      if (val === "package" && !packageOptionEnabled) {
        setError(
          isRTL
            ? "لا يمكن اختيار العبوة كوحدة افتراضية قبل تعريف العبوة وتفعيلها."
            : "Package cannot be default before setting package details and enabling it.",
        );
        return;
      }
      const prevVal = formRef.current.default_display_unit;
      if (val === prevVal) return;
      setError(null);
      formRef.current = { ...formRef.current, default_display_unit: val };
      setForm((f) => ({ ...f, default_display_unit: val }));
      setDirty(true);

      // أثناء إضافة صنف جديد لا يوجد currentId بعد؛ نكتفي بتحديث الفورم
      // وسيتم حفظ القيمة ضمن payload عند الإنشاء.
      if (!currentId) return;

      setSavingDefaultUnit(true);
      try {
        const nextPayload = val === "package"
          ? {
              // Save package fields with default in one PATCH to avoid lock
              // when package edits are still unsaved in the form.
              package_conversion_factor: formRef.current.package_conversion_factor
                ? Number(formRef.current.package_conversion_factor)
                : null,
              package_name_en: (formRef.current.package_name_en || "").trim(),
              package_name_ar: (formRef.current.package_name_ar || "").trim(),
              package_is_active: formRef.current.package_is_active,
              default_display_unit: val,
            }
          : { default_display_unit: val };
        await updateIngredient(currentId, nextPayload);
        const detail = await fetchIngredientDetail(currentId, true);
        if (detail) {
          const savedVal = (detail.default_display_unit ?? "base") as DefaultDisplayUnit;
          formRef.current = { ...formRef.current, default_display_unit: savedVal };
          setForm((f) => ({ ...f, default_display_unit: savedVal }));
          skipFormSyncRef.current = true;
          lastSyncedIngredientIdRef.current = currentId;
          setIngredients((prev) =>
            prev.map((ing) => (ing.id === currentId ? { ...ing, ...detail } : ing)),
          );
        }
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
    [currentId, isRTL, addToast, loadIngredients, packageOptionEnabled],
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
        default_display_unit: "base",
      });
      formRef.current = { ...formRef.current, default_display_unit: "base" };
      setForm((f) => ({
        ...f,
        package_conversion_factor: "",
        package_name_en: "",
        package_name_ar: "",
        default_display_unit: "base",
      }));
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
      await updateIngredient(currentId, { package_is_active: false, default_display_unit: "base" });
      formRef.current = { ...formRef.current, default_display_unit: "base" };
      setForm((f) => ({ ...f, package_is_active: false, default_display_unit: "base" }));
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

  /* ── Multi-package CRUD ──────────────────────────────────── */
  const handleAddPkg = async () => {
    if (!currentId) return;
    const factor = parseFloat(newPkg.conversion_factor);
    if (!newPkg.name_en.trim()) { setError(isRTL ? "الاسم الإنجليزي مطلوب" : "English name is required"); return; }
    if (!factor || factor <= 0)  { setError(isRTL ? "معامل التحويل يجب أن يكون أكبر من صفر" : "Conversion factor must be > 0"); return; }
    setPkgSaving(true);
    setError(null);
    try {
      const created = await createIngredientPackage(currentId, {
        name_en: newPkg.name_en.trim(),
        name_ar: newPkg.name_ar.trim(),
        conversion_factor: factor,
        is_default: pkgs.length === 0, // first package is default
      });
      setPkgs(prev => [...prev, created]);
      setAddingPkg(false);
      setNewPkg({ name_en: "", name_ar: "", conversion_factor: "" });
      addToast(isRTL ? "تمت إضافة العبوة" : "Package added");
      loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add package");
    } finally {
      setPkgSaving(false);
    }
  };

  const handleSaveEditPkg = async (pkgId: number) => {
    if (!currentId) return;
    const factor = parseFloat(editingPkg.conversion_factor);
    if (!editingPkg.name_en.trim()) { setError(isRTL ? "الاسم الإنجليزي مطلوب" : "English name is required"); return; }
    if (!factor || factor <= 0)     { setError(isRTL ? "معامل التحويل يجب أن يكون أكبر من صفر" : "Conversion factor must be > 0"); return; }
    setPkgSaving(true);
    setError(null);
    try {
      const updated = await updateIngredientPackage(currentId, pkgId, {
        name_en: editingPkg.name_en.trim(),
        name_ar: editingPkg.name_ar.trim(),
        conversion_factor: factor,
      });
      setPkgs(prev => prev.map(p => p.id === pkgId ? updated : p));
      setEditingPkgId(null);
      addToast(isRTL ? "تم تعديل العبوة" : "Package updated");
      loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update package");
    } finally {
      setPkgSaving(false);
    }
  };

  const handleDeletePkg = async (pkgId: number) => {
    if (!currentId) return;
    if (!window.confirm(isRTL ? "حذف هذه العبوة؟" : "Delete this package?")) return;
    setPkgSaving(true);
    setError(null);
    try {
      await deleteIngredientPackage(currentId, pkgId);
      setPkgs(prev => prev.filter(p => p.id !== pkgId));
      addToast(isRTL ? "تم حذف العبوة" : "Package deleted");
      loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete package");
    } finally {
      setPkgSaving(false);
    }
  };

  const handleTogglePkgActive = async (pkgId: number, currentActive: boolean) => {
    if (!currentId) return;
    setPkgSaving(true);
    setError(null);
    try {
      const updated = await updateIngredientPackage(currentId, pkgId, { is_active: !currentActive });
      setPkgs(prev => prev.map(p => p.id === pkgId ? updated : p));
      loadIngredients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPkgSaving(false);
    }
  };

  const handleSetDefaultPkg = async (pkgId: number) => {
    if (!currentId) return;
    setPkgSaving(true);
    setError(null);
    try {
      const updated = await updateIngredientPackage(currentId, pkgId, { is_default: true });
      setPkgs(prev => prev.map(p => ({ ...p, is_default: p.id === pkgId })));
      // Also set ingredient default_display_unit to "package"
      await updateIngredient(currentId, { default_display_unit: "package" });
      setForm(f => ({ ...f, default_display_unit: "package" }));
      addToast(isRTL ? "تم تعيين العبوة كافتراضية" : "Default package set");
      loadIngredients();
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPkgSaving(false);
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
    <div className="min-h-[calc(100vh-8rem)] space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
            {isRTL ? "ملف الأصناف" : "Item File"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "عرض وتحكم في بيانات الصنف ووحداته" : "View and manage item details and units"}
          </p>
        </div>
        <Link
          to="/inventory/manage-ingredients"
          className="rounded-lg bg-slate-200 px-4 py-2.5 min-h-[44px] flex items-center text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          {t("back")}
        </Link>
      </div>

      {/* Search & Sort Bar */}
      <div className={`float-card flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 rounded-2xl p-3 sm:p-4 ${showSearchDropdown ? "relative z-[9999]" : ""}`}>
        <div ref={searchContainerRef} className="relative flex flex-1 min-w-0 sm:min-w-[280px] flex-col">
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
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? "بحث حسب" : "Search by"}
          </span>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer min-h-[44px] px-1">
            <input
              type="radio"
              name="searchBy"
              checked={searchBy === "name"}
              onChange={() => setSearchBy("name")}
              className="h-4 w-4 accent-emerald-500"
            />
            {isRTL ? "الاسم" : "Name"}
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer min-h-[44px] px-1">
            <input
              type="radio"
              name="searchBy"
              checked={searchBy === "serial"}
              onChange={() => setSearchBy("serial")}
              className="h-4 w-4 accent-emerald-500"
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
            <div className="grid gap-x-8 gap-y-6 border-b border-slate-200 p-4 sm:p-6 dark:border-slate-700 md:grid-cols-2">
              <div className="space-y-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isRTL ? "بيانات التعريف" : "Identification"}
                </h3>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isRTL ? "اسم الصنف" : "Item Name"} (EN)
                  </label>
                  <input
                    type="text"
                    value={form.name_en}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, name_en: e.target.value }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    placeholder="e.g. Whole Milk"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isRTL ? "اسم الصنف" : "Item Name"} (AR)
                  </label>
                  <input
                    type="text"
                    value={form.name_ar}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, name_ar: e.target.value }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    placeholder="حليب كامل الدسم"
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isRTL ? "رقم الصنف / الرمز" : "Serial Code"}
                  </label>
                  <input
                    type="text"
                    value={form.serial_code}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, serial_code: e.target.value }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-mono text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    placeholder="RM-001"
                  />
                </div>
              </div>
              <div className="space-y-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isRTL ? "التصنيف والشراء" : "Category & Purchase"}
                </h3>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isRTL ? "مجموعة النظام" : "System Group"}
                  </label>
                  <select
                    value={form.system_group}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, system_group: e.target.value as typeof form.system_group }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    {SYSTEM_GROUPS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {isRTL ? g.labelAr : g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isRTL ? "الوحدة الرئيسية" : "Base Unit"}
                  </label>
                  <select
                    value={form.base_unit_id}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, base_unit_id: Number(e.target.value) }));
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} – {u.name_en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    placeholder="0.00"
                  />
                  {factor > 0 && unitCost != null && (
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                      {isRTL ? "تكلفة العبوة = الوحدة × معامل التحويل" : "Package cost = Unit × Factor"}
                      {" = "}
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{(unitCost * factor).toFixed(2)} {isRTL ? "ر.س" : "SAR"}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ عبوات الصنف — Multi-Package Management ═══ */}
            <div
              ref={packageConversionRef}
              className={`scroll-mt-4 border-b border-slate-200 dark:border-slate-700 transition-all duration-500 ${
                packageSectionHighlight ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900" : ""
              }`}
            >
              {/* Section header + Add button */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                  <Package2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {isRTL ? "عبوات الصنف" : "Package Units"}
                  </h3>
                  {pkgs.length > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {pkgs.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!currentId || pkgSaving || addingPkg}
                  onClick={() => {
                    setAddingPkg(true);
                    setNewPkg({ name_en: "", name_ar: "", conversion_factor: "" });
                    setError(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {isRTL ? "إضافة عبوة" : "Add Package"}
                </button>
              </div>

              {/* Default Display Unit row */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-50/60 px-4 sm:px-6 py-3 dark:bg-slate-800/20">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isRTL ? "الوحدة الافتراضية للعرض:" : "Default display unit:"}
                </span>
                <select
                  value={form.default_display_unit}
                  onChange={(e) => void handleSetDefaultUnit(e.target.value as "base" | "package")}
                  disabled={savingDefaultUnit}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option value="base">
                    {isRTL ? `الوحدة الأساسية (${baseUnit?.code || "—"})` : `Base Unit (${baseUnit?.code || "—"})`}
                  </option>
                  <option value="package" disabled={pkgs.filter(p => p.is_active).length === 0}>
                    {isRTL ? "عبوة" : "Package"}
                    {pkgs.find(p => p.is_default)
                      ? ` (${pkgs.find(p => p.is_default)!.name_en})`
                      : ""}
                  </option>
                </select>
                {savingDefaultUnit && <span className="text-xs text-slate-400 animate-pulse">{isRTL ? "جاري الحفظ…" : "Saving…"}</span>}
              </div>

              {/* Packages table */}
              <div className="overflow-x-auto px-4 sm:px-6 py-4">
                <table className="w-full text-sm" style={{ minWidth: 580 }}>
                  <thead>
                    <tr className="border-b-2 border-slate-200 text-xs dark:border-slate-700">
                      <th className={`pb-2 font-semibold text-slate-500 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>
                        {isRTL ? "الاسم" : "Name"}
                      </th>
                      <th className={`pb-2 font-semibold text-slate-500 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}>
                        {isRTL ? "الاسم (عربي)" : "Arabic Name"}
                      </th>
                      <th className="pb-2 text-center font-semibold text-slate-500 dark:text-slate-400">
                        {isRTL ? "معامل التحويل" : "Conversion"}
                      </th>
                      <th className="pb-2 text-center font-semibold text-slate-500 dark:text-slate-400">
                        {isRTL ? "الحالة" : "Status"}
                      </th>
                      <th className="pb-2 text-center font-semibold text-slate-500 dark:text-slate-400">
                        {isRTL ? "افتراضي" : "Default"}
                      </th>
                      <th className="pb-2 text-center font-semibold text-slate-500 dark:text-slate-400">
                        {isRTL ? "إجراءات" : "Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">

                    {/* ── Base unit row (read-only) ── */}
                    <tr className="bg-blue-50/40 dark:bg-blue-900/10">
                      <td className="py-3 pe-4 font-medium text-slate-700 dark:text-slate-200">
                        {baseUnit?.name_en || baseUnit?.code || "—"}
                      </td>
                      <td className="py-3 pe-4 text-slate-500 dark:text-slate-400">
                        {baseUnit?.name_ar || "—"}
                      </td>
                      <td className="py-3 text-center font-mono text-slate-600 dark:text-slate-300">1</td>
                      <td className="py-3 text-center">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {isRTL ? "نشط" : "Active"}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <button
                          type="button"
                          disabled={savingDefaultUnit}
                          onClick={() => void handleSetDefaultUnit("base")}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 transition disabled:opacity-50"
                          style={{
                            borderColor: form.default_display_unit === "base" ? "#3b82f6" : "#cbd5e1",
                            background: form.default_display_unit === "base" ? "#3b82f6" : "transparent",
                          }}
                          title={isRTL ? "تعيين كافتراضي" : "Set as default"}
                        >
                          {form.default_display_unit === "base" && <span className="h-2 w-2 rounded-full bg-white" />}
                        </button>
                      </td>
                      <td className="py-3 text-center text-slate-400">—</td>
                    </tr>

                    {/* ── Existing package rows ── */}
                    {pkgs.map(pkg => (
                      editingPkgId === pkg.id ? (
                        /* Edit mode row */
                        <tr key={pkg.id} className="bg-amber-50/40 dark:bg-amber-900/10">
                          <td className="py-2 pe-3">
                            <input
                              type="text"
                              value={editingPkg.name_en}
                              onChange={e => setEditingPkg(p => ({ ...p, name_en: e.target.value }))}
                              className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm dark:border-amber-600 dark:bg-slate-800 dark:text-white"
                              placeholder="Carton"
                              autoFocus
                            />
                          </td>
                          <td className="py-2 pe-3">
                            <input
                              type="text"
                              value={editingPkg.name_ar}
                              onChange={e => setEditingPkg(p => ({ ...p, name_ar: e.target.value }))}
                              dir="rtl"
                              className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm dark:border-amber-600 dark:bg-slate-800 dark:text-white"
                              placeholder="كرتون"
                            />
                          </td>
                          <td className="py-2 pe-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="text"
                                inputMode="decimal"
                                dir="ltr"
                                value={editingPkg.conversion_factor}
                                onChange={e => {
                                  const v = normalizeNumericInput(e.target.value).replace(/[^\d.]/g, "");
                                  const parts = v.split(".");
                                  setEditingPkg(p => ({ ...p, conversion_factor: parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : v }));
                                }}
                                className="w-20 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-center text-sm font-mono dark:border-amber-600 dark:bg-slate-800 dark:text-white"
                                placeholder="12"
                              />
                              <span className="text-xs text-slate-500">{baseUnit?.code}</span>
                            </div>
                          </td>
                          <td className="py-2 text-center text-xs text-slate-400">—</td>
                          <td className="py-2 text-center text-xs text-slate-400">—</td>
                          <td className="py-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleSaveEditPkg(pkg.id)}
                                disabled={pkgSaving}
                                title={isRTL ? "حفظ" : "Save"}
                                className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {pkgSaving ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPkgId(null)}
                                title={isRTL ? "إلغاء" : "Cancel"}
                                className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        /* Display mode row */
                        <tr key={pkg.id} className={`transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30 ${!pkg.is_active ? "opacity-50" : ""}`}>
                          <td className="py-3 pe-4 font-medium text-slate-800 dark:text-white">
                            {pkg.name_en}
                            {pkg.is_default && (
                              <Star className="ms-1.5 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            )}
                          </td>
                          <td className="py-3 pe-4 text-slate-500 dark:text-slate-400">
                            {pkg.name_ar || "—"}
                          </td>
                          <td className="py-3 text-center font-mono text-slate-700 dark:text-slate-200">
                            {parseFloat(pkg.conversion_factor).toLocaleString()}
                            <span className="ms-1 text-xs text-slate-400">{baseUnit?.code}</span>
                          </td>
                          <td className="py-3 text-center">
                            {pkg.is_active ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                {isRTL ? "نشط" : "Active"}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                {isRTL ? "موقف" : "Inactive"}
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            <button
                              type="button"
                              disabled={pkgSaving || pkg.is_default}
                              onClick={() => void handleSetDefaultPkg(pkg.id)}
                              title={pkg.is_default ? (isRTL ? "هذه العبوة الافتراضية" : "This is the default") : (isRTL ? "تعيين كافتراضي" : "Set as default")}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 transition disabled:cursor-default"
                              style={{
                                borderColor: pkg.is_default ? "#3b82f6" : "#cbd5e1",
                                background: pkg.is_default ? "#3b82f6" : "transparent",
                              }}
                            >
                              {pkg.is_default && <span className="h-2 w-2 rounded-full bg-white" />}
                            </button>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center justify-center gap-1">
                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPkgId(pkg.id);
                                  setEditingPkg({ name_en: pkg.name_en, name_ar: pkg.name_ar, conversion_factor: pkg.conversion_factor });
                                }}
                                title={isRTL ? "تعديل" : "Edit"}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {/* Toggle active */}
                              <button
                                type="button"
                                disabled={pkgSaving}
                                onClick={() => void handleTogglePkgActive(pkg.id, pkg.is_active)}
                                title={pkg.is_active ? (isRTL ? "إيقاف" : "Disable") : (isRTL ? "تفعيل" : "Enable")}
                                className={`rounded p-1.5 disabled:opacity-50 ${pkg.is_active ? "text-amber-500 hover:bg-amber-500/10" : "text-emerald-500 hover:bg-emerald-500/10"}`}
                              >
                                {pkg.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </button>
                              {/* Delete */}
                              <button
                                type="button"
                                disabled={pkgSaving}
                                onClick={() => void handleDeletePkg(pkg.id)}
                                title={isRTL ? "حذف" : "Delete"}
                                className="rounded p-1.5 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}

                    {/* ── New package form row ── */}
                    {addingPkg && (
                      <tr className="bg-emerald-50/40 dark:bg-emerald-900/10">
                        <td className="py-2 pe-3">
                          <input
                            type="text"
                            value={newPkg.name_en}
                            onChange={e => setNewPkg(p => ({ ...p, name_en: e.target.value }))}
                            className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-emerald-600 dark:bg-slate-800 dark:text-white"
                            placeholder="Carton"
                            autoFocus
                          />
                        </td>
                        <td className="py-2 pe-3">
                          <input
                            type="text"
                            value={newPkg.name_ar}
                            onChange={e => setNewPkg(p => ({ ...p, name_ar: e.target.value }))}
                            dir="rtl"
                            className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-emerald-600 dark:bg-slate-800 dark:text-white"
                            placeholder="كرتون"
                          />
                        </td>
                        <td className="py-2 pe-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              dir="ltr"
                              value={newPkg.conversion_factor}
                              onChange={e => {
                                const v = normalizeNumericInput(e.target.value).replace(/[^\d.]/g, "");
                                const parts = v.split(".");
                                setNewPkg(p => ({ ...p, conversion_factor: parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : v }));
                              }}
                              className="w-20 rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-center text-sm font-mono placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-emerald-600 dark:bg-slate-800 dark:text-white"
                              placeholder="12"
                            />
                            <span className="text-xs text-slate-500">{baseUnit?.code}</span>
                          </div>
                        </td>
                        <td className="py-2 text-center text-xs text-slate-400">—</td>
                        <td className="py-2 text-center text-xs text-slate-400">—</td>
                        <td className="py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleAddPkg()}
                              disabled={pkgSaving}
                              title={isRTL ? "حفظ" : "Save"}
                              className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {pkgSaving ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setAddingPkg(false); setNewPkg({ name_en: "", name_ar: "", conversion_factor: "" }); }}
                              title={isRTL ? "إلغاء" : "Cancel"}
                              className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* ── Empty state ── */}
                    {pkgs.length === 0 && !addingPkg && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center">
                          <Package2 className="mx-auto mb-2 h-10 w-10 text-slate-200 dark:text-slate-700" />
                          <p className="text-sm text-slate-400 dark:text-slate-500">
                            {isRTL ? "لا توجد عبوات بعد" : "No packages yet"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            {isRTL
                              ? "اضغط «إضافة عبوة» لإضافة كرتون أو علبة أو أي وحدة تعبئة"
                              : "Click «Add Package» to add a carton, box, or any packaging unit"}
                          </p>
                        </td>
                      </tr>
                    )}
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-4 sm:px-6 py-4 dark:border-slate-700 dark:bg-slate-800/30">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => goTo(0)}
                  disabled={isAddingNew || currentIndex <= 0}
                  className="rounded-lg p-2.5 sm:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                  title={isRTL ? "الأول" : "First"}
                >
                  <ChevronsLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(currentIndex - 1)}
                  disabled={isAddingNew || currentIndex <= 0}
                  className="rounded-lg p-2.5 sm:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                  title={isRTL ? "السابق" : "Previous"}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="min-w-[80px] sm:min-w-[120px] text-center text-sm text-slate-600 dark:text-slate-400">
                  {isAddingNew ? (isRTL ? "جديد" : "New") : `${currentIndex + 1} / ${totalCount}`}
                </span>
                <button
                  type="button"
                  onClick={() => goTo(currentIndex + 1)}
                  disabled={isAddingNew || currentIndex >= totalCount - 1}
                  className="rounded-lg p-2.5 sm:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                  title={isRTL ? "التالي" : "Next"}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(totalCount - 1)}
                  disabled={isAddingNew || currentIndex >= totalCount - 1}
                  className="rounded-lg p-2.5 sm:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700"
                  title={isRTL ? "الأخير" : "Last"}
                >
                  <ChevronsRight className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={currentId ? handleSave : handleCreate}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 sm:py-2 min-h-[44px] text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
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
