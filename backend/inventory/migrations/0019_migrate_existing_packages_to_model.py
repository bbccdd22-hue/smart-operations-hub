"""Migrate existing single-package data from Ingredient fields to IngredientPackage rows."""
from django.db import migrations


def forwards(apps, schema_editor):
    Ingredient = apps.get_model("inventory", "Ingredient")
    IngredientPackage = apps.get_model("inventory", "IngredientPackage")

    for ing in Ingredient.objects.all():
        if ing.package_conversion_factor and ing.package_conversion_factor > 0:
            has_name = ing.package_name_en or ing.package_name_ar
            if has_name:
                is_default = ing.default_display_unit == "package"
                IngredientPackage.objects.create(
                    ingredient=ing,
                    name_en=ing.package_name_en or "",
                    name_ar=ing.package_name_ar or "",
                    conversion_factor=ing.package_conversion_factor,
                    is_active=ing.package_is_active,
                    is_default=is_default,
                    sort_order=0,
                )


def backwards(apps, schema_editor):
    IngredientPackage = apps.get_model("inventory", "IngredientPackage")
    IngredientPackage.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0018_add_ingredient_package_model"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
