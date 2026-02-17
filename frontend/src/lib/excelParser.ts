/**
 * محرك تحليل ملفات الإكسل المالية
 * مع التحقق من مطابقة المسميات (العلامة، الفرع) مع الإعدادات فقط
 */
import * as XLSX from "xlsx";
import { normalizeToCanonicalName } from "./brandChartMapping";

const CODE_PATTERN = /^[0-9]{1,10}$/;

export type ParseExcelResult = {
  balances: Record<string, number>;
  nameErrors: string[];
  validatedBrandCol: number | null;
  validatedBranchCol: number | null;
};

function findColumn(header: (string | number)[], patterns: string[]): number {
  for (let c = 0; c < header.length; c++) {
    const h = String(header[c] ?? "").toLowerCase();
    if (patterns.some((p) => h.includes(p))) return c;
  }
  return -1;
}

/**
 * استخراج { code: amount } مع التحقق من المسميات إن وُجدت
 * canonicalBrands, canonicalBranches: من لوحة الإعدادات (Single Source of Truth)
 */
export function parseExcelToBalancesWithValidation(
  file: File,
  canonicalBrands: string[],
  canonicalBranches: string[]
): Promise<ParseExcelResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return reject(new Error("No data"));
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
        const balances: Record<string, number> = {};
        const nameErrors: string[] = [];
        const header = (rows[0] || []) as (string | number)[];

        let codeCol = findColumn(header, ["رقم", "code", "حساب"]);
        if (codeCol < 0) codeCol = 0;
        let amountCol = findColumn(header, ["رصيد", "balance", "مبلغ", "amount"]);
        if (amountCol < 0) amountCol = 1;
        const brandCol = findColumn(header, ["العلامة", "علامة", "brand", "براند"]);
        const branchCol = findColumn(header, ["الفرع", "فرع", "branch"]);

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r] as (string | number)[];
          const rowNum = r + 1;

          if (brandCol >= 0 && canonicalBrands.length > 0) {
            const val = String(row[brandCol] ?? "").trim();
            if (val) {
              const matched = normalizeToCanonicalName(val, canonicalBrands);
              if (!matched) {
                nameErrors.push(`سطر ${rowNum}: العلامة "${val}" غير مسجلة في الإعدادات`);
              }
            }
          }
          if (branchCol >= 0 && canonicalBranches.length > 0) {
            const val = String(row[branchCol] ?? "").trim();
            if (val) {
              const matched = normalizeToCanonicalName(val, canonicalBranches);
              if (!matched) {
                nameErrors.push(`سطر ${rowNum}: الفرع "${val}" غير مسجل في الإعدادات`);
              }
            }
          }

          let code = String(row[codeCol] ?? "").trim().replace(/\.0+$/, "");
          if (code.includes(".")) code = code.split(".")[0];
          if (!CODE_PATTERN.test(code)) continue;
          const num = parseFloat(String(row[amountCol] ?? 0));
          if (!isNaN(num)) balances[code] = num;
        }

        resolve({
          balances,
          nameErrors,
          validatedBrandCol: brandCol >= 0 ? brandCol : null,
          validatedBranchCol: branchCol >= 0 ? branchCol : null,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsBinaryString(file);
  });
}

/** نسخة مبسطة للتوافق مع الكود الحالي – بدون تحقق من المسميات */
export function parseExcelToBalances(file: File): Promise<Record<string, number>> {
  return parseExcelToBalancesWithValidation(file, [], []).then((r) => r.balances);
}

/**
 * إنشاء وتحميل ملف إكسل نموذجي لقائمة الدخل – متوافق مع محرك الرفع
 * الرؤوس: كود الحساب، اسم الحساب، العلامة، الفرع، المستوى، رصيد
 */
export function downloadSaifIncomeTemplate(): void {
  const headers: string[][] = [["كود الحساب", "اسم الحساب", "العلامة", "الفرع", "المستوى", "رصيد"]];
  const rows: string[][] = [
    ["0401", "إيرادات المبيعات", "", "", "المستوى الثاني", "0.00"],
    ["040101", "مبيعات الفروع", "", "", "المستوى الثالث", "0.00"],
    ["0501", "تكلفة المبيعات", "", "", "المستوى الثاني", "0.00"],
    ["0502", "مصروفات إدارية وعمومية", "", "", "المستوى الثاني", "0.00"],
    ["050201", "رواتب وأجور", "", "", "المستوى الثالث", "0.00"],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "قائمة الدخل");
  XLSX.writeFile(workbook, "نموذج_قائمة_الدخل_سيف_المالي.xlsx");
}
