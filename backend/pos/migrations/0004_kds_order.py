"""Add KDSOrder model for Kitchen Display System."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0031_add_tenant"),
        ("pos", "0003_table_management"),
    ]

    operations = [
        migrations.CreateModel(
            name="KDSOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("branch", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="kds_orders",
                    to="org.branch",
                )),
                ("sale", models.OneToOneField(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="kds_order",
                    to="pos.saletransaction",
                )),
                ("order_number", models.CharField(db_index=True, max_length=32)),
                ("table_number", models.CharField(blank=True, default="", max_length=16)),
                ("items", models.JSONField(default=list)),
                ("kds_status", models.CharField(
                    choices=[
                        ("pending", "انتظار"),
                        ("cooking", "قيد التحضير"),
                        ("ready", "جاهز"),
                        ("delivered", "تم التسليم"),
                        ("cancelled", "ملغي"),
                    ],
                    default="pending",
                    db_index=True,
                    max_length=16,
                )),
                ("cooking_started_at", models.DateTimeField(blank=True, null=True)),
                ("ready_at", models.DateTimeField(blank=True, null=True)),
                ("delivered_at", models.DateTimeField(blank=True, null=True)),
                ("priority", models.PositiveSmallIntegerField(db_index=True, default=0)),
                ("notes", models.CharField(blank=True, default="", max_length=500)),
            ],
            options={"app_label": "pos", "ordering": ["priority", "created_at"]},
        ),
    ]
