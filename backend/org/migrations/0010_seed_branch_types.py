# Generated manually to seed default BranchType options

from django.db import migrations


def seed_branch_types(apps, schema_editor):
    BranchType = apps.get_model("org", "BranchType")
    if BranchType.objects.exists():
        return
    BranchType.objects.bulk_create([
        BranchType(option_code="TYPE-01", name_en="Branch", name_ar="فرع"),
        BranchType(option_code="TYPE-02", name_en="Kiosk", name_ar="كشك"),
    ])


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0009_add_system_options_district_branch_type"),
    ]

    operations = [
        migrations.RunPython(seed_branch_types, migrations.RunPython.noop),
    ]
