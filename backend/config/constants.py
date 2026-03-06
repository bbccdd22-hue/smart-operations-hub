"""
Standardized ERP-style system codes for data models and hierarchy indexing.
[Ref: 2026-02-13] Full transparency for admin and traceability.

Hierarchy:
  Sales & Product (SD/SP) -> Production (PR) -> Inventory (IU) -> Org (OR)
"""

# --- Decimal Precision for Monetary and Exchange Rate Calculations ---
# Use for all new DecimalFields involving money or exchange rates.
# See docs/MIGRATION_GUIDE.md for gradually migrating existing DecimalFields.
DECIMAL_MAX_DIGITS = 20
DECIMAL_PLACES = 10
DECIMAL_PRECISION = (20, 10)  # Tuple for max_digits, decimal_places

# --- Sales & Product Data (SD = Sales Data, SP = Sales by Product) ---
SYSTEM_CODE_DAILY_SALE = "SD1001"      # DailySale - daily sales archive
SYSTEM_CODE_HOURLY_SALE = "SD1002"     # HourlySale - hourly sales archive
SYSTEM_CODE_PRODUCT_SALE = "SP1003"    # ProductSale - product-level sales (Prep List source)
SYSTEM_CODE_EXCEL_UPLOAD = "SU1004"    # ExcelUpload - raw upload archive

# --- Production / Prep / BOM (PR) ---
SYSTEM_CODE_RECIPE = "PR1001"         # Recipe - BOM header per product
SYSTEM_CODE_PREP_LIST = "PR1002"       # Prep List - logical output (Recipe + ProductSale)
SYSTEM_CODE_RECIPE_LINE = "PR1003"    # RecipeLine - BOM ingredient lines

# --- Inventory & Units (IU) ---
SYSTEM_CODE_UNIT = "IU1002"           # Unit - inventory units (g, ml, L, etc.)
SYSTEM_CODE_INGREDIENT = "IU1003"     # Ingredient - raw materials
SYSTEM_CODE_PRODUCT = "IU1004"        # FoodicsProduct - sellable products
SYSTEM_CODE_BRANCH_STOCK = "IU1005"   # BranchStock - branch inventory levels
SYSTEM_CODE_STOCK_MOVEMENT = "IU1006"  # StockMovement - inventory movements
SYSTEM_CODE_WASTE_LOG = "IU1007"       # WasteLog - waste tracking
SYSTEM_CODE_STOCK_TRANSFER = "IU1008"  # StockTransfer - inter-branch transfer

# --- Organization (OR) ---
SYSTEM_CODE_ORGANIZATION = "OR1000"   # Organization - top-level tenant
SYSTEM_CODE_BRANCH = "OR1001"         # Branch
SYSTEM_CODE_BRAND = "OR1002"           # Brand
SYSTEM_CODE_CITY = "OR1003"            # City
SYSTEM_CODE_DISTRICT = "OR1005"        # District (linked to City)
SYSTEM_CODE_BRANCH_TYPE = "OR1006"     # BranchType (e.g. Branch, Kiosk)
SYSTEM_CODE_USER_PROFILE = "OR1004"    # UserProfile

# --- Shifts (SH) ---
SYSTEM_CODE_SHIFT = "SH1001"          # Shift
SYSTEM_CODE_SHIFT_CLOSING = "SH1002"  # ShiftClosing

# --- Accounting (AC) ---
SYSTEM_CODE_FOODICS_SETTLEMENT = "AC1001"   # FoodicsSettlement
SYSTEM_CODE_FOODICS_PAYMENT = "AC1002"      # FoodicsPaymentRecord
SYSTEM_CODE_DAILY_ACCOUNTING = "AC1003"     # DailyAccountingStatus
SYSTEM_CODE_CHART_ACCOUNT = "AC1004"        # ChartAccount - دليل الشجرة المحاسبية
SYSTEM_CODE_COST_AUDIT = "AC1005"            # CostAuditEntry - سجل تدقيق التكاليف
SYSTEM_CODE_MANUAL_ADJUSTMENT = "AC1006"     # ManualAdjustment - التسويات اليدوية
SYSTEM_CODE_JOURNAL_ENTRY = "AC1007"         # JournalEntry - القيد المحاسبي
SYSTEM_CODE_JOURNAL_LINE = "AC1008"          # JournalEntryLine - سطر القيد (Transaction)

