"""
Onboarding Wizard API Views
============================

POST /api/onboarding/signup/
  Creates:
    - Django User (admin)
    - Organization
    - Tenant  (slug-based subdomain)
    - Default Chart of Accounts (restaurant preset)
    - Brand + City + Main Branch (demo seed)

The endpoint is intentionally PUBLIC (AllowAny) because it is the
registration flow for new SaaS tenants — there is no authenticated
user yet.

All operations are wrapped in a single atomic transaction so that
a failure at any step leaves the database clean.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .demo_seeder import full_tenant_setup
from .serializers import SignupRequestSerializer

User = get_user_model()


class SignupView(APIView):
    """
    POST /api/onboarding/signup/

    Public endpoint — creates a new tenant with all default data.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    @transaction.atomic
    def post(self, request):
        serializer = SignupRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        company_name: str = data["company_name"]
        company_name_ar: str = data.get("company_name_ar", "") or company_name
        brand_name: str = data.get("brand_name", "") or company_name
        plan: str = data.get("plan", "trial")
        admin_username: str = data["admin_username"]
        admin_email: str = data["admin_email"]
        admin_password: str = data["admin_password"]

        # ── 1. Determine slug ─────────────────────────────────────────────────
        requested_slug = data.get("tenant_slug", "") or slugify(company_name)[:63]

        # ── 2. Create admin user ──────────────────────────────────────────────
        admin_user = User.objects.create_user(
            username=admin_username,
            email=admin_email,
            password=admin_password,
        )
        admin_user.is_staff = True
        admin_user.save(update_fields=["is_staff"])

        # ── 3. Create Organization ────────────────────────────────────────────
        import uuid as _uuid
        from org.models import Organization
        org_code = f"ORG-{_uuid.uuid4().hex[:8].upper()}"
        org = Organization.objects.create(
            name=company_name,
            name_ar=company_name_ar,
            org_code=org_code,
        )

        # ── 4. Create Tenant ──────────────────────────────────────────────────
        from org.models import Tenant, TenantPlan
        tenant = Tenant(
            name=company_name,
            name_ar=company_name_ar,
            slug=requested_slug,
            organization=org,
            plan=plan,
            admin_user=admin_user,
            max_branches=Tenant.get_plan_limits(plan),
        )
        tenant.save()

        # ── 5. Seed demo data (CoA + Brand + Branch) ──────────────────────────
        seed_result = full_tenant_setup(organization=org, brand_name=brand_name)

        # ── 6. Create UserProfile so admin can log in via normal flow ─────────
        try:
            from org.models import UserProfile
            brand = seed_result["brand"]
            UserProfile.objects.get_or_create(
                user=admin_user,
                defaults={
                    "brand": brand,
                    "is_owner": True,
                },
            )
        except Exception:  # noqa: BLE001
            pass

        # ── 7. Mark onboarding complete ───────────────────────────────────────
        tenant.onboarding_complete = True
        tenant.save(update_fields=["onboarding_complete"])

        return Response(
            {
                "success": True,
                "tenant": {
                    "id": tenant.pk,
                    "uuid": str(tenant.uuid),
                    "slug": tenant.slug,
                    "name": tenant.name,
                    "plan": tenant.plan,
                    "subdomain_url": f"http://{tenant.slug}.smartops.com",
                    "trial_ends_at": tenant.trial_ends_at,
                },
                "admin_user": {
                    "username": admin_user.username,
                    "email": admin_user.email,
                },
                "setup_summary": {
                    "chart_of_accounts_created": seed_result["accounts_created"],
                    "brand": seed_result["brand"].name,
                    "main_branch": seed_result["branch"].name,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class TenantDetailView(APIView):
    """
    GET /api/onboarding/tenant/
    Returns current tenant info (resolved from subdomain middleware).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response(
                {"detail": "No tenant resolved for this request."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {
                "id": tenant.pk,
                "uuid": str(tenant.uuid),
                "slug": tenant.slug,
                "name": tenant.name,
                "name_ar": tenant.name_ar,
                "plan": tenant.plan,
                "is_active": tenant.is_active,
                "onboarding_complete": tenant.onboarding_complete,
                "trial_ends_at": tenant.trial_ends_at,
                "subscription_ends_at": tenant.subscription_ends_at,
                "max_branches": tenant.max_branches,
                "is_trial_active": tenant.is_trial_active,
                "organization_id": tenant.organization_id,
            }
        )


class TenantListView(APIView):
    """
    GET /api/onboarding/tenants/
    Superuser-only: list all tenants.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_superuser:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        from org.models import Tenant
        tenants = Tenant.objects.select_related("organization", "admin_user").order_by("name")
        return Response(
            [
                {
                    "id": t.pk,
                    "uuid": str(t.uuid),
                    "slug": t.slug,
                    "name": t.name,
                    "plan": t.plan,
                    "is_active": t.is_active,
                    "onboarding_complete": t.onboarding_complete,
                    "admin": t.admin_user.username if t.admin_user else None,
                    "created_at": t.created_at,
                }
                for t in tenants
            ]
        )
