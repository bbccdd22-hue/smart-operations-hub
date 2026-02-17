# Populate chart_rev_prefix and chart_exp_prefix for brands matching chart structure
# هيكلة الدليل المحاسبي 240: 0410101=HEMI, 0410102=8OZ, 0410103=Sweet Bread

from django.db import migrations


def populate_chart_prefixes(apps, schema_editor):
    Brand = apps.get_model("org", "Brand")
    mapping = {
        "hemi": ("0410101", "051010101"),
        "8oz": ("0410102", "051010102"),
        "sweet bread": ("0410103", "051010103"),
        "sweetbread": ("0410103", "051010103"),
    }
    for b in Brand.objects.all():
        slug = (b.slug or "").lower().strip()
        if slug in mapping:
            rev, exp = mapping[slug]
            b.chart_rev_prefix = rev
            b.chart_exp_prefix = exp
            b.save(update_fields=["chart_rev_prefix", "chart_exp_prefix"])


def reverse_populate(apps, schema_editor):
    Brand = apps.get_model("org", "Brand")
    Brand.objects.all().update(chart_rev_prefix="", chart_exp_prefix="")


class Migration(migrations.Migration):
    dependencies = [("org", "0011_add_brand_chart_prefixes")]

    operations = [migrations.RunPython(populate_chart_prefixes, reverse_populate)]
