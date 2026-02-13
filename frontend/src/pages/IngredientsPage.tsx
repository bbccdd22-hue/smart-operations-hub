import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../contexts/NotificationContext";
import {
  uploadProductCatalog,
  uploadRecipeBOM,
  type ProductCatalogUploadResult,
  type RecipeBOMUploadResult,
} from "../lib/api";

type UploadType = "product_catalog" | "bom";

export default function IngredientsPage() {
  const { t } = useTranslation();
  const { addToast } = useNotifications() ?? { addToast: () => {} };
  const [uploadType, setUploadType] = useState<UploadType>("product_catalog");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [result, setResult] = useState<ProductCatalogUploadResult | RecipeBOMUploadResult | null>(
    null
  );

  const isProductCatalog = uploadType === "product_catalog";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setStatus("uploading");
    setResult(null);
    try {
      const json = isProductCatalog
        ? await uploadProductCatalog(file)
        : await uploadRecipeBOM(file);
      setResult(json);
      setStatus("success");
      if (isProductCatalog) {
        addToast(t("uploadSuccess"), t("productCatalogSuccess"));
      }
    } catch (err: unknown) {
      setResult({
        errors: [{ row: 0, error: err instanceof Error ? err.message : "Upload failed" }],
      });
      setStatus("error");
    }
  };

  const productCatalogResult = result as ProductCatalogUploadResult;
  const bomResult = result as RecipeBOMUploadResult;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Recipe & Inventory Management
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight dark:text-white">
          Bill of Materials (BOM)
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Manage products, ingredients, and recipe mappings. Upload Product Catalog first, then
          link ingredients via BOM.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-4">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setUploadType("product_catalog");
              setFile(null);
              setResult(null);
              setStatus("idle");
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              uploadType === "product_catalog"
                ? "bg-[#00b074]/20 text-[#00b074] dark:bg-emerald-500/30 dark:text-emerald-200"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {t("productCatalogUpload")}
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadType("bom");
              setFile(null);
              setResult(null);
              setStatus("idle");
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              uploadType === "bom"
                ? "bg-[#00b074]/20 text-[#00b074] dark:bg-emerald-500/30 dark:text-emerald-200"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {t("bomUpload")}
          </button>
        </div>

        {isProductCatalog ? (
          <>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Product Catalog (Saif format)
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Headers: المنتج | الوحدة | كود تعريف المنتج | السعر غير شامل الضريبة
            </p>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              BOM / Recipe (Product → Ingredient mappings)
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Template columns: Product | Ingredient | Qty | Unit (e.g. g, kg, pcs, ml, l)
            </p>
          </>
        )}

        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Excel file
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="block text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-white dark:file:bg-slate-600"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="submit"
            disabled={!file || status === "uploading"}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-700"
          >
            {status === "uploading" ? "Uploading…" : "Upload"}
          </button>
        </form>

        {result && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              status === "success"
                ? "bg-emerald-50 dark:bg-emerald-900/20"
                : "bg-amber-50 dark:bg-amber-900/20"
            }`}
          >
            {isProductCatalog && status === "success" && (
              <p className="font-medium text-emerald-800 dark:text-emerald-200">
                {t("productCatalogSuccess")}
              </p>
            )}
            {isProductCatalog && productCatalogResult.total_processed != null && (
              <p className="mt-1">
                Processed: {productCatalogResult.created ?? 0} created,{" "}
                {productCatalogResult.updated ?? 0} updated.
              </p>
            )}
            {!isProductCatalog && bomResult.created_products != null && (
              <p>
                Created: {bomResult.created_products} products,{" "}
                {bomResult.created_ingredients} ingredients, {bomResult.created_lines} recipe lines.
              </p>
            )}
            {(productCatalogResult.errors?.length ?? bomResult.errors?.length) ? (
              <ul className="mt-2 list-disc pl-4">
                {(isProductCatalog ? productCatalogResult.errors : bomResult.errors)!
                  .slice(0, 5)
                  .map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.error}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
        <strong>
          {isProductCatalog ? "Product Catalog template (Excel):" : "BOM template (Excel):"}
        </strong>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs dark:bg-slate-900">
          {isProductCatalog
            ? `المنتج        | الوحدة | كود تعريف المنتج | السعر غير شامل الضريبة
قهوة عربية   | pcs   | COFFEE-001       | 15.00 SAR
شاي أخضر     | pcs   | TEA-002         | 12.50`
            : `Product    | Ingredient | Qty   | Unit
Burger     | Bun       | 1     | pcs
Burger     | Beef      | 150   | g
Burger     | Sauce     | 20    | g
Coffee     | Beans     | 18    | g
Coffee     | Milk      | 100   | ml`}
        </pre>
      </div>
    </div>
  );
}
