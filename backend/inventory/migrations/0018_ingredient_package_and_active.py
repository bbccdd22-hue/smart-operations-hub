# Generated for Item File multi-unit architecture (FIXED: depends on 0018_add_ingredient_package_model)
# The IngredientPackage table is already created by 0018_add_ingredient_package_model.
# This migration only adds active_package FK on Ingredient and runs the data migration.

from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


def migrate_existing_packages(apps, schema_editor):
    """Create IngredientPackage rows from legacy single-package Ingredient fields."""
    Ingredient = apps.get_model("inventory", "Ingredient")
    IngredientPackage = apps.get_model("inventory", "IngredientPackage")
    for ing in Ingredient.objects.all():
        if ing.package_conversion_factor and ing.package_conversion_factor > 0:
            name_en = (ing.package_name_en or ing.package_name_ar or "Package").strip() or "Package"
            pkg, _ = IngredientPackage.objects.get_or_create(
                ingredient=ing,
                name_en=name_en,
                defaults={
                    "name_ar": ing.package_name_ar or "",
                    "conversion_factor": ing.package_conversion_factor,
                    "is_active": getattr(ing, "package_is_active", True),
                    "sort_order": 0,
                },
            )


def reverse_migrate(apps, schema_editor):
    pass  # No destructive reverse for data


class Migration(migrations.Migration):

    dependencies = [
        # Now correctly depends on the other 0018 that creates the table first.
        ("inventory", "0018_add_ingredient_package_model"),
    ]

    operations = [
        # The IngredientPackage model was already created by 0018_add_ingredient_package_model.
        # We only need to add the active_package FK and migrate existing data.
        migrations.AddField(
            model_name="ingredient",
            name="active_package",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="inventory.ingredientpackage",
            ),
        ),
        migrations.RunPython(migrate_existing_packages, reverse_migrate),
    ]
