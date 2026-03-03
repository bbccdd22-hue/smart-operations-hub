# Generated migration for JournalEntry.reference (المرجع)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0015_add_journal_entry_line_dimensions"),
    ]

    operations = [
        migrations.AddField(
            model_name="journalentry",
            name="reference",
            field=models.CharField(
                blank=True,
                default="",
                help_text="رقم أو مرجع القيد (المرجع)",
                max_length=64,
            ),
        ),
    ]
