/**
 * Standardized ERP-style system codes for data models and hierarchy indexing.
 * [Ref: 2026-02-13] Mirrors backend/config/constants.py for full transparency.
 */

/** Sales & Product Data */
export const SD1001 = "SD1001"; // DailySale
export const SD1002 = "SD1002"; // HourlySale
export const SP1003 = "SP1003"; // ProductSale - Prep List sales source
export const SU1004 = "SU1004"; // ExcelUpload

/** Production / Prep / BOM */
export const PR1001 = "PR1001"; // Recipe
export const PR1002 = "PR1002"; // Prep List (logical)
export const PR1003 = "PR1003"; // RecipeLine

/** Inventory & Units */
export const IU1002 = "IU1002"; // Unit - Prep List inventory units source
export const IU1003 = "IU1003"; // Ingredient
export const IU1004 = "IU1004"; // FoodicsProduct
export const IU1005 = "IU1005"; // BranchStock
export const IU1006 = "IU1006"; // StockMovement

/** Organization */
export const OR1001 = "OR1001"; // Branch
export const OR1002 = "OR1002"; // Brand
export const OR1003 = "OR1003"; // City
export const OR1004 = "OR1004"; // UserProfile

/** Shifts */
export const SH1001 = "SH1001"; // Shift
export const SH1002 = "SH1002"; // ShiftClosing

/** Accounting */
export const AC1001 = "AC1001"; // FoodicsSettlement
export const AC1002 = "AC1002"; // FoodicsPaymentRecord
export const AC1003 = "AC1003"; // DailyAccountingStatus

/** Prep List (PR1002) data sources - used when generating prep list */
export const PREP_LIST_SALES_SOURCE = SP1003;   // ProductSale
export const PREP_LIST_UNITS_SOURCE = IU1002;  // Unit

export type SystemCodeNode = {
  code: string;
  label: string;
  labelAr?: string;
  model?: string;
  children?: SystemCodeNode[];
};

/** Hierarchy tree for System Settings display */
export const SYSTEM_CODE_HIERARCHY: SystemCodeNode[] = [
  {
    code: "SP",
    label: "Sales & Product",
    labelAr: "المبيعات والمنتجات",
    children: [
      { code: SD1001, label: "Daily Sale", labelAr: "مبيعات يومية", model: "imports.DailySale" },
      { code: SD1002, label: "Hourly Sale", labelAr: "مبيعات ساعية", model: "imports.HourlySale" },
      { code: SP1003, label: "Product Sale", labelAr: "مبيعات المنتجات", model: "imports.ProductSale" },
      { code: SU1004, label: "Excel Upload", labelAr: "رفع Excel", model: "imports.ExcelUpload" },
    ],
  },
  {
    code: "PR",
    label: "Production / Prep List",
    labelAr: "الإنتاج / قائمة التحضير",
    children: [
      { code: PR1001, label: "Recipe (BOM)", labelAr: "الوصفة", model: "inventory.Recipe" },
      { code: PR1002, label: "Prep List", labelAr: "قائمة التحضير", model: undefined },
      { code: PR1003, label: "Recipe Line", labelAr: "سطر الوصفة", model: "inventory.RecipeLine" },
    ],
  },
  {
    code: "IU",
    label: "Inventory & Units",
    labelAr: "المخزون والوحدات",
    children: [
      { code: IU1002, label: "Unit", labelAr: "الوحدة", model: "inventory.Unit" },
      { code: IU1003, label: "Ingredient", labelAr: "المكون", model: "inventory.Ingredient" },
      { code: IU1004, label: "Product", labelAr: "المنتج", model: "inventory.FoodicsProduct" },
      { code: IU1005, label: "Branch Stock", labelAr: "مخزون الفرع", model: "inventory.BranchStock" },
      { code: IU1006, label: "Stock Movement", labelAr: "حركة المخزون", model: "inventory.StockMovement" },
    ],
  },
  {
    code: "OR",
    label: "Organization",
    labelAr: "التنظيم",
    children: [
      { code: OR1001, label: "Branch", labelAr: "الفرع", model: "org.Branch" },
      { code: OR1002, label: "Brand", labelAr: "العلامة", model: "org.Brand" },
      { code: OR1003, label: "City", labelAr: "المدينة", model: "org.City" },
      { code: OR1004, label: "User Profile", labelAr: "ملف المستخدم", model: "org.UserProfile" },
    ],
  },
  {
    code: "SH",
    label: "Shifts",
    labelAr: "الشيفتات",
    children: [
      { code: SH1001, label: "Shift", labelAr: "الشيفت", model: "shifts.Shift" },
      { code: SH1002, label: "Shift Closing", labelAr: "إقفال الشيفت", model: "shifts.ShiftClosing" },
    ],
  },
  {
    code: "AC",
    label: "Accounting",
    labelAr: "المحاسبة",
    children: [
      { code: AC1001, label: "Foodics Settlement", labelAr: "تسوية Foodics", model: "accounting.FoodicsSettlement" },
      { code: AC1002, label: "Foodics Payment", labelAr: "دفع Foodics", model: "accounting.FoodicsPaymentRecord" },
      { code: AC1003, label: "Daily Accounting", labelAr: "المحاسبة اليومية", model: "accounting.DailyAccountingStatus" },
    ],
  },
];
