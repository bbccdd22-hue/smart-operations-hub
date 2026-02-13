/**
 * Fixed brand list - always visible in Brand filter regardless of uploaded data.
 * Metrics show 0/— when no data exists for a selected brand.
 * Slugs must match backend org.models.Brand (seed_brands).
 */
export const FIXED_BRANDS = [
  { name: "8OZ", slug: "8oz" },
  { name: "TEA PLUS", slug: "tea-plus" },
  { name: "SWEET BREAD", slug: "sweet-bread" },
  { name: "HEMI", slug: "hemi" },
  { name: "CHART", slug: "chart" },
  { name: "BLANCA", slug: "blanca" },
] as const;

export type FixedBrand = (typeof FIXED_BRANDS)[number];
