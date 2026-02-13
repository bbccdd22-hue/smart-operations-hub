export const DENOMS = [500, 200, 100, 50, 20, 10, 5, 1] as const;
export type Denom = (typeof DENOMS)[number];

export type DenomCounts = Record<Denom, number>;

export function denomTotal(counts: DenomCounts): number {
  return DENOMS.reduce((sum, d) => sum + (counts[d] || 0) * d, 0);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function variance(manual: number, system: number): number {
  return round2(manual - system);
}

