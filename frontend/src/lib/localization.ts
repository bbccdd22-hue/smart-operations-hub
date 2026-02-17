/**
 * Global Translation Helper – العرض الذكي حسب لغة النظام
 * يفحص لغة النظام المختارة ويعرض الاسم المناسب (عربي/إنجليزي)
 * القاعدة: لا تظهر الأكواد الرقمية في الواجهة أبداً
 */

import type { Brand, Branch } from "./api";

/** عنصر له اسم بالعربية والإنجليزية */
export type LocalizedNameItem = {
  name?: string;
  name_ar?: string;
  name_en?: string;
};

/**
 * استرجاع الاسم المعروض حسب لغة النظام
 * العربية → name_ar أو name
 * الإنجليزية → name أو name_en أو name_ar
 */
export function getLocalizedName(item: LocalizedNameItem | null | undefined, lang: string): string {
  if (!item) return "";
  const isAr = lang === "ar" || lang.startsWith("ar");
  const ar = (item.name_ar ?? "").trim();
  const en = (item.name_en ?? item.name ?? "").trim();
  if (isAr) return ar || en || "";
  return en || ar || "";
}

/**
 * اسم العلامة التجارية حسب اللغة – للقوائم المنسدلة والتقارير
 */
export function getBrandDisplayName(brand: Brand | null | undefined, lang: string): string {
  if (!brand) return "";
  const isAr = lang === "ar" || lang.startsWith("ar");
  const ar = (brand.name_ar ?? "").trim();
  const en = (brand.name ?? "").trim();
  if (isAr) return ar || en || "";
  return en || ar || "";
}

/**
 * اسم الفرع حسب اللغة – للقوائم المنسدلة والتقارير
 */
export function getBranchDisplayName(branch: Branch | null | undefined, lang: string): string {
  if (!branch) return "";
  const isAr = lang === "ar" || lang.startsWith("ar");
  const ar = (branch.name_ar ?? "").trim();
  const en = (branch.name ?? "").trim();
  if (isAr) return ar || en || "";
  return en || ar || "";
}
