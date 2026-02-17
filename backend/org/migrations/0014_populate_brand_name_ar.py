# Populate name_ar for existing brands (default Arabic labels)

from django.db import migrations


def populate_name_ar(apps, schema_editor):
    Brand = apps.get_model("org", "Brand")
    mapping = {
        "hemi": "هيمي",
        "8oz": "8 أوقية",
        "sweet bread": "سويت بريد",
        "sweetbread": "سويت بريد",
        "blanca": "بلانكا",
        "tea plus": "تي بلس",
        "teaplus": "تي بلس",
        "chart": "تشارت",
    }
    for b in Brand.objects.all():
        slug = (b.slug or "").lower().strip()
        if slug in mapping and not (b.name_ar or "").strip():
            b.name_ar = mapping[slug]
            b.save(update_fields=["name_ar"])


def reverse_populate(apps, schema_editor):
    Brand = apps.get_model("org", "Brand")
    Brand.objects.all().update(name_ar="")


class Migration(migrations.Migration):
    dependencies = [("org", "0013_add_brand_name_ar")]

    operations = [migrations.RunPython(populate_name_ar, reverse_populate)]
