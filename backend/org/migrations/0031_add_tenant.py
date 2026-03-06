"""Add Tenant model — SaaS multi-tenant layer above Organization."""
import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("org", "0030_branch_pos_depletion_enabled"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Tenant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("uuid", models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)),
                ("name", models.CharField(max_length=200, help_text="اسم الشركة العميلة")),
                ("name_ar", models.CharField(blank=True, default="", max_length=200)),
                ("slug", models.SlugField(
                    max_length=63, unique=True, db_index=True,
                    help_text="يُستخدم كـ subdomain: {slug}.smartops.com",
                )),
                ("plan", models.CharField(
                    choices=[
                        ("trial", "تجريبي (14 يوم)"),
                        ("starter", "Starter – فرع واحد"),
                        ("growth", "Growth – حتى 5 فروع"),
                        ("pro", "Pro – حتى 20 فرع"),
                        ("enterprise", "Enterprise – غير محدود"),
                    ],
                    default="trial", max_length=20, db_index=True,
                )),
                ("trial_ends_at", models.DateTimeField(blank=True, null=True)),
                ("subscription_ends_at", models.DateTimeField(blank=True, null=True)),
                ("max_branches", models.PositiveSmallIntegerField(default=1)),
                ("is_active", models.BooleanField(default=True, db_index=True)),
                ("onboarding_complete", models.BooleanField(default=False)),
                ("organization", models.OneToOneField(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="tenant",
                    to="org.organization",
                    help_text="المؤسسة الرئيسية التابعة لهذا الـ Tenant",
                )),
                ("admin_user", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="owned_tenants",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "verbose_name": "Tenant (عميل SaaS)",
                "verbose_name_plural": "Tenants (عملاء SaaS)",
                "ordering": ["name"],
            },
        ),
    ]
