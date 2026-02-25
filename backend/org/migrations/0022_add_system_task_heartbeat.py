# نبض المهام الخلفية – مراقبة صحة المهام التلقائية

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0021_add_system_error_log_uuid"),
    ]

    operations = [
        migrations.CreateModel(
            name="SystemTaskHeartbeat",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("task_name", models.CharField(db_index=True, max_length=64, unique=True)),
                ("last_run_at", models.DateTimeField(blank=True, null=True)),
                ("last_status", models.CharField(
                    choices=[("ok", "OK"), ("error", "Error"), ("warning", "Warning"), ("unknown", "Unknown")],
                    default="unknown",
                    max_length=16,
                )),
                ("last_message", models.CharField(blank=True, default="", max_length=500)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "System Task Heartbeat",
                "verbose_name_plural": "نبض المهام الخلفية",
            },
        ),
    ]
