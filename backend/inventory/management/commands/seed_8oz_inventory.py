"""
Seed 8OZ Coffee brand: Bilingual ingredients (RM-001 to RM-017), units, and BOM recipes.
[cite: 2026-02-13]
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import FoodicsProduct, Ingredient, Recipe, RecipeLine, Unit


# Units: code, name_en, name_ar, base_unit_code, factor_to_base
UNITS = [
    ("ml", "Milliliter", "مل", None, "1"),
    ("l", "Liter", "لتر", "ml", "1000"),
    ("bottle-2.8l", "Bottle (2.8L)", "زجاجة 2.8ل", "ml", "2800"),
    ("g", "Gram", "جرام", None, "1"),
    ("kg", "Kilogram", "كيلو", "g", "1000"),
    ("slice", "Slice", "شريحة", None, "1"),
    ("pump-30ml", "Pump (30ml)", "ضغطة 30مل", "ml", "30"),
    ("pump-10ml", "Pump (10ml)", "ضغطة 10مل", "ml", "10"),
    ("can-200g", "Can (200g)", "علبة 200جرام", "g", "200"),
    ("can-1.5kg", "Can (1.5kg)", "علبة 1.5كيلو", "g", "1500"),
]

# Ingredients: serial_code, name_en, name_ar, base_unit_code
INGREDIENTS = [
    ("RM-001", "Whole Milk", "حليب كامل الدسم", "ml"),
    ("RM-002", "Espresso Beans (8OZ)", "حبوب إسبريسو", "g"),
    ("RM-003", "Filter Beans (V60)", "حبوب قهوة مقطرة", "g"),
    ("RM-004", "Matcha Powder", "بودرة ماتشا", "g"),
    ("RM-005", "White Mocha Sauce", "صوص وايت موكا", "ml"),
    ("RM-006", "Pistachio Sauce", "صوص بستاشيو", "ml"),
    ("RM-007", "Brioche Bread", "خبز بريوش", "slice"),
    ("RM-008", "Tuna Mix", "خلطة تونة", "g"),
    ("RM-009", "Halloumi Cheese", "جبن حلوم", "g"),
    ("RM-010", "Pesto Sauce", "صوص بيستو", "g"),
    ("RM-011", "Chocolate Pudding Mix", "خليط بودينق شوكولاته", "g"),
    ("RM-012", "Turkey Slices", "شرائح تيركي", "slice"),
    ("RM-013", "Caramel Syrup", "سيرب كراميل", "ml"),
    ("RM-014", "Orange Juice (Raw)", "عصير برتقال خام", "ml"),
    ("RM-015", "Water", "ماء", "ml"),
    ("RM-016", "Ice", "ثلج", "ml"),
    ("RM-017", "Sandwich Bread", "خبز ساندويتش", "slice"),
]

# Products + recipes: foodics_product_id (SKU), name, recipe lines [(ingredient_serial, qty, unit_code), ...]
RECIPES = [
    ("sku-0108", "بودينق الشوكولاته", [
        ("RM-011", 150, "g"),
        ("RM-001", 100, "ml"),
    ]),
    ("sku-0103", "قهوة اليوم - بارد", [
        ("RM-003", 20, "g"),
        ("RM-015", 200, "ml"),  # Water approx
        ("RM-016", 150, "ml"),  # Ice approx
    ]),
    ("sku-0077", "ساندوتش تونة", [
        ("RM-008", 120, "g"),
        ("RM-017", 2, "slice"),
    ]),
    ("sku-0109", "بانيني الجبن والتيركي", [
        ("RM-012", 2, "slice"),
        ("RM-009", 50, "g"),
    ]),
    ("sku-0044", "آيس ماتشا لاتيه", [
        ("RM-004", 5, "g"),
        ("RM-001", 200, "ml"),
    ]),
]


class Command(BaseCommand):
    help = "Seed 8OZ Coffee: bilingual ingredients RM-001..RM-017, units, and BOM recipes."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Reset recipes for these products (ingredients preserved).")

    @transaction.atomic
    def handle(self, *args, **options):
        reset = bool(options.get("reset"))

        # 1. Create/update units
        units_by_code = {}
        for code, name_en, name_ar, base_code, factor in UNITS:
            base_unit = units_by_code.get(base_code) if base_code else None
            u, _ = Unit.objects.update_or_create(
                code=code,
                defaults={
                    "name_en": name_en,
                    "name_ar": name_ar or "",
                    "base_unit": base_unit,
                    "factor_to_base": Decimal(str(factor)),
                },
            )
            units_by_code[code] = u

        self.stdout.write(f"Units: {len(units_by_code)}")

        # 2. Create/update ingredients
        ingredients_by_serial = {}
        for serial, name_en, name_ar, base_code in INGREDIENTS:
            base_unit = units_by_code[base_code]
            ing = Ingredient.objects.filter(serial_code=serial).first()
            if not ing:
                ing = Ingredient.objects.filter(name_en__iexact=name_en).first()
            if ing:
                ing.name_en = name_en
                ing.name_ar = name_ar
                ing.base_unit = base_unit
                ing.serial_code = serial
                ing.is_active = True
                ing.save()
            else:
                ing = Ingredient.objects.create(
                    name_en=name_en,
                    name_ar=name_ar,
                    base_unit=base_unit,
                    serial_code=serial,
                    is_active=True,
                )
            ingredients_by_serial[serial] = ing

        self.stdout.write(f"Ingredients: {len(ingredients_by_serial)}")

        # 3. Create products and recipes
        pcs = units_by_code.get("g") or units_by_code.get("slice") or list(units_by_code.values())[0]
        created_products = 0
        created_lines = 0

        for sku, name, lines in RECIPES:
            product, p_created = FoodicsProduct.objects.get_or_create(
                foodics_product_id=sku,
                defaults={"name": name, "is_active": True, "sales_unit": pcs},
            )
            if p_created:
                created_products += 1
            else:
                product.name = name
                product.save(update_fields=["name"])

            if reset:
                Recipe.objects.filter(product=product).delete()

            recipe, _ = Recipe.objects.get_or_create(
                product=product,
                defaults={"yield_qty": Decimal("1"), "yield_unit": pcs},
            )

            for ing_serial, qty, unit_code in lines:
                ing = ingredients_by_serial.get(ing_serial)
                u = units_by_code.get(unit_code) or units_by_code.get("g") or units_by_code.get("ml")
                if not ing:
                    self.stdout.write(self.style.WARNING(f"Skipping unknown ingredient {ing_serial}"))
                    continue
                _, rl_created = RecipeLine.objects.update_or_create(
                    recipe=recipe,
                    ingredient=ing,
                    defaults={"qty": Decimal(str(qty)), "unit": u},
                )
                if rl_created:
                    created_lines += 1

        self.stdout.write(self.style.SUCCESS(
            f"8OZ seeded: {created_products} new products, {created_lines} new recipe lines"
        ))
