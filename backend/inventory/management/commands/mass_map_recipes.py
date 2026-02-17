"""
Mass Recipe Mapping: Link sales products (Ice V60, Cappuccino, Tiramisu, etc.) to base ingredients.

Logical defaults (configurable):
- Coffee drinks (Cappuccino, Latte, Espresso, V60, etc.) → Coffee Beans @ 18g/unit
- Milk drinks → Whole Milk (RM-001) @ 200ml/unit
- Tiramisu/Cakes → Mix or Portion (RM-011 or similar)

Sources: FoodicsProduct (catalog) and optionally ProductSale (sales list).
Run: python manage.py mass_map_recipes [--from-sales] [--reset] [--dry-run]
"""
from decimal import Decimal
import re

from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import FoodicsProduct, Ingredient, Recipe, RecipeLine, Unit

try:
    from imports.models import ProductSale
except ImportError:
    ProductSale = None  # type: ignore


# (pattern_regex_or_keywords, [(ingredient_serial, qty, unit_code), ...])
# First match wins. Keywords matched case-insensitive against product name.
RULE_MAP = [
    # V60 / Filter coffee
    (r"\bv60\b|فيلتر|filter|قَهْوَة\s*مَقْطَرَة", [("RM-003", 18, "g")]),  # Filter Beans
    # Espresso-based coffee drinks
    (
        r"cappuccino|كابتشينو|latte|لاتيه|لاتيه|espresso|إسبريسو|americano|أمريكانو|كوفي|coffee|قهوة|موكا|mocha",
        [("RM-002", 18, "g"), ("RM-001", 200, "ml")],  # Espresso Beans + Milk
    ),
    # Milk-only or hot chocolate type
    (r"hot\s*chocolate|شوكولاتة\s*ساخنة|حليب\s*شوكولاتة", [("RM-001", 200, "ml")]),
    # Matcha
    (r"matcha|ماتشا|ماتشّا", [("RM-004", 5, "g"), ("RM-001", 200, "ml")]),
    # Tiramisu, Puddings, Cakes
    (
        r"tiramisu|تيراميسو|pudding|بودينق|بودينج|cake|كيك|كيكة",
        [("RM-011", 150, "g"), ("RM-001", 100, "ml")],  # Chocolate mix + milk
    ),
    # Ice drinks - often coffee or tea base
    (r"ice\s*v60|آيس\s*v60|iced", [("RM-003", 18, "g"), ("RM-016", 150, "ml")]),
    # Generic coffee fallback (single shot)
    (r"\bcoffee\b|قهوة", [("RM-002", 18, "g")]),
    # Generic milk
    (r"milk|حليب", [("RM-001", 200, "ml")]),
]


def match_recipe(name: str) -> list[tuple[str, int | float, str]] | None:
    """Return first matching recipe lines: [(ing_serial, qty, unit), ...] or None."""
    text = (name or "").strip()
    if not text:
        return None
    flags = re.IGNORECASE | re.UNICODE
    for pattern, lines in RULE_MAP:
        if re.search(pattern, text, flags):
            return [(s, q, u) for s, q, u in lines]
    return None


class Command(BaseCommand):
    help = (
        "Mass-map product names to default recipes. "
        "Coffee→18g beans, Milk drinks→200ml milk, Tiramisu→mix."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--from-sales",
            action="store_true",
            help="Create FoodicsProduct from ProductSale for products not in catalog",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Replace existing recipes with default mapping",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without writing",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from_sales = bool(options.get("from_sales"))
        reset = bool(options.get("reset"))
        dry_run = bool(options.get("dry_run"))

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN – no changes will be saved"))

        units_by_code = {u.code: u for u in Unit.objects.all()}
        if not units_by_code:
            self.stdout.write(self.style.ERROR("No units found. Run seed_8oz_inventory first."))
            return

        ingredients_by_serial = {}
        for i in Ingredient.objects.all():
            if i.serial_code and i.serial_code.strip():
                ingredients_by_serial[i.serial_code.strip()] = i

        default_unit = units_by_code.get("g") or units_by_code.get("pcs") or list(units_by_code.values())[0]

        # Collect products to process
        products_to_process: list[tuple[str, str]] = []  # (sku, name)

        for p in FoodicsProduct.objects.filter(is_active=True):
            products_to_process.append((p.foodics_product_id or "", p.name or ""))

        if from_sales and ProductSale is not None:
            seen_sku = {sku for sku, _ in products_to_process}
            for row in (
                ProductSale.objects.values("product_sku", "product_name")
                .distinct()
            ):
                sku = (row.get("product_sku") or "").strip()
                name = (row.get("product_name") or "").strip()
                if not name:
                    continue
                if not sku:
                    sku = f"sales-{hash(name) % 10**8}"  # Pseudo-SKU for name-only
                if sku not in seen_sku:
                    products_to_process.append((sku, name))
                    seen_sku.add(sku)

        linked = 0
        skipped_no_match = 0
        skipped_missing_ing = 0
        created_products = 0

        for sku, name in products_to_process:
            if not name:
                continue

            lines = match_recipe(name)
            if not lines:
                skipped_no_match += 1
                continue

            # Resolve ingredients
            resolved_lines: list[tuple[Ingredient, Decimal, Unit]] = []
            missing = False
            for ing_serial, qty, unit_code in lines:
                ing = ingredients_by_serial.get(ing_serial)
                if not ing:
                    self.stdout.write(
                        self.style.WARNING(f"  Missing ingredient {ing_serial} for {name}")
                    )
                    skipped_missing_ing += 1
                    missing = True
                    break
                u = units_by_code.get(unit_code) or units_by_code.get("g") or default_unit
                resolved_lines.append((ing, Decimal(str(qty)), u))

            if missing or not resolved_lines:
                continue

            if dry_run:
                self.stdout.write(f"  Would link: {sku} | {name} -> {len(resolved_lines)} lines")
                linked += 1
                continue

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

            for ing, qty, u in resolved_lines:
                RecipeLine.objects.update_or_create(
                    recipe=recipe,
                    ingredient=ing,
                    defaults={"qty": qty, "unit": u},
                )

            linked += 1
            self.stdout.write(f"  Linked: {sku} | {name} -> {len(resolved_lines)} ingredients")

        msg = (
            f"Done: {linked} linked, {skipped_no_match} no match, {skipped_missing_ing} missing ingredients"
        )
        if created_products:
            msg += f", {created_products} new products"
        if dry_run:
            msg += " (dry run)"
        self.stdout.write(self.style.SUCCESS(msg))
