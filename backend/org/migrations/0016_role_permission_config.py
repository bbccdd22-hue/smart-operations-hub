# Generated manually for role permissions config

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0015_add_activity_log_and_roles"),
    ]

    operations = [
        migrations.CreateModel(
            name="RolePermissionConfig",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(db_index=True, max_length=32, unique=True)),
                ("permissions", models.JSONField(default=dict, help_text='{"view_financial_reports": true, "upload_files": true, "view_activity_log": false, "edit_chart_of_accounts": false}')),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Role Permission Config",
                "verbose_name_plural": "Role Permission Configs",
            },
        ),
    ]
