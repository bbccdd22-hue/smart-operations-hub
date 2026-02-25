# ChartAccount: مخزون قيد النقل (In-Transit Inventory)
from decimal import Decimal

from django.db import migrations


def create_in_transit_account(apps, schema_editor):
    ChartAccount = apps.get_model("accounting", "ChartAccount")
    if ChartAccount.objects.filter(code="01101403").exists():
        return
    parent = ChartAccount.objects.filter(code="011014").first()
    ChartAccount.objects.get_or_create(
        code="01101403",
        defaults={
            "name_ar": "مخزون قيد النقل",
            "name_en": "In-Transit Inventory",
            "level": 4,
            "parent": parent,
            "account_type": "تحليلي",
            "statement": "المركز المالي",
            "is_active": True,
            "balance": Decimal("0.00"),
        },
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0010_add_journal_entry"),
    ]

    operations = [
        migrations.RunPython(create_in_transit_account, noop),
    ]
