"""
Inspect BOM links: Products -> Recipe -> Ingredients.
Usage: python manage.py inspect_bom [--sku sku-0108]
"""
from django.core.management.base import BaseCommand

from inventory.models import FoodicsProduct, Recipe, RecipeLine


class Command(BaseCommand):
    help = "Inspect BOM: which products have recipes and ingredients"

    def add_arguments(self, parser):
        parser.add_argument("--sku", type=str, help="Filter by product SKU (foodics_product_id)")

    def handle(self, *args, **options):
        sku_filter = (options.get("sku") or "").strip()
        qs = FoodicsProduct.objects.all().order_by("foodics_product_id")
        if sku_filter:
            qs = qs.filter(foodics_product_id__icontains=sku_filter)

        total = 0
        with_recipe = 0
        for p in qs[:50]:
            total += 1
            try:
                r = p.recipe
                lines = list(RecipeLine.objects.filter(recipe=r).select_related("ingredient", "unit"))
                with_recipe += 1
                self.stdout.write(
                    f"  {p.foodics_product_id} (id={p.id}) | {p.name[:30]} | {len(lines)} ingredients"
                )
                for ln in lines[:5]:
                    self.stdout.write(f"    - {ln.ingredient.serial_code or '?'} {ln.ingredient.name_en} {ln.qty} {ln.unit.code}")
            except Exception:
                self.stdout.write(self.style.WARNING(f"  {p.foodics_product_id} (id={p.id}) | NO RECIPE"))
        self.stdout.write(self.style.SUCCESS(f"Shown: {total} products, {with_recipe} with BOM"))
