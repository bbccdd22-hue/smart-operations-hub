/**
 * محرك التجميع التصاعدي (Bottom-Up Aggregation) – نظام سيف المالي
 * الحسابات الرئيسية = مجموع أبنائها المباشرين فقط
 * لا تُستخدم الأرصدة المخزنة للحسابات الأب – تُحسب من الأبناء دائماً
 * ضمان عدم ازدواجية الحسابات في التقارير
 */

export type AccountWithBalance = {
  code: string;
  level: number;
  balance?: string | number;
  name_ar?: string;
  name_en?: string;
};

/** استخراج الرصيد العددي من الحساب */
function toBalance(acc: AccountWithBalance): number {
  const v = acc.balance;
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * الحصول على الأبناء المباشرين لحساب معيّن ضمن المجموعة
 * الابن المباشر: يبدأ كوده بكود الأب ولا يوجد حساب وسيط بينهما
 */
function getDirectChildren(parentCode: string, all: AccountWithBalance[]): AccountWithBalance[] {
  return all.filter((c) => {
    if (c.code === parentCode || !c.code.startsWith(parentCode)) return false;
    const childCode = c.code;
    const hasMiddle = all.some(
      (m) =>
        m.code !== parentCode &&
        m.code !== childCode &&
        childCode.startsWith(m.code) &&
        m.code.startsWith(parentCode) &&
        m.code.length > parentCode.length &&
        m.code.length < childCode.length
    );
    return !hasMiddle;
  });
}

/**
 * الحسابات التي ليس لها أبناء في المجموعة (للعرض بدون ازدواجية)
 */
export function getLeafAccounts<T extends AccountWithBalance>(accounts: T[]): T[] {
  return accounts.filter((acc) => getDirectChildren(acc.code, accounts).length === 0);
}

/** عنصر من دليل الحسابات للأغراض التحقق */
export type ChartCodeRef = { code: string; name_ar?: string; name_en?: string; level?: number };

/**
 * التحقق من توافق الإجماليات المرفوعة مع مجموع الحسابات الفرعية
 * إذا اختلف إجمالي حساب أب عن مجموع أبنائه، يُرجع تحذيراً
 */
export function validateBalancesHierarchy(
  balances: Record<string, number>,
  chartAccounts: ChartCodeRef[]
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const codes = new Set(Object.keys(balances));
  const byCode = new Map(chartAccounts.map((a) => [a.code, a]));

  function getDirectChildCodes(parentCode: string): string[] {
    return codes.size === 0
      ? []
      : [...codes].filter((childCode) => {
          if (childCode === parentCode || !childCode.startsWith(parentCode)) return false;
          const hasMiddle = [...codes].some(
            (m) =>
              m !== parentCode &&
              m !== childCode &&
              childCode.startsWith(m) &&
              m.startsWith(parentCode) &&
              m.length > parentCode.length &&
              m.length < childCode.length
          );
          return !hasMiddle;
        });
  }

  const EPSILON = 0.02;
  for (const code of codes) {
    const childCodes = getDirectChildCodes(code);
    if (childCodes.length === 0) continue;
    const parentVal = balances[code] ?? 0;
    const childSum = childCodes.reduce((s, c) => s + (balances[c] ?? 0), 0);
    if (Math.abs(parentVal - childSum) > EPSILON) {
      const acc = byCode.get(code);
      const name = acc?.name_ar || acc?.name_en || code;
      warnings.push(
        `تنبيه: يوجد فرق في إجمالي حساب [${name}] (${code}). المرفوع: ${parentVal.toLocaleString()}، المجموع من التفاصيل: ${childSum.toLocaleString()}، يرجى مراجعة المدخلات`
      );
    }
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * تطبيق منطق Parent-Child على مجموعة حسابات
 * النتيجة: كل حساب أب يحصل على رصيد = مجموع أبنائه فقط (لا يضم رصيده المخزن)
 */
export function applyParentChildAggregation<T extends AccountWithBalance>(accounts: T[]): T[] {
  if (accounts.length === 0) return accounts;

  const sorted = [...accounts].sort((a, b) => (b.level ?? 1) - (a.level ?? 1));

  const computed = new Map<string, number>();
  for (const acc of sorted) {
    const children = getDirectChildren(acc.code, accounts);
    const childSum = children.reduce((s, c) => s + (computed.get(c.code) ?? toBalance(c)), 0);
    if (children.length > 0) {
      computed.set(acc.code, childSum);
    } else {
      computed.set(acc.code, toBalance(acc));
    }
  }

  return accounts.map((acc) => {
    const bal = computed.get(acc.code) ?? toBalance(acc);
    return {
      ...acc,
      balance: bal,
    } as T;
  });
}

/** نموذج تنبيه فرق الإجمالي */
export type AggregationMismatch = {
  code: string;
  name_ar: string;
  uploadedTotal: number;
  computedSum: number;
  diff: number;
};

/** عتبة الاختلاف المسموح (للأخطاء العائمة) */
const MISMATCH_EPSILON = 0.02;

/**
 * التحقق من فرق الإجماليات: إجمالي الحساب المرفوع ≠ مجموع الحسابات الفرعية
 * يُستخدم عند رفع الإكسل لإظهار تنبيه: "تنبيه: يوجد فرق في إجمالي حساب [اسم]"
 */
export function validateAggregationMismatches(
  balances: Record<string, number>,
  chartAccounts: Array<{ code: string; name_ar?: string; level?: number }>
): AggregationMismatch[] {
  const mismatches: AggregationMismatch[] = [];
  const chartSet = chartAccounts.map((a) => ({ code: a.code, name_ar: a.name_ar ?? "", level: a.level ?? 1 }));

  const allWithBalance = chartSet.map((c) => ({ code: c.code, level: c.level, balance: balances[c.code] ?? 0 }));
  for (const parent of chartSet) {
    const parentBal = balances[parent.code];
    if (parentBal == null) continue;

    const children = getDirectChildren(parent.code, allWithBalance);
    if (children.length === 0) continue;
    const hasChildInFile = children.some((c) => (balances[c.code] ?? 0) !== 0);
    if (!hasChildInFile) continue;

    const childSum = children.reduce((s, c) => s + (typeof c.balance === "number" ? c.balance : parseFloat(String(c.balance ?? 0)) || 0), 0);
    const diff = Math.abs(parentBal - childSum);
    if (diff > MISMATCH_EPSILON) {
      mismatches.push({
        code: parent.code,
        name_ar: parent.name_ar || parent.code,
        uploadedTotal: parentBal,
        computedSum: childSum,
        diff,
      });
    }
  }
  return mismatches;
}

/**
 * فلتر الحسابات حسب مستوى العرض: المستوى 1 = نواتج الجمع النهائية فقط، المستوى 5 = كافة التفاصيل
 */
export function filterAccountsByDisplayLevel<T extends { level?: number }>(
  accounts: T[],
  displayLevel: number
): T[] {
  return accounts.filter((a) => (a.level ?? 1) <= displayLevel);
}
