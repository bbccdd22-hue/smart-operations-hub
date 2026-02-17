/**
 * ربط العلامات التجارية بأكواد دليل الحسابات
 * المصدر الوحيد: حقول chart_rev_prefix و chart_exp_prefix من لوحة الإعدادات
 * لا مسميات يدوية – كل الربط من الإعدادات فقط
 */
import type { Brand } from "./api";

export type BrandChartCodes = { rev: string; exp: string };

/**
 * إرجاع أكواد الدليل المحاسبي للعلامة من الإعدادات فقط
 * إذا لم تكن chart_rev_prefix و chart_exp_prefix معرّفتين، يُرجع null (لا يظهر في التقارير)
 */
export function getBrandChartCodes(brand: Brand): BrandChartCodes | null {
  const rev = (brand.chart_rev_prefix ?? "").trim();
  const exp = (brand.chart_exp_prefix ?? "").trim();
  if (!rev || !exp) return null;
  return { rev, exp };
}

/**
 * الكود المستخدم للبحث والفلترة برمجياً فقط (لا يظهر في الواجهة)
 */
export function brandDisplayCode(brand: Brand): string {
  const code = (brand.brand_code ?? "").trim();
  if (code) return code;
  return brand.slug || brand.name;
}

export function branchDisplayCode(branch: { branch_code?: string; code: string; name: string }): string {
  const code = (branch.branch_code ?? "").trim();
  if (code) return code;
  return branch.code || branch.name;
}

/**
 * @deprecated استخدم getBrandDisplayName و getBranchDisplayName من localization.ts
 * الاسم حسب لغة النظام (عربي/إنجليزي)
 */
export function brandDisplayLabel(brand: Brand, lang?: string): string {
  const isAr = lang === "ar" || (typeof lang === "string" && lang.startsWith("ar"));
  const ar = (brand as { name_ar?: string }).name_ar?.trim();
  const en = brand.name?.trim();
  if (isAr) return ar || en || "";
  return en || ar || "";
}

export function branchDisplayLabel(branch: { name_ar?: string; name: string }, lang?: string): string {
  const isAr = lang === "ar" || (typeof lang === "string" && lang.startsWith("ar"));
  const ar = branch.name_ar?.trim();
  const en = branch.name?.trim();
  if (isAr) return ar || en || "";
  return en || ar || "";
}

/**
 * التحقق من تطابق قيمة مع قائمة الأكواد المعتمدة (من الإعدادات)
 */
export function normalizeToCanonicalName(
  value: string,
  canonicalList: string[]
): string | null {
  const v = (value || "").trim();
  if (!v) return null;
  const vNorm = v.toLowerCase().replace(/\s+/g, " ");
  for (const c of canonicalList) {
    const cNorm = c.toLowerCase().replace(/\s+/g, " ");
    if (cNorm === vNorm) return c;
  }
  return null;
}
