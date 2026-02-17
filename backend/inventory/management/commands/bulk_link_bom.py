"""
Bulk-link Product SKUs to BOM (ingredients).
Creates FoodicsProduct, Recipe, RecipeLine for each SKU.
Use --file to load from JSON, or extend RECIPES below.

JSON format:
{
  "recipes": [
    {
      "sku": "sku-0108",
      "name": "بودينق الشوكولاته",
      "lines": [
        {"ingredient_serial": "RM-011", "qty": 150, "unit": "g"},
        {"ingredient_serial": "RM-001", "qty": 100, "unit": "ml"}
      ]
    }
  ]
}

Run: python manage.py bulk_link_bom [--file bom_recipes.json] [--reset]
"""
from decimal import Decimal
import json

from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import FoodicsProduct, Ingredient, Recipe, RecipeLine, Unit


# Extend with more SKUs - format: (sku, name_ar, [(ing_serial, qty, unit_code), ...])
DEFAULT_RECIPES = [
    ("sku-0108", "بودينق الشوكولاته", [("RM-011", 150, "g"), ("RM-001", 100, "ml")]),
    ("sku-0103", "قهوة اليوم - بارد", [("RM-003", 20, "g"), ("RM-015", 200, "ml"), ("RM-016", 150, "ml")]),
    ("sku-0077", "ساندوتش تونة", [("RM-008", 120, "g"), ("RM-017", 2, "slice")]),
    ("sku-0109", "بانيني الجبن والتيركي", [("RM-012", 2, "slice"), ("RM-009", 50, "g")]),
    ("sku-0044", "آيس ماتشا لاتيه", [("RM-004", 5, "g"), ("RM-001", 200, "ml")]),
]


class Command(BaseCommand):
    help = "Bulk-link Product SKUs to BOM. Use --file for JSON or extend DEFAULT_RECIPES."

    def add_arguments(self, parser):
        parser.add_argument("--file", type=str, help="JSON file with recipes (see docstring)")
        parser.add_argument("--reset", action="store_true", help="Delete existing recipes before linking")

    @transaction.atomic
    def handle(self, *args, **options):
        file_path = options.get("file")
        reset = bool(options.get("reset"))

        if file_path:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                recipes_data = data.get("recipes", [])
                recipes = []
                for r in recipes_data:
                    lines = [
                        (L["ingredient_serial"], int(L["qty"]), L.get("unit", "g"))
                        for L in r.get("lines", [])
                    ]
                    recipes.append((r["sku"], r.get("name", r["sku"]), lines))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to load {file_path}: {e}"))
                return
        else:
            recipes = DEFAULT_RECIPES

        units_by_code = {u.code: u for u in Unit.objects.all()}
        if not units_by_code:
            self.stdout.write(self.style.WARNING("No units found. Run seed_8oz_inventory first."))
            return

        ingredients_by_serial = {}
        for i in Ingredient.objects.all():
            if i.serial_code and i.serial_code.strip():
                ingredients_by_serial[i.serial_code] = i

        default_unit = units_by_code.get("g") or units_by_code.get("pcs") or list(units_by_code.values())[0]
        created_products = 0
        created_lines = 0

        for sku, name, lines in recipes:
            product, p_created = FoodicsProduct.objects.get_or_create(
                foodics_product_id=sku,
                defaults={"name": name, "is_active": True, "sales_unit": default_unit},
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
                defaults={"yield_qty": Decimal("1"), "yield_unit": default_unit},
            )

            for ing_serial, qty, unit_code in lines:
                ing = ingredients_by_serial.get(ing_serial)
                if not ing:
                    self.stdout.write(self.style.WARNING(f"Skipping unknown ingredient {ing_serial} for {sku}"))
                    continue
                u = units_by_code.get(unit_code) or units_by_code.get("g") or default_unit
                _, rl_created = RecipeLine.objects.update_or_create(
                    recipe=recipe,
                    ingredient=ing,
                    defaults={"qty": Decimal(str(qty)), "unit": u},
                )
                if rl_created:
                    created_lines += 1

        self.stdout.write(self.style.SUCCESS(
            f"BOM linked: {len(recipes)} products, {created_products} new, {created_lines} new lines"
        ))
