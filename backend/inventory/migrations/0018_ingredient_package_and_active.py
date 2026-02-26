# Generated for Item File multi-unit architecture

from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


def migrate_existing_packages(apps, schema_editor):
    """Create IngredientPackage from legacy package_* fields."""
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
            if getattr(ing, "default_display_unit", "base") == "package":
                ing.active_package = pkg
                ing.save(update_fields=["active_package"])


def reverse_migrate(apps, schema_editor):
    pass  # No destructive reverse for data


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0017_add_default_display_unit"),
    ]

    operations = [
        migrations.CreateModel(
            name="IngredientPackage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name_en", models.CharField(max_length=64)),
                ("name_ar", models.CharField(blank=True, default="", max_length=64)),
                ("conversion_factor", models.DecimalField(decimal_places=6, max_digits=18)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveSmallIntegerField(db_index=True, default=0)),
                ("ingredient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="packages", to="inventory.ingredient")),
            ],
            options={
                "ordering": ["sort_order", "id"],
                "unique_together": {("ingredient", "name_en")},
            },
        ),
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
