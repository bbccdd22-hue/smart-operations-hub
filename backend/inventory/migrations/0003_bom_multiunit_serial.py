# BOM Upgrade: Unit conversion, Ingredient serial codes

import decimal
import django.db.models.deletion
from django.db import migrations, models


def create_base_units(apps, schema_editor):
    """Ensure ml and g exist as base units; add conversion factors for common units."""
    Unit = apps.get_model("inventory", "Unit")
    ml = Unit.objects.filter(code__iexact="ml").first()
    if not ml:
        ml = Unit.objects.create(code="ml", name_en="Milliliter", name_ar="مل")
    g = Unit.objects.filter(code__iexact="g").first()
    if not g:
        g = Unit.objects.create(code="g", name_en="Gram", name_ar="جرام")
    ml.base_unit_id = None
    ml.factor_to_base = decimal.Decimal("1")
    ml.save()
    g.base_unit_id = None
    g.factor_to_base = decimal.Decimal("1")
    g.save()

    # L, liter, liter(s) -> base ML, factor 1000
    for code in ("l", "liter", "liters", "لتر"):
        Unit.objects.filter(code__iexact=code).update(
            base_unit_id=ml.id, factor_to_base=decimal.Decimal("1000")
        )
    # kg, kilogram -> base g, factor 1000
    for code in ("kg", "kilogram", "kilograms", "كيلو"):
        Unit.objects.filter(code__iexact=code).update(
            base_unit_id=g.id, factor_to_base=decimal.Decimal("1000")
        )


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0002_product_catalog_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="unit",
            name="base_unit",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="derived_units",
                to="inventory.unit",
            ),
        ),
        migrations.AddField(
            model_name="unit",
            name="factor_to_base",
            field=models.DecimalField(
                decimal_places=6,
                max_digits=18,
                default=decimal.Decimal("1"),
                help_text="1 unit = factor_to_base of base unit (e.g. 1 L = 1000 ML)",
            ),
        ),
        migrations.AddField(
            model_name="ingredient",
            name="serial_code",
            field=models.CharField(
                blank=True,
                default="",
                max_length=64,
                db_index=True,
                help_text="Unique serial/code from Excel import",
            ),
        ),
        migrations.RunPython(create_base_units, migrations.RunPython.noop),
    ]
