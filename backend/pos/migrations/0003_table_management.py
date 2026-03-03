"""Add RestaurantTable and TableMerge models for table management."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0031_add_tenant"),
        ("pos", "0002_pos_modifiers_split_wallet"),
    ]

    operations = [
        migrations.CreateModel(
            name="RestaurantTable",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("branch", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="tables",
                    to="org.branch",
                )),
                ("number", models.CharField(max_length=16)),
                ("capacity", models.PositiveSmallIntegerField(default=4)),
                ("status", models.CharField(
                    choices=[
                        ("available", "فارغة"),
                        ("occupied", "محتلة"),
                        ("reserved", "محجوزة"),
                        ("paid", "مدفوعة"),
                        ("cleaning", "قيد التنظيف"),
                    ],
                    default="available",
                    max_length=16,
                    db_index=True,
                )),
                ("current_sale", models.OneToOneField(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="table",
                    to="pos.saletransaction",
                )),
                ("pos_x", models.SmallIntegerField(default=0)),
                ("pos_y", models.SmallIntegerField(default=0)),
                ("section", models.CharField(blank=True, default="", max_length=64)),
                ("is_active", models.BooleanField(default=True)),
                ("notes", models.CharField(blank=True, default="", max_length=255)),
            ],
            options={"ordering": ["branch", "section", "number"]},
        ),
        migrations.AddConstraint(
            model_name="restauranttable",
            constraint=models.UniqueConstraint(
                fields=["branch", "number"], name="uniq_branch_table_number"
            ),
        ),
        migrations.CreateModel(
            name="TableMerge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("primary_table", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="merged_primaries",
                    to="pos.restauranttable",
                )),
                ("secondary_table", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="merged_secondaries",
                    to="pos.restauranttable",
                )),
                ("merged_sale", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="merged_tables",
                    to="pos.saletransaction",
                )),
                ("merged_at", models.DateTimeField(auto_now_add=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"ordering": ["-merged_at"]},
        ),
    ]
