# Generated migration: Add system_code for ERP hierarchy indexing

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0006_user_profile_brand_ids"),
    ]

    operations = [
        migrations.AddField(
            model_name="branch",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="OR1001",
                help_text="ERP hierarchy code (Branch)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="brand",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="OR1002",
                help_text="ERP hierarchy code (Brand)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="city",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="OR1003",
                help_text="ERP hierarchy code (City)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="OR1004",
                help_text="ERP hierarchy code (User Profile)",
                max_length=16,
            ),
        ),
    ]
