# Generated migration: Add system_code for ERP hierarchy indexing

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("imports", "0005_dailysale_average_order"),
    ]

    operations = [
        migrations.AddField(
            model_name="productsale",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="SP1003",
                help_text="ERP hierarchy code (Product Sale)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="dailysale",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="SD1001",
                help_text="ERP hierarchy code (Daily Sale)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="hourlysale",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="SD1002",
                help_text="ERP hierarchy code (Hourly Sale)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="excelupload",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="SU1004",
                help_text="ERP hierarchy code (Excel Upload)",
                max_length=16,
            ),
        ),
    ]
