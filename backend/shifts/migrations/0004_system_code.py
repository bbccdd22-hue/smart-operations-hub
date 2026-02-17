# Generated migration: Add system_code for ERP hierarchy indexing

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shifts", "0003_add_submission_flow"),
    ]

    operations = [
        migrations.AddField(
            model_name="shift",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="SH1001",
                help_text="ERP hierarchy code (Shift)",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="shiftclosing",
            name="system_code",
            field=models.CharField(
                db_index=True,
                default="SH1002",
                help_text="ERP hierarchy code (Shift Closing)",
                max_length=16,
            ),
        ),
    ]
