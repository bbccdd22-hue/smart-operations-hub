# PR1002: Workable units (كرتون، علبة) for Prep List aggregation

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0004_system_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="ingredient",
            name="package_conversion_factor",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text="Base units per package (e.g. 12 for 12 pcs per carton)",
                max_digits=18,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="ingredient",
            name="package_name_ar",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="ingredient",
            name="package_name_en",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
    ]