# --- Procurement (PR) ---
SYSTEM_CODE_SUPPLIER = "PR1001"              # Supplier - مورد
SYSTEM_CODE_PURCHASE_REQUEST = "PR1002"      # PurchaseRequest - طلب شراء
SYSTEM_CODE_PURCHASE_ORDER = "PR1003"        # PurchaseOrder - أمر شراء
SYSTEM_CODE_GOODS_RECEIPT = "PR1004"        # GoodsReceipt - استلام بضاعة
SYSTEM_CODE_SUPPLIER_INVOICE = "PR1005"     # SupplierInvoice - فاتورة المورد
SYSTEM_CODE_SUPPLIER_INVOICE_LINE = "PR1006"  # SupplierInvoiceLine - سطر فاتورة المورد

# --- HR & Payroll (HR) ---
SYSTEM_CODE_EMPLOYEE = "HR1001"              # Employee - موظف
SYSTEM_CODE_EMPLOYEE_CONTRACT = "HR1002"    # EmployeeContract - عقد موظف
SYSTEM_CODE_COST_CENTER = "HR1003"          # CostCenter - مركز تكلفة
SYSTEM_CODE_PAYROLL_RUN = "HR1004"          # PayrollRun - قيد رواتب

# --- Assets (AS) ---
SYSTEM_CODE_ASSET = "AS1001"                 # Asset - أصل
SYSTEM_CODE_ASSET_DEPRECIATION = "AS1002"   # AssetDepreciation - إهلاك

# --- Audit (AU) ---
SYSTEM_CODE_ENTERPRISE_AUDIT = "AU1001"     # EnterpriseAuditLog - سجل تدقيق لا يُحذف

# --- CRM & Loyalty (CR) ---
SYSTEM_CODE_CUSTOMER = "CR1001"
SYSTEM_CODE_LOYALTY_POINTS = "CR1002"
SYSTEM_CODE_WALLET = "CR1003"

# --- Central Kitchen (CK) ---
SYSTEM_CODE_PRODUCTION_ORDER = "CK1001"
SYSTEM_CODE_INTERNAL_INDENT = "CK1002"
SYSTEM_CODE_DELIVERY_NOTE = "CK1003"

# --- Quality (QA) ---
SYSTEM_CODE_AUDIT_CHECKLIST = "QA1001"
SYSTEM_CODE_IOT_ALERT = "QA1002"

# Model -> System Code mapping for admin display and indexing
MODEL_SYSTEM_CODES = {
    "imports.ProductSale": SYSTEM_CODE_PRODUCT_SALE,
    "imports.DailySale": SYSTEM_CODE_DAILY_SALE,
    "imports.HourlySale": SYSTEM_CODE_HOURLY_SALE,
    "imports.ExcelUpload": SYSTEM_CODE_EXCEL_UPLOAD,
    "inventory.Recipe": SYSTEM_CODE_RECIPE,
    "inventory.RecipeLine": SYSTEM_CODE_RECIPE_LINE,
    "inventory.Unit": SYSTEM_CODE_UNIT,
    "inventory.Ingredient": SYSTEM_CODE_INGREDIENT,
    "inventory.FoodicsProduct": SYSTEM_CODE_PRODUCT,
    "inventory.BranchStock": SYSTEM_CODE_BRANCH_STOCK,
    "inventory.StockMovement": SYSTEM_CODE_STOCK_MOVEMENT,
    "inventory.WasteLog": SYSTEM_CODE_WASTE_LOG,
    "org.Branch": SYSTEM_CODE_BRANCH,
    "org.Brand": SYSTEM_CODE_BRAND,
    "org.City": SYSTEM_CODE_CITY,
    "org.UserProfile": SYSTEM_CODE_USER_PROFILE,
    "shifts.Shift": SYSTEM_CODE_SHIFT,
    "shifts.ShiftClosing": SYSTEM_CODE_SHIFT_CLOSING,
    "accounting.FoodicsSettlement": SYSTEM_CODE_FOODICS_SETTLEMENT,
    "accounting.FoodicsPaymentRecord": SYSTEM_CODE_FOODICS_PAYMENT,
    "accounting.DailyAccountingStatus": SYSTEM_CODE_DAILY_ACCOUNTING,
    "accounting.ChartAccount": SYSTEM_CODE_CHART_ACCOUNT,
    "accounting.CostAuditEntry": SYSTEM_CODE_COST_AUDIT,
    "accounting.ManualAdjustment": SYSTEM_CODE_MANUAL_ADJUSTMENT,
    "accounting.JournalEntry": SYSTEM_CODE_JOURNAL_ENTRY,
    "accounting.JournalEntryLine": SYSTEM_CODE_JOURNAL_LINE,
}

# Prep List (PR1002) data sources - explicit for traceability
PREP_LIST_SALES_SOURCE = SYSTEM_CODE_PRODUCT_SALE   # SP1003
PREP_LIST_UNITS_SOURCE = SYSTEM_CODE_UNIT          # IU1002
