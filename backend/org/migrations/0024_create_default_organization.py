# Generated migration - إنشاء مؤسسة افتراضية وربط العلامات التجارية
from django.db import migrations


def create_default_org(apps, schema_editor):
    Organization = apps.get_model("org", "Organization")
    Brand = apps.get_model("org", "Brand")
    if not Organization.objects.exists():
        org = Organization.objects.create(
            name="Default Organization",
            name_ar="المؤسسة الافتراضية",
            slug="default",
            org_code="ORG001",
        )
        Brand.objects.filter(organization__isnull=True).update(organization=org)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0023_organization_alter_adminnotification_event_type_and_more"),
    ]

    operations = [
        migrations.RunPython(create_default_org, noop),
    ]
