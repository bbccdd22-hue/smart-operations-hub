# Generated migration: Brand.brand_code, Branch.branch_code for strict code-based mapping

from django.db import migrations, models


def set_brand_codes(apps, schema_editor):
    Brand = apps.get_model("org", "Brand")
    codes = {
        "8oz": "001",
        "hemi": "002",
        "sweet bread": "003",
        "sweetbread": "003",
        "blanca": "004",
        "tea plus": "005",
        "teaplus": "005",
        "chart": "006",
    }
    for b in Brand.objects.all():
        slug_lower = (b.slug or "").lower().strip()
        code = codes.get(slug_lower)
        if code:
            b.brand_code = code
        else:
            b.brand_code = f"gen{b.id:03d}"  # Unique for uncoded brands
        b.save(update_fields=["brand_code"])


def set_8oz_branch_codes(apps, schema_editor):
    Branch = apps.get_model("org", "Branch")
    Brand = apps.get_model("org", "Brand")
    brand_8oz = Brand.objects.filter(slug__iexact="8oz").first()
    if not brand_8oz:
        return
    # [Ref: 890f7b] Exact mapping: Arabic name -> Branch Code
    mappings = [
        ("مكه كشك الدائري الرابع", "B30"),
        ("مكة كشك الدائري الرابع", "B30"),
        ("فرع مكة العوالي", "B34"),
        ("مكة العوالي", "B34"),
        ("مكة كشك العوالي", "B35"),
        ("مكه كشك العوالي", "B35"),
        ("مكة الرصيفة", "B36"),
        ("مكه الرصيفة", "B36"),
        ("مكة الشرايع", "B37"),
        ("مكه الشرايع", "B37"),
        ("مكه العمرة", "B47"),
        ("مكة العمرة", "B47"),
    ]
    # Fallback: partial match (الدائري, العوالي, الرصيفة, الشرائع, العمرة)
    fallback = [
        ("الدائري الرابع", "B30"),
        ("كشك العوالي", "B35"),
        ("فرع مكة العوالي", "B34"),
        ("العوالي", "B34"),
        ("الرصيفة", "B36"),
        ("الشرائع", "B37"),
        ("العمرة", "B47"),
    ]
    for branch in Branch.objects.filter(brand=brand_8oz):
        name_ar = (branch.name_ar or "").strip()
        name = (branch.name or "").strip()
        assigned = False
        for pattern, bc in mappings:
            if pattern in name_ar or pattern in name:
                branch.branch_code = bc
                branch.save(update_fields=["branch_code"])
                assigned = True
                break
        if not assigned:
            for pattern, bc in fallback:
                if (pattern in name_ar or pattern in name) and not branch.branch_code:
                    branch.branch_code = bc
                    branch.save(update_fields=["branch_code"])
                    assigned = True
                    break
        if not assigned and not branch.branch_code:
            branch.branch_code = f"gen{branch.id}"
            branch.save(update_fields=["branch_code"])

    # Assign unique gen{id} to non-8OZ branches (for unique constraint)
    for branch in Branch.objects.exclude(brand=brand_8oz).filter(branch_code=""):
        branch.branch_code = f"gen{branch.id}"
        branch.save(update_fields=["branch_code"])


def reverse_brand_codes(apps, schema_editor):
    Brand = apps.get_model("org", "Brand")
    Brand.objects.all().update(brand_code="")


def reverse_branch_codes(apps, schema_editor):
    Branch = apps.get_model("org", "Branch")
    Branch.objects.all().update(branch_code="")


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0004_saved_view"),
    ]

    operations = [
        migrations.AddField(
            model_name="brand",
            name="brand_code",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Code-based identifier (e.g. 001 for 8OZ). Required for data integrity.",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="branch",
            name="branch_code",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Excel Branch Code (e.g. B30, B34). Mandatory for 8OZ. Used for strict data mapping.",
                max_length=32,
            ),
        ),
        migrations.RunPython(set_brand_codes, reverse_brand_codes),
        migrations.RunPython(set_8oz_branch_codes, reverse_branch_codes),
        migrations.AlterField(
            model_name="brand",
            name="brand_code",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Code-based identifier (e.g. 001 for 8OZ). Required for data integrity.",
                max_length=16,
                unique=True,
            ),
        ),
        migrations.AlterField(
            model_name="branch",
            name="branch_code",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Excel Branch Code (e.g. B30, B34). Mandatory for 8OZ. Used for strict data mapping.",
                max_length=32,
            ),
        ),
    ]
