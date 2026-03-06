"""
Create a demo tenant for production.
Usage: python manage.py create_demo_tenant [--slug demo-riyadh]
"""
import uuid

from django.core.management.base import BaseCommand

from onboarding.demo_seeder import full_tenant_setup
from org.models import Organization, Tenant, TenantPlan


class Command(BaseCommand):
    help = "Create a demo tenant (org + brand + branch + COA) for production first-run."

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug",
            type=str,
            default="demo-riyadh",
            help="Tenant slug (default: demo-riyadh)",
        )
        parser.add_argument(
            "--company",
            type=str,
            default="Demo Coffee الرياض",
            help="Company name",
        )
        parser.add_argument(
            "--brand",
            type=str,
            default="قهوة الرياض",
            help="Brand name",
        )

    def handle(self, *args, **options):
        slug = options["slug"]
        company_name = options["company"]
        brand_name = options["brand"]

        if Tenant.objects.filter(slug=slug).exists():
            self.stdout.write(self.style.WARNING(f"Tenant '{slug}' already exists. Skipping."))
            return

        org_code = f"DEMO-{slug.upper().replace('-', '')[:6]}-{uuid.uuid4().hex[:4]}"
        org_slug = f"{slug}-{uuid.uuid4().hex[:6]}"
        org = Organization.objects.create(
            name=company_name,
            org_code=org_code,
            slug=org_slug,
        )
        result = full_tenant_setup(organization=org, brand_name=brand_name)

        from django.contrib.auth import get_user_model

        User = get_user_model()
        admin_user, _ = User.objects.get_or_create(
            username="demo",
            defaults={"is_staff": True, "is_superuser": False},
        )
        admin_user.set_password("DemoPass123!")
        admin_user.save()

        tenant = Tenant.objects.create(
            name=company_name,
            slug=slug,
            organization=org,
            plan=TenantPlan.TRIAL,
            admin_user=admin_user,
            onboarding_complete=True,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo tenant created: {tenant.slug} -> {result['brand'].name} / {result['branch'].name}"
            )
        )
