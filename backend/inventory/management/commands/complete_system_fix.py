"""
Complete system update and data mapping.
- Cleanup: Delete FoodicsProduct where name contains "Pager"
- Unit setup: Ensure جرام, مل, حبة exist
- Ingredient mapping: Link SKUs to ingredients with Recipe/RecipeLine (qty 1)
Run: python manage.py complete_system_fix
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import FoodicsProduct, Ingredient, Recipe, RecipeLine, Unit

# Units to ensure: (code, name_en, name_ar)
UNITS = [
    ("g", "Gram", "جرام"),
    ("ml", "Milliliter", "مل"),
    ("piece", "Piece", "حبة"),
]

# SKU -> (ingredient_name_ar, unit_code)
MAPPINGS = [
    # Juice concentrate
    (["sku-0049", "sku-0051", "sku-0050"], "مركز عصائر", "ml"),
    # Chocolate powder
    (["sku-0037", "sk-21176"], "بودرة شوكولاتة", "g"),
    # Tea bags
    (["sku-0038", "sku-0047"], "أكياس شاي", "piece"),
    # Dolmia water
    (["sku-0081"], "مياه دولميا", "piece"),
    # Matcha powder
    (["sk-21245"], "بودرة ماتشا", "g"),
]

# ingredient_name_ar -> (name_en, serial_code)
INGREDIENT_DEFAULTS = {
    "مركز عصائر": ("Juice Concentrate", "RM-JC"),
    "بودرة شوكولاتة": ("Chocolate Powder", "RM-CP"),
    "أكياس شاي": ("Tea Bags", "RM-TB"),
    "مياه دولميا": ("Dolmia Water", "RM-DW"),
    "بودرة ماتشا": ("Matcha Powder", "RM-004"),  # May exist from seed
}


class Command(BaseCommand):
    help = "Complete system fix: cleanup Pager, ensure units, map SKUs to ingredients."

    @transaction.atomic
    def handle(self, *args, **options):
        # 1. CLEANUP: Delete FoodicsProduct where name contains "Pager"
        deleted, _ = FoodicsProduct.objects.filter(name__icontains="Pager").delete()
        self.stdout.write(f"Deleted {deleted} Pager product(s)")

        # 2. UNIT SETUP: Ensure جرام, مل, حبة exist
        units_by_code = {}
        for code, name_en, name_ar in UNITS:
            u, created = Unit.objects.get_or_create(
                code=code,
                defaults={"name_en": name_en, "name_ar": name_ar},
            )
            if not created and (u.name_ar != name_ar or u.name_en != name_en):
                u.name_en = name_en
                u.name_ar = name_ar
                u.save()
            units_by_code[code] = u
        self.stdout.write(f"Units ensured: {list(units_by_code.keys())}")

        # 3. INGREDIENT MAPPING: Get or create ingredients by name_ar
        ingredients_by_name_ar = {}
        for name_ar, (name_en, serial) in INGREDIENT_DEFAULTS.items():
            ing = Ingredient.objects.filter(name_ar__iexact=name_ar).first()
            if not ing:
                ing = Ingredient.objects.filter(name_en__iexact=name_en).first()
            if not ing:
                unit_code = "g"  # Will be overwritten per mapping
                for _, _name_ar, ucode in MAPPINGS:
                    if _name_ar == name_ar:
                        unit_code = ucode
                        break
                u = units_by_code.get(unit_code) or units_by_code["g"]
                ing = Ingredient.objects.create(
                    name_en=name_en,
                    name_ar=name_ar,
                    serial_code=serial,
                    base_unit=u,
                    is_active=True,
                )
            else:
                # Update base_unit if needed for the mapping
                for _, _name_ar, ucode in MAPPINGS:
                    if _name_ar == name_ar:
                        u = units_by_code.get(ucode)
                        if u and ing.base_unit_id != u.id:
                            ing.base_unit = u
                            ing.save(update_fields=["base_unit"])
                        break
            ingredients_by_name_ar[name_ar] = ing

        # 4. RE-SYNC: Create/update Recipe and RecipeLine for each SKU
        default_unit = units_by_code.get("g") or units_by_code.get("ml") or units_by_code.get("piece")
        linked = 0

        for skus, ing_name_ar, unit_code in MAPPINGS:
            ing = ingredients_by_name_ar.get(ing_name_ar)
            u = units_by_code.get(unit_code) or default_unit
            if not ing:
                self.stdout.write(self.style.WARNING(f"  Ingredient not found: {ing_name_ar}"))
                continue

            for sku in skus:
                product = FoodicsProduct.objects.filter(foodics_product_id__iexact=sku).first()
                if not product:
                    product, _ = FoodicsProduct.objects.get_or_create(
                        foodics_product_id=sku,
                        defaults={
                            "name": f"{ing.name_en} ({sku})",
                            "is_active": True,
                            "sales_unit": u,
                        },
                    )

                recipe, _ = Recipe.objects.get_or_create(
                    product=product,
                    defaults={"yield_qty": Decimal("1"), "yield_unit": u},
                )
                RecipeLine.objects.filter(recipe=recipe).delete()
                RecipeLine.objects.create(
                    recipe=recipe,
                    ingredient=ing,
                    qty=Decimal("1"),
                    unit=u,
                )
                linked += 1
                self.stdout.write(self.style.SUCCESS(f"  Linked {sku} -> {ing_name_ar}"))

        self.stdout.write(self.style.SUCCESS("اكتمل التحديث بنجاح"))
