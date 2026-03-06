# Merge migration: resolves the two-branch 0018 situation.
# Canonical chain: 0018_add_ingredient_package_model → 0018_ingredient_package_and_active → 0019 → 0020

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0018_ingredient_package_and_active'),
        ('inventory', '0019_migrate_existing_packages_to_model'),
    ]

    operations = [
    ]
