# [Ref: 2026-02-13] Add all_brands (BooleanField) and brand_ids (JSONField) to UserProfile
# all_brands: General Manager unrestricted access
# brand_ids: Brands Supervisor scoped access (list of brand IDs)
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("org", "0005_brand_branch_codes")]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="all_brands",
            field=models.BooleanField(
                default=False,
                help_text="If True, user has access to all brands (General Manager).",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="brand_ids",
            field=models.JSONField(
                default=list,
                blank=True,
                help_text="List of brand IDs when user has multiple brands (Brands Supervisor).",
            ),
        ),
    ]
