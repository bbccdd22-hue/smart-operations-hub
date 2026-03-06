# Design Robot Phase 1: JournalEntryLine.metadata + JournalEntryCustomColumn

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0016_journalentry_reference"),
    ]

    operations = [
        migrations.AddField(
            model_name="journalentryline",
            name="metadata",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="حقول مخصصة: purchase_date, invoice_ref, vendor_name, إلخ",
            ),
        ),
        migrations.CreateModel(
            name="JournalEntryCustomColumn",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "name",
                    models.CharField(
                        db_index=True,
                        help_text="Internal key (e.g. purchase_date, invoice_ref, vendor_name)",
                        max_length=64,
                        unique=True,
                    ),
                ),
                ("label", models.CharField(help_text="Display label (e.g. Maintenance Date)", max_length=128)),
                (
                    "field_type",
                    models.CharField(
                        choices=[("text", "Text"), ("number", "Number"), ("date", "Date")],
                        db_index=True,
                        default="text",
                        max_length=16,
                    ),
                ),
                ("order", models.PositiveSmallIntegerField(default=0, help_text="Display order")),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["order", "name"],
                "verbose_name": "Journal Entry Custom Column",
                "verbose_name_plural": "Journal Entry Custom Columns",
            },
        ),
    ]
