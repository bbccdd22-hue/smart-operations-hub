# In-transit branch for inventory between create and confirm of stock transfers
from django.db import migrations


def create_in_transit_branch(apps, schema_editor):
    Brand = apps.get_model("org", "Brand")
    City = apps.get_model("org", "City")
    Branch = apps.get_model("org", "Branch")

    brand, _ = Brand.objects.get_or_create(
        name="System",
        defaults={"name_ar": "النظام", "slug": "system", "is_active": True},
    )
    if not brand.slug:
        brand.slug = "system"
        brand.save(update_fields=["slug"])

    city, _ = City.objects.get_or_create(
        code="in-transit",
        defaults={"name_en": "In-Transit", "name_ar": "قيد النقل", "is_active": True},
    )

    Branch.objects.get_or_create(
        brand=brand,
        code="in-transit",
        defaults={
            "name": "In-Transit Inventory",
            "name_ar": "مخزون قيد النقل",
            "city": city,
            "branch_code": "IN_TRANSIT",
            "is_active": True,
        },
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0017_add_stock_transfer"),
    ]

    operations = [
        migrations.RunPython(create_in_transit_branch, noop),
    ]
