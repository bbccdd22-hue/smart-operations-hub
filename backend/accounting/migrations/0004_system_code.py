# Generated migration: Add system_code for ERP hierarchy indexing

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0003_add_foodics_payment_record"),
    ]

    operations = [
        migrations.AddField(
            model_name="foodicssettlement",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="AC1001",
                help_text="ERP hierarchy code (Foodics Settlement)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="foodicspaymentrecord",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="AC1002",
                help_text="ERP hierarchy code (Foodics Payment)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="dailyaccountingstatus",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="AC1003",
                help_text="ERP hierarchy code (Daily Accounting)",
                max_length=16,
            ),
        ),
    ]
