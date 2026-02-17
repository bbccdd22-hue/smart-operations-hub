/**
 * PR1002: Convert raw base quantity to workable units (كرتون، علبة، إلخ).
 * Mirrors backend inventory/services.py calculate_workable_units.
 * Rounds to whole or max 1 decimal (10.02 → 10).
 */
function roundWorkable(val: number): string {
  if (val === Math.floor(val)) return String(Math.floor(val));
  const r = Math.round(val * 10) / 10;
  return r === Math.floor(r) ? String(Math.floor(r)) : String(r);
}

export function calculateWorkableUnits(
  totalBaseQty: number,
  conversionFactor: number,
  packageUnitAr: string,
  packageUnitEn: string,
  baseUnitAr = "وحدة",
  baseUnitEn = "units"
): { display_ar: string; display_en: string } {
  if (conversionFactor <= 0) {
    return {
      display_ar: `${roundWorkable(totalBaseQty)} ${baseUnitAr}`,
      display_en: `${roundWorkable(totalBaseQty)} ${baseUnitEn}`,
    };
  }
  const fullPackages = Math.floor(totalBaseQty / conversionFactor);
  const remainingQty = totalBaseQty % conversionFactor;
  const qtyStr = remainingQty === 0 ? roundWorkable(totalBaseQty / conversionFactor) : String(fullPackages);
  const remStr = roundWorkable(remainingQty);

  if (remainingQty === 0) {
    return {
      display_ar: `${qtyStr} ${packageUnitAr}`,
      display_en: `${qtyStr} ${packageUnitEn}`,
    };
  }
  return {
    display_ar: `${qtyStr} ${packageUnitAr} و ${remStr} ${baseUnitAr}`,
    display_en: `${qtyStr} ${packageUnitEn} and ${remStr} ${baseUnitEn}`,
  };
}
