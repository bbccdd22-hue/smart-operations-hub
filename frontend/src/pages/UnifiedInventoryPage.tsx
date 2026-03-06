/**
 * المستودع الذكي الموحد – Unified Smart Inventory (V2)
 * Single entry point for all inventory management.
 * Route: /inventory/ingredients
 * Category Tabs: All | Raw Materials | Supplies | Packaging (items with multiple packages)
 * Default Unit from Item File is shown with visual highlight when set.
 */
import { useCallback, useEffect, useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { IU1002, IU1003, PR1002 } from "../lib/SystemCodes";
import { calculateWorkableUnits } from "../lib/calculateWorkableUnits";
import {
  fetchInventoryUnits,
  fetchIngredients,
  createIngredient,
  updateIngredient,
  uploadProductCatalog,
  uploadRecipeBOM,
  logActivity,
  type ManageIngredient,
  type InventoryUnit,
  type ProductCatalogUploadResult,
  type RecipeBOMUploadResult,
} from "../lib/api";
import { useNotifications } from "../contexts/NotificationContext";

function normalizeNumericInput(val: string): string {
  const arabicToWestern: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return val.split("").map((c) => arabicToWestern[c] ?? c).join("");
}

/** Modern Category Tabs per user spec */
const CATEGORY_TABS = [
  { value: "", label: "All Items", labelAr: "كل الأصناف", icon: "📦" },
  { value: "raw_materials", label: "Raw Materials", labelAr: "المواد الخام", icon: "🥛" },
  { value: "supplies", label: "Supplies & Cleaning", labelAr: "المنظفات والأدوات", icon: "🧼" },
  { value: "with_packages", label: "Packaging Units", labelAr: "وحدات التعبئة", icon: "🔄" },
] as const;

type TabValue = "" | "raw_materials" | "supplies" | "with_packages";

const VALID_TABS: TabValue[] = ["", "raw_materials", "supplies", "with_packages"];

function getFetchOpts(tab: TabValue): Parameters<typeof fetchIngredients>[0] {
  if (!tab) return undefined;
  if (tab === "with_packages") return { hasPackages: true };
  return { systemGroup: tab };
}

export default function UnifiedInventoryPage() {
  const { t, i18n } = useTranslation();
  const { addToast } = useNotifications() ?? { addToast: () => {} };
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = (searchParams.get("tab") ?? searchParams.get("system_group") ?? "") as TabValue;
  const normalizedTab = urlTab === "other" ? "supplies" : urlTab === "packaging" ? "with_packages" : urlTab;
  const isRTL = i18n.language === "ar";

  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [ingredients, setIngredients] = useState<ManageIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>(VALID_TABS.includes(normalizedTab as TabValue) ? (normalizedTab as TabValue) : "");
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

  const [uploadType, setUploadType] = useState<"product_catalog" | "bom">("product_catalog");
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadResult, setUploadResult] = useState<ProductCatalogUploadResult | RecipeBOMUploadResult | null>(null);

  const loadUnits = useCallback(async () => {
    const list = await fetchInventoryUnits();
    setUnits(list);
  }, []);

  const loadIngredients = useCallback(async () => {
    setLoading(true);
    try {
      const opts = getFetchOpts(activeTab);
      const list = await fetchIngredients(opts);
      setIngredients(list);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const tab = VALID_TABS.includes(normalizedTab as TabValue) ? (normalizedTab as TabValue) : "";
    setActiveTab(tab);
  }, [normalizedTab]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  const handleTabChange = (val: TabValue) => {
    setActiveTab(val);
    if (val) {
      setSearchParams({ tab: val });
    } else {
      setSearchParams({});
    }
  };

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
          package_conversion_factor: form.package_conversion_factor ? Number(form.package_conversion_factor) : null,
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
          package_conversion_factor: form.package_conversion_factor ? Number(form.package_conversion_factor) : undefined,
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
      setError(isRTL ? "يجب تحديد وحدة رئيسية لهذا الصنف لتجنب الخلل في التقارير" : "You must specify a primary unit for this item to avoid report errors");
      return;
    }
    if (hasNoPrimaryUnit && !smallestUnit) {
      setError(isRTL ? "لا توجد وحدات. أضف وحدات أولاً." : "No units available. Add units first.");
      return;
    }
    await performSave((form.base_unit_id || smallestUnit?.id) ?? 0);
  };

  const handleSaveWithFallbackUnit = async () => {
    const smallestUnit = units[0];
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

  const onSubmitUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploadStatus("uploading");
    setUploadResult(null);
    try {
      const json = uploadType === "product_catalog" ? await uploadProductCatalog(file) : await uploadRecipeBOM(file);
      setUploadResult(json);
      setUploadStatus("success");
      if (uploadType === "product_catalog") addToast(t("uploadSuccess"), t("productCatalogSuccess"));
      logActivity({
        action_type: "file_upload",
        page_path: "/inventory/ingredients",
        file_name: file?.name ?? "",
        description: uploadType === "product_catalog" ? "رفع قائمة المنتجات" : "رفع الوصفات (BOM)",
      });
      loadIngredients();
    } catch (err: unknown) {
      setUploadResult({ errors: [{ row: 0, error: err instanceof Error ? err.message : "Upload failed" }] });
      setUploadStatus("error");
    }
  };

  const filteredIngredients = ingredients.filter((i) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return i.name_en.toLowerCase().includes(q) || i.name_ar.includes(searchQuery) || (i.serial_code || "").toLowerCase().includes(q);
  });

  const productCatalogResult = uploadResult as ProductCatalogUploadResult;
  const bomResult = uploadResult as RecipeBOMUploadResult;

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-6">
      <div>
        <div className="text-xs text-white/50">{IU1002} / {IU1003} · {PR1002}</div>
        <h1 className="mt-1 text-2xl font-bold text-white">
          {isRTL ? "المستودع الذكي الموحد" : "Unified Smart Inventory"}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {isRTL ? "ما تشاهده = ما محفوظ في القاعدة. رابط مباشر بملف الصنف." : "What you see is what is saved. Direct link to Item File."}
        </p>
      </div>

      {/* Modern Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/20 pb-4">
        {CATEGORY_TABS.map((g) => (
          <button
            key={g.value || "all"}
            type="button"
            onClick={() => handleTabChange((g.value || "") as TabValue)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeTab === g.value ? "bg-emerald-500/30 text-emerald-200" : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <span>{g.icon}</span>
            <span>{isRTL ? g.labelAr : g.label}</span>
          </button>
        ))}
      </div>

      {/* BOM Upload */}
      <div className="float-card overflow-hidden rounded-2xl p-6">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setUploadType("product_catalog"); setFile(null); setUploadResult(null); setUploadStatus("idle"); }}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${uploadType === "product_catalog" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-500/30 dark:text-emerald-200" : "text-white/50 hover:bg-white/10"}`}
          >
            {t("productCatalogUpload")}
          </button>
          <button
            type="button"
            onClick={() => { setUploadType("bom"); setFile(null); setUploadResult(null); setUploadStatus("idle"); }}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${uploadType === "bom" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-500/30 dark:text-emerald-200" : "text-white/50 hover:bg-white/10"}`}
          >
            {t("bomUpload")}
          </button>
        </div>
        {uploadType === "product_catalog" ? (
          <>
            <h3 className="text-sm font-semibold text-white/90">Product Catalog (Saif format)</h3>
            <p className="mt-1 text-xs text-white/50">Headers: المنتج | الوحدة | كود تعريف المنتج | السعر غير شامل الضريبة</p>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-white/90">BOM / Recipe (Product → Ingredient mappings)</h3>
            <p className="mt-1 text-xs text-white/50">Template: Product | Product SKU | Ingredient | Ingredient Code | Qty | Unit</p>
          </>
        )}
        <form onSubmit={onSubmitUpload} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">Excel file</span>
            <input type="file" accept=".xlsx,.xls" className="block text-sm text-white file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-white" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" disabled={!file || uploadStatus === "uploading"} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-emerald-500">
            {uploadStatus === "uploading" ? "Uploading…" : "Upload"}
          </button>
        </form>
        {uploadResult && (
          <div className={`mt-4 rounded-lg p-3 text-sm ${uploadStatus === "success" ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
            {uploadType === "product_catalog" && uploadStatus === "success" && <p className="font-medium">{t("productCatalogSuccess")}</p>}
            {uploadType === "product_catalog" && productCatalogResult.total_processed != null && (
              <p className="mt-1">Processed: {productCatalogResult.created ?? 0} created, {productCatalogResult.updated ?? 0} updated.</p>
            )}
            {uploadType === "bom" && bomResult.created_products != null && (
              <p>Created: {bomResult.created_products} products, {bomResult.created_ingredients} ingredients, {bomResult.created_lines} recipe lines.</p>
            )}
            {(productCatalogResult.errors?.length ?? bomResult.errors?.length) ? (
              <ul className="mt-2 list-disc pl-4">
                {(uploadType === "product_catalog" ? productCatalogResult.errors : bomResult.errors)!.slice(0, 5).map((e, i) => (
                  <li key={i}>Row {e.row}: {e.error}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      {/* Ingredients table */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder={t("search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input min-h-[40px] flex-1 min-w-[200px] rounded-lg px-3 py-2 text-white placeholder:text-white/40"
          />
          <button
            type="button"
            onClick={() => { setFormOpen(true); setEditingId(null); setForm({ ...form, name_en: "", name_ar: "", base_unit_id: units[0]?.id ?? 0, serial_code: "", package_conversion_factor: "", package_name_en: "", package_name_ar: "" }); }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            + {t("addIngredient")}
          </button>
        </div>

        {formOpen && (
          <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <h3 className="mb-4 text-sm font-semibold text-emerald-200">{editingId ? t("editIngredient") : t("addIngredient")}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-white/70">{t("ingredientNameEn")}</label>
                <input type="text" value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} required className="glass-input w-full rounded-lg px-3 py-2 text-white" placeholder="Whole Milk" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/70">{t("ingredientNameAr")}</label>
                <input type="text" value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} className="glass-input w-full rounded-lg px-3 py-2 text-white" placeholder="حليب كامل الدسم" dir="rtl" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/70">{isRTL ? "الوحدة الرئيسية (Primary Unit)" : `${t("baseUnit")} (Primary Unit)`}</label>
                <select value={form.base_unit_id} onChange={(e) => setForm((f) => ({ ...f, base_unit_id: Number(e.target.value) }))} className="glass-input w-full rounded-lg px-3 py-2 text-white">
                  <option value={0}>{isRTL ? "— اختر الوحدة الرئيسية —" : "— Select primary unit —"}</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.code} ({u.name_en})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/70">{t("serialCode")}</label>
                <input type="text" value={form.serial_code} onChange={(e) => setForm((f) => ({ ...f, serial_code: e.target.value }))} className="glass-input w-full rounded-lg px-3 py-2 text-white" placeholder="RM-001" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/70">{t("systemGroup")}</label>
                <select value={form.system_group} onChange={(e) => setForm((f) => ({ ...f, system_group: e.target.value }))} className="glass-input w-full rounded-lg px-3 py-2 text-white">
                  <option value="raw_materials">Raw Materials</option>
                  <option value="packaging">Packaging</option>
                  <option value="other">Supplies / Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs text-white/60">{t("conversionLogic")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white/80">{t("every1")}</span>
                  <input type="text" value={form.package_name_en} onChange={(e) => setForm((f) => ({ ...f, package_name_en: e.target.value }))} className="glass-input w-24 rounded-lg px-2 py-1.5 text-sm text-white" placeholder="Carton" />
                  <span className="text-white/80">/</span>
                  <input type="text" value={form.package_name_ar} onChange={(e) => setForm((f) => ({ ...f, package_name_ar: e.target.value }))} className="glass-input w-24 rounded-lg px-2 py-1.5 text-sm text-white" placeholder="كرتون" dir="rtl" />
                  <span className="text-white/80">{t("contains")}</span>
                  <input
                    type="text" inputMode="decimal" dir="ltr" value={form.package_conversion_factor}
                    onChange={(e) => {
                      const v = normalizeNumericInput(e.target.value).replace(/[^\d.]/g, "");
                      const parts = v.split(".");
                      setForm((f) => ({ ...f, package_conversion_factor: parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : v }));
                    }}
                    className="glass-input w-20 rounded-lg px-2 py-1.5 text-sm text-white" placeholder="12"
                  />
                  <span className="text-white/80">{units.find((u) => u.id === form.base_unit_id)?.code ?? "unit"}</span>
                </div>
              </div>
            </div>
            {error && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-red-400">{error}</p>
                {showPrimaryUnitWarning && units.length > 0 && (
                  <button type="button" onClick={handleSaveWithFallbackUnit} disabled={saving} className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20">
                    {isRTL ? "تجاهل واستخدم أصغر وحدة تلقائياً" : "Ignore & use smallest unit"}
                  </button>
                )}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">{saving ? t("saving") : t("save")}</button>
              <button type="button" onClick={resetForm} className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">{t("cancel")}</button>
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
                  <th className="pb-3 pr-4">{isRTL ? "الوحدة الافتراضية" : "Default Unit"}</th>
                  <th className="pb-3 pr-4">{t("packageBreakdown")}</th>
                  <th className="pb-3 pr-4">{t("systemGroup")}</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredIngredients.map((ing) => {
                  const factor = ing.package_conversion_factor ? parseFloat(ing.package_conversion_factor) : 0;
                  const sampleQty = 28;
                  const workable = factor > 0 && (ing.package_name_en || ing.package_name_ar)
                    ? calculateWorkableUnits(sampleQty, factor, ing.package_name_ar || ing.package_name_en || "علبة", ing.package_name_en || ing.package_name_ar || "package", ing.base_unit_name_ar || "وحدة", ing.base_unit_name_en || "units")
                    : null;
                  const defaultUnit = ing.active_package_label || ing.base_unit_code || "—";
                  const hasDefaultPackage = !!ing.active_package_id;
                  return (
                    <tr key={ing.id} className="border-b border-white/10 text-white hover:bg-white/5">
                      <td className="py-3 pr-4 font-mono text-emerald-400">{ing.serial_code || ing.system_code}</td>
                      <td className="py-3 pr-4">
                        <span>{ing.name_en}</span>
                        {ing.name_ar && <span className="ml-2 text-white/60">| {ing.name_ar}</span>}
                      </td>
                      <td className="py-3 pr-4">{ing.base_unit_code}</td>
                      <td className="py-3 pr-4">
                        <span className={hasDefaultPackage ? "rounded bg-emerald-500/25 px-1.5 py-0.5 font-medium text-emerald-200" : "text-white/80"}>
                          {defaultUnit}
                        </span>
                        {hasDefaultPackage && <span className="ml-1 text-xs text-emerald-400">✓</span>}
                      </td>
                      <td className="py-3 pr-4">
                        {workable ? (
                          <span>{isRTL ? workable.display_ar : workable.display_en} <span className="text-white/50">(e.g. {sampleQty})</span></span>
                        ) : (
                          <span className="text-white/50">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 capitalize text-white/80">{ing.system_group.replace("_", " ")}</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Link to={`/inventory/item-file?id=${ing.id}`} className="rounded px-2 py-1 text-sky-400 hover:bg-white/10">
                            {isRTL ? "ملف الصنف (V2)" : "Item File (V2)"}
                          </Link>
                          <button type="button" onClick={() => startEdit(ing)} className="rounded px-2 py-1 text-emerald-400 hover:bg-white/10">
                            {t("edit")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredIngredients.length === 0 && <p className="py-8 text-center text-white/50">{t("noIngredients")}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
