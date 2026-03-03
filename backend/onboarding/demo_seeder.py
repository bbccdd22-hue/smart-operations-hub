"""
Demo data seeder for new tenants.

Called once during onboarding to populate:
  - Default restaurant Chart of Accounts (Arabic + English)
  - A sample city, brand, and first branch
  - A default branch type

All data is scoped to the newly created Tenant's Organization.
"""
from __future__ import annotations

from django.db import transaction


# ── Default Restaurant Chart of Accounts ──────────────────────────────────────
# Format: (code, name_en, name_ar, account_type, statement)
# account_type choices (Arabic, matching ChartAccount model):
#   "رئيسي"   = main/parent account
#   "تحليلي"  = leaf/analytical account
# statement choices:
#   "المركز المالي"  = Balance Sheet (assets/liabilities/equity)
#   "قائمة الدخل"   = Income Statement (revenue/expense)
DEFAULT_COA: list[tuple[str, str, str, str, str]] = [
    # ── Assets ────────────────────────────────────────────────────────────────
    ("011",        "Current Assets",              "الأصول المتداولة",           "رئيسي",  "المركز المالي"),
    ("011011",     "Cash & Cash Equivalents",     "النقد وما يعادله",            "رئيسي",  "المركز المالي"),
    ("011011101",  "Main Safe",                   "الخزينة الرئيسية",            "تحليلي", "المركز المالي"),
    ("011011102",  "Branch Cash",                 "نقدية الفرع",                 "تحليلي", "المركز المالي"),
    ("011011103",  "Network Revenue",             "إيرادات الشبكة",              "تحليلي", "المركز المالي"),
    ("011011104",  "Delivery Revenue",            "إيرادات التوصيل",             "تحليلي", "المركز المالي"),
    ("012",        "Receivables",                 "الذمم المدينة",               "رئيسي",  "المركز المالي"),
    ("012101",     "Accounts Receivable",         "حسابات القبض",                "تحليلي", "المركز المالي"),
    ("012102",     "VAT Receivable",              "ضريبة القيمة المضافة (مدين)", "تحليلي", "المركز المالي"),
    ("013",        "Inventory",                   "المخزون",                     "رئيسي",  "المركز المالي"),
    ("12101",      "Goods Inventory",             "مخزون البضائع",               "تحليلي", "المركز المالي"),
    ("12102",      "Raw Materials",               "المواد الخام",                "تحليلي", "المركز المالي"),
    ("12103",      "In-Transit Inventory",        "مخزون قيد النقل",             "تحليلي", "المركز المالي"),
    ("014",        "Prepaid Expenses",            "المصروفات المدفوعة مقدماً",   "تحليلي", "المركز المالي"),
    ("02101",      "Fixed Assets – Equipment",    "الأصول الثابتة – معدات",      "تحليلي", "المركز المالي"),
    # ── Liabilities ───────────────────────────────────────────────────────────
    ("21101",      "Accounts Payable",            "حسابات الدفع",                "تحليلي", "المركز المالي"),
    ("21102",      "Accrued Liabilities",         "الالتزامات المستحقة",         "تحليلي", "المركز المالي"),
    ("21103",      "VAT Payable",                 "ضريبة القيمة المضافة (دائن)", "تحليلي", "المركز المالي"),
    ("21104",      "Salaries Payable",            "الرواتب المستحقة",            "تحليلي", "المركز المالي"),
    # ── Equity ────────────────────────────────────────────────────────────────
    ("31101",      "Owner's Equity",              "حقوق الملكية",                "تحليلي", "المركز المالي"),
    ("31102",      "Retained Earnings",           "الأرباح المحتجزة",            "تحليلي", "المركز المالي"),
    # ── Revenue ───────────────────────────────────────────────────────────────
    ("04101",      "Food & Beverage Sales",       "إيرادات الأطعمة والمشروبات",  "تحليلي", "قائمة الدخل"),
    ("04102",      "Delivery Sales",              "إيرادات التوصيل",             "تحليلي", "قائمة الدخل"),
    ("04103",      "Catering Sales",              "إيرادات الكيترينج",           "تحليلي", "قائمة الدخل"),
    ("04104",      "Other Revenue",               "إيرادات أخرى",                "تحليلي", "قائمة الدخل"),
    ("07101",      "Cash Over / Short",           "الزيادة / النقص في الخزينة",  "تحليلي", "قائمة الدخل"),
    # ── Expenses ──────────────────────────────────────────────────────────────
    ("051",        "Operating Expenses",          "المصروفات التشغيلية",         "رئيسي",  "قائمة الدخل"),
    ("051101",     "Cost of Goods Sold",          "تكلفة البضائع المباعة",       "تحليلي", "قائمة الدخل"),
    ("051102",     "Food Cost",                   "تكلفة الطعام",                "تحليلي", "قائمة الدخل"),
    ("051103",     "Beverage Cost",               "تكلفة المشروبات",             "تحليلي", "قائمة الدخل"),
    ("051201",     "Rent Expense",                "مصروف الإيجار",               "تحليلي", "قائمة الدخل"),
    ("051202",     "Utilities",                   "المرافق (كهرباء وماء)",       "تحليلي", "قائمة الدخل"),
    ("051203",     "Maintenance",                 "مصروف الصيانة",               "تحليلي", "قائمة الدخل"),
    ("0510308",    "Salary Expense",              "مصروف الرواتب",               "تحليلي", "قائمة الدخل"),
    ("051301",     "Depreciation",                "مصروف الإهلاك",               "تحليلي", "قائمة الدخل"),
    ("051401",     "Waste & Spoilage",            "الهدر والتلف",                "تحليلي", "قائمة الدخل"),
    ("051501",     "Marketing & Advertising",     "التسويق والإعلان",            "تحليلي", "قائمة الدخل"),
]


