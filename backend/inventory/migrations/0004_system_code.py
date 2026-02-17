# Generated migration: Add system_code for ERP hierarchy indexing

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0003_bom_multiunit_serial"),
    ]

    operations = [
        migrations.AddField(
            model_name="unit",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="IU1002",
                help_text="ERP hierarchy code (Unit)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="ingredient",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="IU1003",
                help_text="ERP hierarchy code (Ingredient)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="foodicsproduct",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="IU1004",
                help_text="ERP hierarchy code (Product)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="recipe",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="PR1001",
                help_text="ERP hierarchy code (Recipe/BOM)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="recipeline",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="PR1003",
                help_text="ERP hierarchy code (Recipe Line)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="branchstock",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="IU1005",
                help_text="ERP hierarchy code (Branch Stock)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="stockmovement",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="IU1006",
                help_text="ERP hierarchy code (Stock Movement)",
                max_length=16,
            ),
        ),
    ]
