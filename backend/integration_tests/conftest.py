"""
Integration Test Suite – Shared Fixtures
=========================================
Provides a complete, isolated, realistic dataset covering:
  - 1 Brand (8OZ Coffee)
  - 2 Branches (Main + North)
  - 1 IN_TRANSIT pseudo-branch
  - Ingredients, products, recipes
  - Supplier with AP account
  - Chart of Accounts (minimal but complete)
  - Superuser + regular cashier user

All data is created fresh per test function (function scope) to ensure
complete isolation between test cases.
"""
import datetime
import os
from decimal import Decimal

import pytest

os.environ.setdefault("DJANGO_SECRET_KEY", "integration-test-secret-key-not-for-prod")
os.environ.setdefault("DJANGO_DEBUG", "true")
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
os.environ.setdefault("POS_REALTIME_DEPLETION_ENABLED", "true")


# ─── Chart of Accounts ────────────────────────────────────────────────────────

@pytest.fixture
def chart_of_accounts(db):
    """Minimal but realistic Chart of Accounts for all integration tests."""
    from accounting.models import ChartAccount

    accounts = [
        # Cash / Bank
        ("011011102", "نقدية - الفروع",          "Branch Cash",          "asset"),
        ("011011201", "بنك - بطاقات شبكة",        "Bank - Network Cards",  "asset"),
        ("011011301", "بنك - توصيل",              "Bank - Delivery Apps",  "asset"),
        # Revenue
        ("04101",     "إيرادات المبيعات",          "Sales Revenue",         "revenue"),
        # COGS
        ("05101",     "تكلفة البضاعة المباعة",     "COGS",                  "expense"),
        # Inventory (asset)
        ("12101",     "مخزون بضاعة",               "Goods Inventory",       "asset"),
        # Accounts Payable — two codes: 02101 for supplier_invoice_services, 21101 for confirm_goods_receipt
        ("02101",     "موردون تجاريون",             "Accounts Payable",      "liability"),
        ("21101",     "موردون - استحقاق",            "AP Accrual",            "liability"),
        # Salary Expense
        ("0510308",   "مصروف رواتب",               "Salary Expense",        "expense"),
        # Variance
        ("07101",     "عجز / زيادة صندوق",         "Cash Over/Short",       "expense"),
        # Operating expenses
        ("051",       "مصروفات تشغيل",             "Operating Expenses",    "expense"),
    ]

    created = {}
    for code, name_ar, name_en, acc_type in accounts:
        obj, _ = ChartAccount.objects.get_or_create(
            code=code,
            defaults={
                "name_ar": name_ar,
                "name_en": name_en,
                "level": len(code),
                "account_type": "تحليلي",
                "statement": "المركز المالي" if acc_type in ("asset", "liability") else "قائمة الدخل",
                "is_active": True,
            },
        )
        created[code] = obj
    return created


# ─── Org Hierarchy ────────────────────────────────────────────────────────────

@pytest.fixture
def test_city(db):
    from org.models import City
    city, _ = City.objects.get_or_create(
        name_en="Riyadh", defaults={"name_ar": "الرياض", "is_active": True}
    )
    return city


@pytest.fixture
def test_brand(db, test_city):
    from org.models import Brand
    brand, _ = Brand.objects.get_or_create(
        name="8OZ Coffee",
        defaults={"name_ar": "ثمانية أوقيات", "is_active": True},
    )
    return brand


@pytest.fixture
def main_branch(db, test_brand, test_city):
    from org.models import Branch
    b, _ = Branch.objects.get_or_create(
        name="Main Branch",
        defaults={
            "brand": test_brand, "city": test_city, "is_active": True,
            "pos_depletion_enabled": True,
        },
    )
    b.pos_depletion_enabled = True
    b.save(update_fields=["pos_depletion_enabled"])
    return b


@pytest.fixture
def north_branch(db, test_brand, test_city):
    from org.models import Branch
    b, _ = Branch.objects.get_or_create(
        name="North Branch",
        defaults={"brand": test_brand, "city": test_city, "is_active": True},
    )
    return b


@pytest.fixture
def in_transit_branch(db, test_brand, test_city):
    from org.models import Branch
    b, _ = Branch.objects.get_or_create(
        branch_code="IN_TRANSIT",
        defaults={
            "brand": test_brand, "city": test_city,
            "name": "In Transit", "is_active": True,
        },
    )
    return b


# ─── Users ────────────────────────────────────────────────────────────────────