def seed_chart_of_accounts(organization=None) -> int:  # noqa: ARG001
    """
    Create the default restaurant Chart of Accounts.
    The `organization` argument is accepted for API compatibility but
    ChartAccount records are global (not scoped per org in this schema).
    Skips accounts that already exist (idempotent).
    Returns the number of new accounts created.
    """
    from accounting.models import ChartAccount

    created = 0
    for code, name_en, name_ar, acct_type, statement in DEFAULT_COA:
        _, was_created = ChartAccount.objects.get_or_create(
            code=code,
            defaults={
                "name_en": name_en,
                "name_ar": name_ar,
                "account_type": acct_type,
                "statement": statement,
                "is_active": True,
            },
        )
        if was_created:
            created += 1
    return created


def seed_demo_org(organization, brand_name: str = "") -> dict:
    """
    Seed a minimal but functional demo setup for the given Organization:
      - City → Brand → Branch (Main)
    Returns a dict with the created object instances.
    """
    from org.models import City, Brand, Branch, BranchType

    effective_brand_name = brand_name or organization.name

    # ── City ──────────────────────────────────────────────────────────────────
    city, _ = City.objects.get_or_create(
        option_code="CITY-01",
        defaults={"name_en": "Riyadh", "name_ar": "الرياض"},
    )

    # ── Branch Type ───────────────────────────────────────────────────────────
    branch_type, _ = BranchType.objects.get_or_create(
        option_code="TYPE-01",
        defaults={"name_en": "Restaurant", "name_ar": "مطعم"},
    )

    # ── Brand ──────────────────────────────────────────────────────────────────
    from django.utils.text import slugify
    brand_slug = slugify(effective_brand_name)[:120] or "brand"
    # Ensure slug uniqueness
    from org.models import Brand as BrandModel
    if BrandModel.objects.filter(slug=brand_slug).exclude(organization=organization).exists():
        brand_slug = f"{brand_slug}-{organization.pk}"

    import uuid as _uuid
    brand_code = f"BRD-{_uuid.uuid4().hex[:8].upper()}"
    brand, _ = Brand.objects.get_or_create(
        organization=organization,
        name=effective_brand_name,
        defaults={
            "name_ar": effective_brand_name,
            "slug": brand_slug,
            "brand_code": brand_code,
        },
    )

    # ── Main Branch ───────────────────────────────────────────────────────────
    branch, _ = Branch.objects.get_or_create(
        brand=brand,
        name="Main Branch",
        defaults={
            "name_ar": "الفرع الرئيسي",
            "city": city,
            "branch_type": branch_type,
            "is_active": True,
        },
    )

    return {"city": city, "brand": brand, "branch": branch, "branch_type": branch_type}


@transaction.atomic
def full_tenant_setup(
    organization,
    brand_name: str = "",
) -> dict:
    """
    Full idempotent setup for a new Tenant:
      1. Seed Chart of Accounts
      2. Seed demo org structure (city, brand, branch)
    Returns summary dict.
    """
    accounts_created = seed_chart_of_accounts(organization)
    org_data = seed_demo_org(organization, brand_name=brand_name)
    return {
        "accounts_created": accounts_created,
        **org_data,
    }
