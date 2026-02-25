# SystemErrorLog – سجل أخطاء النظام للمالك
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("org", "0018_add_in_transit_branch"),
    ]

    operations = [
        migrations.CreateModel(
            name="SystemErrorLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "error_type",
                    models.CharField(
                        choices=[
                            ("depletion_failed", "فشل خصم المخزون"),
                            ("upload_failed", "فشل رفع ملف"),
                            ("transfer_failed", "فشل التحويل"),
                            ("other", "أخرى"),
                        ],
                        db_index=True,
                        default="other",
                        max_length=32,
                    ),
                ),
                ("message", models.TextField()),
                ("traceback", models.TextField(blank=True, default="")),
                ("context", models.JSONField(blank=True, default=dict, help_text="مثل upload_id، branch_id، إلخ")),
                ("resolved", models.BooleanField(db_index=True, default=False)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="system_error_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "verbose_name": "System Error Log",
                "verbose_name_plural": "سجل أخطاء النظام",
            },
        ),
    ]