@pytest.fixture
def superuser(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    u, _ = User.objects.get_or_create(
        username="SAIF",
        defaults={"is_superuser": True, "is_staff": True},
    )
    return u


@pytest.fixture
def cashier_user(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    u, _ = User.objects.get_or_create(
        username="cashier_test",
        defaults={"is_superuser": False, "is_staff": False},
    )
    return u


# ─── Inventory: Units + Ingredients + Products + Recipes ──────────────────────

@pytest.fixture
def units(db):
    from inventory.models import Unit
    data = [("g", "جرام", "Gram"), ("kg", "كيلو", "Kilogram"),
            ("ml", "مل", "Milliliter"), ("L", "لتر", "Liter"),
            ("pcs", "قطعة", "Piece"), ("cup", "كوب", "Cup")]
    result = {}
    for code, ar, en in data:
        u, _ = Unit.objects.get_or_create(code=code, defaults={"name_ar": ar, "name_en": en})
        result[code] = u
    return result


@pytest.fixture
def ingredients(db, units):
    from inventory.models import Ingredient
    data = [
        ("Espresso Beans",   "حبوب إسبريسو",   "g",  Decimal("0.50")),
        ("Whole Milk",       "حليب كامل",       "ml", Decimal("0.01")),
        ("Sugar",            "سكر",             "g",  Decimal("0.005")),
        ("Bread Flour",      "دقيق خبز",         "g",  Decimal("0.003")),
        ("Chicken Breast",   "صدر دجاج",         "g",  Decimal("0.025")),
    ]
    result = {}
    for name_en, name_ar, unit_code, cost in data:
        ing, _ = Ingredient.objects.get_or_create(
            name_en=name_en,
            defaults={"name_ar": name_ar, "base_unit": units[unit_code], "unit_cost": cost},
        )
        ing.unit_cost = cost
        ing.save(update_fields=["unit_cost"])
        result[name_en] = ing
    return result


@pytest.fixture
def products(db, units, ingredients):
    from inventory.models import FoodicsProduct, Recipe, RecipeLine
    data = [
        ("LATTE-001",  "Café Latte",       [("Espresso Beans", 18), ("Whole Milk", 240)]),
        ("CAP-001",    "Cappuccino",        [("Espresso Beans", 18), ("Whole Milk", 150)]),
        ("SAND-001",   "Chicken Sandwich",  [("Chicken Breast", 120), ("Bread Flour", 60)]),
    ]
    result = {}
    for sku, name, recipe_lines in data:
        prod, _ = FoodicsProduct.objects.get_or_create(
            foodics_product_id=sku, defaults={"name": name}
        )
        recipe, _ = Recipe.objects.get_or_create(
            product=prod,
            defaults={"yield_qty": Decimal("1"), "yield_unit": units["pcs"]},
        )
        for ing_name, qty in recipe_lines:
            ing = ingredients[ing_name]
            RecipeLine.objects.get_or_create(
                recipe=recipe, ingredient=ing,
                defaults={"qty": Decimal(str(qty)), "unit": ing.base_unit},
            )
        result[sku] = prod
    return result


@pytest.fixture
def branch_stock(db, main_branch, north_branch, ingredients):
    """Initial stock for both branches."""
    from inventory.models import BranchStock
    stock_data = [
        (main_branch,  "Espresso Beans",  Decimal("5000")),
        (main_branch,  "Whole Milk",      Decimal("20000")),
        (main_branch,  "Sugar",           Decimal("10000")),
        (main_branch,  "Bread Flour",     Decimal("8000")),
        (main_branch,  "Chicken Breast",  Decimal("6000")),
        (north_branch, "Espresso Beans",  Decimal("2000")),
        (north_branch, "Whole Milk",      Decimal("8000")),
    ]
    result = {}
    for branch, ing_name, qty in stock_data:
        ing = ingredients[ing_name]
        stock, _ = BranchStock.objects.get_or_create(
            branch=branch, ingredient=ing, defaults={"on_hand": qty}
        )
        stock.on_hand = qty
        stock.save(update_fields=["on_hand"])
        result[(branch.id, ing_name)] = stock
    return result


# ─── Procurement: Supplier ────────────────────────────────────────────────────

@pytest.fixture
def supplier(db, test_brand):
    from procurement.models import Supplier
    s, _ = Supplier.objects.get_or_create(
        name="Al-Noor Coffee Supplier",
        brand=test_brand,
        defaults={"credit_days": 30, "is_active": True},
    )
    return s


# ─── Helpers (shared) ─────────────────────────────────────────────────────────

def lines_balanced(je) -> bool:
    """Return True if journal entry debits == credits."""
    from accounting.models import JournalEntryLine
    lines = JournalEntryLine.objects.filter(journal_entry=je)
    total_d = sum(l.debit_amount for l in lines)
    total_c = sum(l.credit_amount for l in lines)
    return total_d == total_c and total_d > 0


def get_on_hand(branch, ingredient):
    from inventory.models import BranchStock
    try:
        return BranchStock.objects.get(branch=branch, ingredient=ingredient).on_hand
    except BranchStock.DoesNotExist:
        return Decimal("0")
