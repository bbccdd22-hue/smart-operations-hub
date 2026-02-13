# Generated migration for Product Catalog: sales_unit, price_excl_tax

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="foodicsproduct",
            name="sales_unit",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="products",
                to="inventory.unit",
            ),
        ),
        migrations.AddField(
            model_name="foodicsproduct",
            name="price_excl_tax",
            field=models.DecimalField(
                blank=True, decimal_places=4, max_digits=14, null=True
            ),
        ),
    ]
