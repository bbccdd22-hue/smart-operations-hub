"""
ربط جميع أصناف المبيعات الـ 55 بمكوناتها الصحيحة.
Links all 55 sales products to their correct ingredients.

Ingredients: RM-001 (حليب), RM-002 (حبوب إسبريسو), RM-003 (بن مقطر), RM-020 (مواد أولية حلويات)
Uses: Ingredient.serial_code, FoodicsProduct.foodics_product_id.
Run seed_8oz_inventory first for RM-001..RM-017. RM-020 is created if missing.

Run: python manage.py apply_full_catalog_recipes [--dry-run]
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import FoodicsProduct, Ingredient, Recipe, RecipeLine, Unit


# SKU -> [(ingredient_serial_code, qty, unit_code), ...]
# Coffee: RM-002 (Espresso) or RM-003 (Filter) from seed. Use RM-002 for espresso-based.
MAPPINGS = {
    # قهوة مختصة (بن فقط) - RM-002 حبوب إسبريسو أو RM-003 لقَهْوَة مقطرة
    "sku-0092": [("RM-003", 20, "g")],  # Ice V60 -> Filter beans
    "sku-0011": [("RM-002", 15, "g")],
    "sku-0008": [("RM-003", 20, "g")],
    "sku-0035": [("RM-002", 18, "g")],
    "sku-0101": [("RM-002", 20, "g")],
    "sku-0040": [("RM-002", 18, "g")],
    "sku-0028": [("RM-002", 18, "g")],
    "sku-0104": [("RM-003", 15, "g")],
    "sk-21254": [("RM-002", 18, "g")],
    # مشروبات حليب (بن + حليب)
    "sku-0026": [("RM-002", 18, "g"), ("RM-001", 200, "ml")],
    "sku-0033": [("RM-002", 18, "g"), ("RM-001", 150, "ml")],
    "sku-0002": [("RM-002", 18, "g"), ("RM-001", 200, "ml")],
    "sku-0029": [("RM-002", 18, "g"), ("RM-001", 250, "ml")],
    "sku-0001": [("RM-002", 18, "g"), ("RM-001", 250, "ml")],
    "sku-0039": [("RM-002", 18, "g"), ("RM-001", 200, "ml")],
    "sku-0034": [("RM-002", 18, "g"), ("RM-001", 120, "ml")],
    "sku-0030": [("RM-002", 18, "g"), ("RM-001", 200, "ml")],
    "sku-0041": [("RM-002", 18, "g"), ("RM-001", 200, "ml")],
    "sk-21244": [("RM-002", 18, "g"), ("RM-001", 200, "ml")],
    "sku-0036": [("RM-002", 18, "g"), ("RM-001", 50, "ml")],
    "sku-0042": [("RM-002", 18, "g"), ("RM-001", 200, "ml")],
    "sku-0031": [("RM-002", 18, "g"), ("RM-001", 200, "ml")],
    "sku-0032": [("RM-002", 18, "g"), ("RM-001", 200, "ml")],
    "sku-0043": [("RM-002", 18, "g"), ("RM-001", 200, "ml")],
    # حلويات ومخبوزات (قطعة واحدة كقاعدة) - use "slice" or "pcs"
    "sku-0063": [("RM-020", 1, "slice")],
    "sk-21157": [("RM-020", 1, "slice")],
    "sk-21237": [("RM-020", 1, "slice")],
    "sku-0003": [("RM-020", 1, "slice")],
    "sku-0061": [("RM-020", 1, "slice")],
    "sku-0060": [("RM-020", 1, "slice")],
    "sk-21150": [("RM-020", 1, "slice")],
    "sk-21225": [("RM-020", 1, "slice")],
    "sku-0059": [("RM-020", 1, "slice")],
    "sku-0058": [("RM-020", 1, "slice")],
    "sku-0052": [("RM-020", 1, "slice")],
    "sk-21147": [("RM-020", 1, "slice")],
    "sk-21223": [("RM-020", 1, "slice")],
    "sk-21065": [("RM-020", 1, "slice")],
    "sk-21226": [("RM-020", 1, "slice")],
    "sku-0067": [("RM-020", 1, "slice")],
    "sku-0056": [("RM-020", 1, "slice")],
    "sk-21071": [("RM-020", 1, "slice")],
    "sku-0055": [("RM-020", 1, "slice")],
    # سندوتشات
    "sku-0078": [("RM-020", 1, "slice")],
    "sku-0080": [("RM-020", 1, "slice")],
    "sku-0076": [("RM-020", 1, "slice")],
}


def ensure_ingredient(
    serial_code: str,
    name_en: str,
    name_ar: str,
    unit_code: str,
    units: dict,
    default_unit,
) -> Ingredient | None:
    """Get or create ingredient by serial_code."""
    ing = Ingredient.objects.filter(serial_code=serial_code).first()
    if ing:
        return ing
    unit = units.get(unit_code) or default_unit
    return Ingredient.objects.create(
        serial_code=serial_code,
        name_en=name_en,
        name_ar=name_ar,
        base_unit=unit,
    )


class Command(BaseCommand):
    help = "يربط جميع أصناف المبيعات الـ 55 بمكوناتها الصحيحة"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Preview without saving")

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN – no changes will be saved"))

        units_by_code = {u.code: u for u in Unit.objects.all()}
        default_unit = units_by_code.get("g") or units_by_code.get("pcs") or units_by_code.get("ml")
        if not default_unit:
            self.stdout.write(self.style.ERROR("No units found. Run seed_8oz_inventory first."))
            return

        # Ensure required ingredients exist (RM-001, RM-002, RM-003, RM-020 from seed or create)
        ingredients_by_serial = {}
        if not dry_run:
            for serial, name_en, name_ar, ucode in [
                ("RM-001", "Whole Milk", "حليب كامل الدسم", "ml"),
                ("RM-002", "Espresso Beans (8OZ)", "حبوب إسبريسو", "g"),
                ("RM-003", "Filter Beans (V60)", "حبوب قهوة مقطرة", "g"),
                ("RM-020", "Pastry Base", "مواد أولية حلويات", "slice"),
            ]:
                ing = ensure_ingredient(serial, name_en, name_ar, ucode, units_by_code, default_unit)
                ingredients_by_serial[serial] = ing
        else:
            for i in Ingredient.objects.filter(
                serial_code__in=["RM-001", "RM-002", "RM-003", "RM-020"]
            ):
                ingredients_by_serial[i.serial_code] = i
            for serial in ["RM-001", "RM-002", "RM-003", "RM-020"]:
                if serial not in ingredients_by_serial:
                    self.stdout.write(self.style.WARNING(f"  Ingredient {serial} would be created"))

        linked = 0
        skipped_not_found = 0
        skipped_missing_ing = 0

        for sku, lines in MAPPINGS.items():
            product = FoodicsProduct.objects.filter(foodics_product_id=sku).first()
            if not product:
                skipped_not_found += 1
                self.stdout.write(self.style.WARNING(f"  Product not found: {sku}"))
                continue

            resolved = []
            for ing_serial, qty, unit_code in lines:
                ing = ingredients_by_serial.get(ing_serial) if not dry_run else Ingredient.objects.filter(serial_code=ing_serial).first()
                if not ing:
                    skipped_missing_ing += 1
                    self.stdout.write(self.style.WARNING(f"  Missing ingredient {ing_serial} for {sku}"))
                    break
                u = units_by_code.get(unit_code) or default_unit
                resolved.append((ing, Decimal(str(qty)), u))

            if not resolved:
                continue

            if dry_run:
                self.stdout.write(f"  Would link: {sku} | {product.name} -> {len(resolved)} lines")
                linked += 1
                continue

            recipe, _ = Recipe.objects.get_or_create(
                product=product,
                defaults={"yield_qty": Decimal("1"), "yield_unit": default_unit},
            )
            RecipeLine.objects.filter(recipe=recipe).delete()

            for ing, qty, u in resolved:
                RecipeLine.objects.create(recipe=recipe, ingredient=ing, qty=qty, unit=u)

            linked += 1
            self.stdout.write(self.style.SUCCESS(f"  تم ربط المكونات لـ: {product.name}"))

        self.stdout.write(self.style.SUCCESS(f"تمت المعالجة: {linked} مرتبط، {skipped_not_found} غير موجود، {skipped_missing_ing} مكون ناقص"))
