"""
Add recipes for remaining products to clear "Products without recipes".
Also deletes dummy FoodicsProduct (e.g. sku-0235).
Run: python manage.py map_remaining_recipes
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import FoodicsProduct, Ingredient, Recipe, RecipeLine, Unit

# SKUs to delete (dummy products)
SKUS_TO_DELETE = ["sku-0235"]

# SKU -> [(ingredient_serial, qty, unit_code), ...]
MAPPINGS = [
    ("sku-0105", [("RM-003", 60, "g")]),  # Coffee Today 1L
    ("sku-0053", [("RM-020", 1, "slice")]),  # Croissant
    ("sk-21089", [("RM-020", 5, "slice")]),  # Celebration Package
    ("sk-21320", [("RM-020", 1, "slice"), ("RM-050", 30, "g")]),  # Choco Crepe
    ("sk-21246", [("RM-004", 5, "g"), ("RM-001", 200, "ml")]),  # Cold Matcha
    ("sku-0079", [("RM-020", 1, "slice")]),  # Mix Cheese Sandwich
    ("sk-21311", [("RM-003", 1000, "g")]),  # Ethiopia Kokiso 1kg
    ("sk-21186", [("RM-060", 500, "ml")]),  # Coco Berry Family
    ("sk-21077", [("RM-020", 1, "slice")]),  # Brioche Halloumi
    ("sk-21078", [("RM-020", 1, "slice")]),  # Brioche Turkey
    ("sku-0196", [("RM-020", 1, "slice")]),  # Cookies Ice Cream
    ("sk-21301", [("RM-002", 18, "g"), ("RM-001", 150, "ml")]),  # Hot Tiramisu
    ("sku-0007", [("RM-002", 250, "g")]),  # Brazil Mogiana 250g
    ("sk-21276", [("RM-020", 1, "slice")]),  # Waffle Stick Box
    ("sk-21238", [("RM-020", 1, "slice")]),  # Crunchy Pistachio
    ("sku-0071", [("RM-020", 1, "slice")]),  # Brownie Bites
    ("sk-21285", [("RM-020", 1, "slice"), ("RM-003", 20, "g")]),  # Bonat Offer
    ("sk-21286", [("RM-020", 1, "slice"), ("RM-003", 20, "g")]),  # Bonat Offer
    ("sk-21292", [("RM-002", 18, "g"), ("RM-001", 200, "ml")]),  # Arab Bank Latte
    ("sk-21315", [("RM-003", 1000, "g")]),  # Uganda Mananasi 1kg
    ("sk-21306", [("RM-003", 250, "g")]),  # China 250g
    ("sku-0244", [("RM-020", 1, "slice")]),  # Unknown SKU
    # Additional mappings
    ("sk-21188", [("RM-002", 54, "g"), ("RM-001", 450, "ml"), ("RM-020", 3, "slice")]),  # تيراميسيو الحجم العائلي
    ("sku-0012", [("RM-003", 120, "g"), ("RM-001", 1000, "ml")]),  # آيس بوكس
    ("sku-0100", [("RM-002", 18, "g"), ("RM-001", 200, "ml")]),  # اوز لاتيه
]

INGREDIENT_DEFAULTS = [
    ("RM-001", "Whole Milk", "حليب كامل الدسم", "ml"),
    ("RM-002", "Espresso Beans", "حبوب إسبريسو", "g"),
    ("RM-003", "Filter Beans", "حبوب قهوة مقطرة", "g"),
    ("RM-004", "Matcha Powder", "بودرة ماتشا", "g"),
    ("RM-020", "Pastry Base", "مواد أولية حلويات", "slice"),
    ("RM-050", "Choco", "شوكولاتة", "g"),
    ("RM-030", "Tea", "شاي", "piece"),
    ("RM-060", "Juice Base", "مركز عصائر", "ml"),
]


class Command(BaseCommand):
    help = "Map recipes for remaining products; delete dummy SKUs. Clears Products without recipes."

    @transaction.atomic
    def handle(self, *args, **options):
        # 1. Delete dummy FoodicsProduct + ProductSale rows (so they don't appear in Prep List)
        for sku in SKUS_TO_DELETE:
            cnt, _ = FoodicsProduct.objects.filter(foodics_product_id__iexact=sku).delete()
            if cnt:
                self.stdout.write(self.style.WARNING(f"Deleted dummy product: {sku}"))
        try:
            from imports.models import ProductSale
            for sku in SKUS_TO_DELETE:
                ps_cnt = ProductSale.objects.filter(product_sku__iexact=sku).delete()[0]
                if ps_cnt:
                    self.stdout.write(self.style.WARNING(f"Deleted {ps_cnt} ProductSale row(s) for {sku}"))
        except ImportError:
            pass

        # 2. Ensure units and ingredients
        units_by_code = {u.code: u for u in Unit.objects.all()}
        for code in ["g", "ml", "slice", "piece"]:
            if code not in units_by_code:
                u = Unit.objects.create(
                    code=code,
                    name_en=code.capitalize(),
                    name_ar={"g": "جرام", "ml": "مل", "slice": "شريحة", "piece": "حبة"}.get(code, ""),
                )
                units_by_code[code] = u

        default_unit = units_by_code.get("g") or units_by_code.get("ml")
        ingredients_by_serial = {}

        for serial, name_en, name_ar, base_code in INGREDIENT_DEFAULTS:
            ing = Ingredient.objects.filter(serial_code=serial).first()
            if not ing:
                ing = Ingredient.objects.filter(name_ar__iexact=name_ar).first()
            if not ing:
                u = units_by_code.get(base_code) or default_unit
                ing = Ingredient.objects.create(
                    serial_code=serial,
                    name_en=name_en,
                    name_ar=name_ar,
                    base_unit=u,
                    is_active=True,
                )
            ingredients_by_serial[serial] = ing

        self.stdout.write(f"Ingredients ready: {list(ingredients_by_serial.keys())}")

        linked = 0
        not_found = []

        for sku, lines in MAPPINGS:
            product = FoodicsProduct.objects.filter(foodics_product_id__iexact=sku).first()
            if not product:
                product, _ = FoodicsProduct.objects.get_or_create(
                    foodics_product_id=sku,
                    defaults={"name": sku, "is_active": True, "sales_unit": default_unit},
                )

            resolved = []
            for ing_serial, qty, unit_code in lines:
                ing = ingredients_by_serial.get(ing_serial)
                if not ing:
                    self.stdout.write(self.style.WARNING(f"  Missing ingredient {ing_serial}"))
                    break
                u = units_by_code.get(unit_code) or default_unit
                resolved.append((ing, Decimal(str(qty)), u))

            if not resolved:
                not_found.append(sku)
                continue

            recipe, _ = Recipe.objects.get_or_create(
                product=product,
                defaults={"yield_qty": Decimal("1"), "yield_unit": default_unit},
            )
            RecipeLine.objects.filter(recipe=recipe).delete()
            for ing, qty, u in resolved:
                RecipeLine.objects.create(recipe=recipe, ingredient=ing, qty=qty, unit=u)
            linked += 1
            self.stdout.write(self.style.SUCCESS(f"  Linked {sku} -> {product.name}"))

        self.stdout.write(self.style.SUCCESS(f"Done. Linked {linked} products. Skipped: {not_found}"))
