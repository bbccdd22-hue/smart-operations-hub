# Add system_group for filtering (Raw Materials, Packaging)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0005_ingredient_package_workable"),
    ]

    operations = [
        migrations.AddField(
            model_name="ingredient",
            name="system_group",
            field=models.CharField(
                blank=True,
                choices=[
                    ("raw_materials", "Raw Materials"),
                    ("packaging", "Packaging"),
                    ("other", "Other"),
                ],
                db_index=True,
                default="raw_materials",
                max_length=32,
            ),
        ),
    ]
