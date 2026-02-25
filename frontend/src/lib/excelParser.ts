/**
 * محرك تحليل ملفات الإكسل المالية
 * مع التحقق من مطابقة المسميات (العلامة، الفرع) مع الإعدادات فقط
 * مطابقة صارمة: يجمع الأرقام فقط من أعمدة الاسم الصريح (المبلغ، Amount، المبيعات، المصاريف، رصيد)
 * يتجاهل أعمدة أرقام الهوية/القيد/آيبان، ويطبق Trim على أسماء الأعمدة
 */
import * as XLSX from "xlsx";
import { normalizeToCanonicalName } from "./brandChartMapping";

const CODE_PATTERN = /^[0-9]{1,10}$/;

/** أعمدة المبلغ المسموح بها فقط – اسم صريح بعد trim */
const ALLOWED_AMOUNT_HEADERS = new Set([
  "المبلغ", "amount", "مبلغ", "المبيعات", "المصاريف", "رصيد", "balance",
]);

/** أعمدة تُستبعد دائماً (رقم هوية، قيد، آيبان) حتى لو تحتوي أرقاماً */
const EXCLUDED_HEADER_PATTERNS = [
  "رقم الهوية", "رقم القيد", "آيبان", "iban", "identity", "journal",
  "كود القيد", "رقم الحساب المصرفي", "account number",
];

export const REQUIRED_AMOUNT_COLUMN_NAMES = "المبلغ، Amount، المبيعات، المصاريف، رصيد، balance";

export type ParseExcelResult = {
  balances: Record<string, number>;
  rows?: CostAuditRow[];
  nameErrors: string[];
  validatedBrandCol: number | null;
  validatedBranchCol: number | null;
};

/** صف تفصيلي من الإكسل – لسجل تدقيق التكاليف */
export type CostAuditRow = {
  code: string;
  account_name: string;
  amount: number;
  description: string;
};

function trimHeader(h: string | number): string {
  return String(h ?? "").trim().replace(/\s+/g, " ");
}

function isExcludedColumn(h: string): boolean {
  const lower = h.toLowerCase();
  return EXCLUDED_HEADER_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/** قيمة تبدو كرقم تعريف أو آيبان – لا تُجمع */
function looksLikeIdOrIban(val: number): boolean {
  if (val === 0 || !Number.isFinite(val)) return false;
  const s = String(Math.abs(Math.floor(val)));
  return s.length >= 8;
}

function findAmountColumn(header: (string | number)[]): { col: number; name: string } | null {
  for (let c = 0; c < header.length; c++) {
    const raw = header[c] ?? "";
    const h = trimHeader(raw);
    if (!h) continue;
    if (isExcludedColumn(h)) continue;
    const normalized = h.toLowerCase().replace(/\s+/g, " ").trim();
    if (ALLOWED_AMOUNT_HEADERS.has(normalized) || ALLOWED_AMOUNT_HEADERS.has(h)) {
      return { col: c, name: h };
    }
    if (["مبلغ", "amount", "رصيد", "balance", "المبيعات", "المصاريف", "المبلغ"].some((p) => normalized === p || normalized.includes(p))) {
      return { col: c, name: h };
    }
  }
  return null;
}

function findColumn(header: (string | number)[], patterns: string[]): number {
  for (let c = 0; c < header.length; c++) {
    const h = trimHeader(header[c] ?? "").toLowerCase();
    if (patterns.some((p) => h.includes(p.toLowerCase()))) return c;
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

        const amountMatch = findAmountColumn(header);
        if (!amountMatch) {
          return reject(
            new Error(
              `لم يتم التعرف على عمود المبلغ أو الرصيد، يرجى التأكد من اسم العمود في ملف الإكسل. الأعمدة المقبولة: ${REQUIRED_AMOUNT_COLUMN_NAMES}`
            )
          );
        }
        const amountCol = amountMatch.col;

        let codeCol = findColumn(header, ["رقم", "code", "حساب"]);
        if (codeCol < 0) codeCol = 0;
        const nameCol = findColumn(header, ["اسم", "name", "حساب"]);
        const brandCol = findColumn(header, ["العلامة", "علامة", "brand", "براند"]);
        const branchCol = findColumn(header, ["الفرع", "فرع", "branch"]);

        const auditRows: CostAuditRow[] = [];

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
          if (isNaN(num)) continue;
          if (looksLikeIdOrIban(num)) continue;
          balances[code] = num;
          const accountName = nameCol >= 0 ? String(row[nameCol] ?? "").trim() : "";
          auditRows.push({
            code,
            account_name: accountName,
            amount: num,
            description: accountName || code,
          });
        }

        resolve({
          balances,
          rows: auditRows,
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
