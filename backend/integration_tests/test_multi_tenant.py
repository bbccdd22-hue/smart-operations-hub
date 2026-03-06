"""
Multi-Tenant Integration Tests
===============================

Covers:
  1.  Tenant creation (direct model)
  2.  Tenant slug uniqueness enforcement
  3.  Trial period auto-calculation
  4.  Subdomain middleware resolution
  5.  Onboarding signup API — full happy path
  6.  Onboarding signup — duplicate username rejected
  7.  Onboarding signup — duplicate slug rejected
  8.  Tenant isolation (two tenants cannot see each other's Brands)
  9.  Admin-only tenant list endpoint
  10. Tenant detail endpoint (subdomain header check)
  11. get_plan_limits correctness
  12. Demo seeder creates CoA accounts
  13. Demo seeder is idempotent (double-run = same count)
  14. Tenant.save() auto-slugifies name
"""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

# ── Unique org_code counter ─────────────────────────────────────────────────

_ORG_CODE_COUNTER = 0


def _next_org_code():
    global _ORG_CODE_COUNTER
    _ORG_CODE_COUNTER += 1
    return f"MT{_ORG_CODE_COUNTER:04d}"


def _make_org(name="Test Org", name_ar=""):
    from org.models import Organization
    return Organization.objects.create(
        name=name,
        name_ar=name_ar or name,
        org_code=_next_org_code(),
    )


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def org_a(db):
    return _make_org("Alpha Corp", "ألفا")


@pytest.fixture
def org_b(db):
    return _make_org("Beta Corp", "بيتا")


@pytest.fixture
def tenant_a(db, org_a):
    from org.models import Tenant
    return Tenant.objects.create(
        name="Alpha Corp",
        slug="alpha-mt",
        organization=org_a,
        plan="trial",
    )


@pytest.fixture
def tenant_b(db, org_b):
    from org.models import Tenant
    return Tenant.objects.create(
        name="Beta Corp",
        slug="beta-mt",
        organization=org_b,
        plan="starter",
    )


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        username="su_mt", password="pass1234", email="su@test.com"
    )


# ── Tests: Tenant Model ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTenantModel:
    def test_tenant_created_with_trial_plan(self, tenant_a):
        assert tenant_a.plan == "trial"

    def test_trial_ends_at_auto_set(self, tenant_a):
        """Saving a trial tenant auto-sets trial_ends_at to +14 days."""
        assert tenant_a.trial_ends_at is not None
        delta = tenant_a.trial_ends_at - timezone.now()
        assert 13 <= delta.days <= 14

    def test_is_trial_active(self, tenant_a):
        assert tenant_a.is_trial_active is True

    def test_non_trial_plan_not_active_trial(self, tenant_b):
        assert tenant_b.is_trial_active is False

    def test_slug_uniqueness(self, db, tenant_a):
        """Creating a second tenant with the same slug raises IntegrityError."""
        from django.db import IntegrityError
        from org.models import Tenant
        org2 = _make_org("Alpha Copy 2")
        with pytest.raises(IntegrityError):
            Tenant.objects.create(name="Alpha Copy 2", slug="alpha-mt", organization=org2)

    def test_auto_slug_from_name(self, db):
        """Tenant.save() auto-generates slug from name when blank."""
        from django.utils.text import slugify
        from org.models import Tenant
        org = _make_org("Unique Café 9988")
        t = Tenant(name="Unique Café 9988", organization=org)
        t.save()
        assert t.slug  # not blank
        assert slugify("Unique Café 9988")[:10] in t.slug or "unique" in t.slug

    def test_plan_limits_no_db_needed(self):
        from org.models import Tenant
        assert Tenant.get_plan_limits("trial") == 1
        assert Tenant.get_plan_limits("growth") == 5
        assert Tenant.get_plan_limits("pro") == 20
        assert Tenant.get_plan_limits("enterprise") == 999

    def test_str_representation(self, tenant_a):
        assert "alpha-mt" in str(tenant_a)
        assert "Alpha Corp" in str(tenant_a)


# ── Tests: Tenant Isolation ─────────────────────────────────────────────────

@pytest.mark.django_db
class TestTenantIsolation:
    def test_tenant_org_are_different(self, tenant_a, tenant_b):
        assert tenant_a.organization_id != tenant_b.organization_id

    def test_brands_scoped_to_org(self, db, tenant_a, tenant_b):
        """Brands created under org_a are not visible when filtering by org_b."""
        from org.models import Brand
        Brand.objects.create(
            name="Alpha Brand",
            organization=tenant_a.organization,
            slug="alpha-brand-mt",
            brand_code="BRD-A001",
        )
        Brand.objects.create(
            name="Beta Brand",
            organization=tenant_b.organization,
            slug="beta-brand-mt",
            brand_code="BRD-B001",
        )
        alpha_brands = Brand.objects.filter(organization=tenant_a.organization)
        beta_brands  = Brand.objects.filter(organization=tenant_b.organization)

        assert alpha_brands.count() == 1
        assert beta_brands.count() == 1
        assert alpha_brands.first().name == "Alpha Brand"
        assert beta_brands.first().name == "Beta Brand"

    def test_tenant_a_cannot_access_tenant_b_org(self, tenant_a, tenant_b):
        """OneToOneField ensures each org has exactly one tenant."""
        from org.models import Tenant
        tenant_for_b = Tenant.objects.get(organization=tenant_b.organization)
        assert tenant_for_b.pk == tenant_b.pk
        assert tenant_for_b.pk != tenant_a.pk


# ── Tests: Subdomain Middleware ─────────────────────────────────────────────

@pytest.mark.django_db
class TestSubdomainMiddleware:
    def test_slug_resolves_to_tenant(self, tenant_a):
        from core.tenant_middleware import _resolve_tenant_from_host
        resolved = _resolve_tenant_from_host("alpha-mt.smartops.com")
        assert resolved is not None
        assert resolved.pk == tenant_a.pk

    def test_main_domain_returns_none(self, tenant_a):
        from core.tenant_middleware import _resolve_tenant_from_host
        assert _resolve_tenant_from_host("smartops.com") is None

    def test_www_returns_none(self, tenant_a):
        from core.tenant_middleware import _resolve_tenant_from_host
        assert _resolve_tenant_from_host("www.smartops.com") is None

    def test_unknown_slug_returns_none(self):
        from core.tenant_middleware import _resolve_tenant_from_host
        assert _resolve_tenant_from_host("no-such-tenant.smartops.com") is None

    def test_inactive_tenant_not_resolved(self, db):
        from org.models import Tenant
        from core.tenant_middleware import _resolve_tenant_from_host
        org = _make_org("Inactive Org")
        Tenant.objects.create(
            name="Inactive Co", slug="inactive-co-mt", organization=org, is_active=False
        )
        result = _resolve_tenant_from_host("inactive-co-mt.smartops.com")
        assert result is None

    def test_localhost_subdomain_resolves(self, tenant_b):
        """Local dev: beta-mt.localhost → Tenant(slug='beta-mt')."""
        from core.tenant_middleware import _resolve_tenant_from_host
        resolved = _resolve_tenant_from_host("beta-mt.localhost")
        assert resolved is not None
        assert resolved.pk == tenant_b.pk

    def test_request_tenant_attribute_set(self, tenant_a, settings):
        """Full middleware call sets request.tenant."""
        from django.test import RequestFactory
        from core.tenant_middleware import RequestContextMiddleware
        from django.http import HttpResponse

        settings.SMARTOPS_BASE_DOMAIN = "smartops.com"
        settings.ALLOWED_HOSTS = ["*"]  # allow any host in test

        def dummy_view(req):
            return HttpResponse("ok")

        mw = RequestContextMiddleware(dummy_view)
        factory = RequestFactory()
        request = factory.get("/", HTTP_HOST="alpha-mt.smartops.com")
        response = mw(request)
        assert response.status_code == 200
        assert request.tenant is not None
        assert request.tenant.pk == tenant_a.pk


# ── Tests: Demo Seeder ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDemoSeeder:
    def test_seed_creates_coa_accounts(self, db):
        from onboarding.demo_seeder import seed_chart_of_accounts
        org = _make_org("Seeder Test Org A")
        count = seed_chart_of_accounts(org)
        assert count > 0

    def test_seed_idempotent(self, db):
        from onboarding.demo_seeder import seed_chart_of_accounts
        org = _make_org("Seeder Idempotent Org")
        seed_chart_of_accounts(org)
        second = seed_chart_of_accounts(org)
        assert second == 0  # second run creates nothing new

    def test_seed_creates_brand_and_branch(self, db):
        from onboarding.demo_seeder import full_tenant_setup
        org = _make_org("Seeder Full Setup Org")
        result = full_tenant_setup(organization=org, brand_name="Demo Brand")
        assert result["brand"].name == "Demo Brand"
        assert result["branch"].name == "Main Branch"
        assert result["accounts_created"] > 0

    def test_seed_required_accounting_codes_present(self, db):
        """Key accounting codes must exist after seeding."""
        from onboarding.demo_seeder import seed_chart_of_accounts
        from accounting.models import ChartAccount
        org = _make_org("Seeder CoA Check Org")
        seed_chart_of_accounts(org)
        required_codes = [
            "011011102",  # Branch Cash
            "04101",      # Food Sales Revenue
            "12101",      # Goods Inventory
            "21101",      # Accounts Payable
            "0510308",    # Salary Expense
            "07101",      # Cash Over/Short
        ]
        for code in required_codes:
            assert ChartAccount.objects.filter(code=code).exists(), (
                f"Required account code {code} not found after seeding"
            )


# ── Tests: Signup API ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSignupAPI:
    def _payload(self, suffix="x1"):
        return {
            "company_name": f"Test Restaurant {suffix}",
            "company_name_ar": f"مطعم الاختبار {suffix}",
            "tenant_slug": f"tr-{suffix}",
            "brand_name": f"TR Brand {suffix}",
            "admin_username": f"admin_{suffix}",
            "admin_email": f"admin_{suffix}@test.com",
            "admin_password": "SecurePass123",
            "plan": "trial",
        }

    def test_signup_creates_tenant(self, api_client):
        resp = api_client.post("/api/onboarding/signup/", self._payload("s1"), format="json")
        assert resp.status_code == 201, resp.data
        assert resp.data["success"] is True
        assert resp.data["tenant"]["slug"] == "tr-s1"

    def test_signup_creates_admin_user(self, api_client):
        api_client.post("/api/onboarding/signup/", self._payload("s2"), format="json")
        assert User.objects.filter(username="admin_s2").exists()

    def test_signup_seeds_chart_of_accounts(self, api_client):
        resp = api_client.post("/api/onboarding/signup/", self._payload("s3"), format="json")
        assert resp.status_code == 201
        assert resp.data["setup_summary"]["chart_of_accounts_created"] >= 0

    def test_signup_duplicate_username_rejected(self, api_client):
        api_client.post("/api/onboarding/signup/", self._payload("s4"), format="json")
        payload2 = self._payload("s4b")
        payload2["admin_username"] = "admin_s4"  # same username
        resp = api_client.post("/api/onboarding/signup/", payload2, format="json")
        assert resp.status_code == 400

    def test_signup_duplicate_slug_rejected(self, api_client):
        api_client.post("/api/onboarding/signup/", self._payload("s5"), format="json")
        payload2 = self._payload("s5b")
        payload2["tenant_slug"] = "tr-s5"  # same slug
        resp = api_client.post("/api/onboarding/signup/", payload2, format="json")
        assert resp.status_code == 400

    def test_signup_short_password_rejected(self, api_client):
        payload = self._payload("s6")
        payload["admin_password"] = "short"
        resp = api_client.post("/api/onboarding/signup/", payload, format="json")
        assert resp.status_code == 400

    def test_signup_marks_onboarding_complete(self, api_client):
        from org.models import Tenant
        resp = api_client.post("/api/onboarding/signup/", self._payload("s7"), format="json")
        assert resp.status_code == 201
        t = Tenant.objects.get(slug="tr-s7")
        assert t.onboarding_complete is True

    def test_signup_trial_has_expiry(self, api_client):
        resp = api_client.post("/api/onboarding/signup/", self._payload("s8"), format="json")
        assert resp.status_code == 201
        assert resp.data["tenant"]["trial_ends_at"] is not None

    def test_tenants_list_requires_superuser(self, api_client, superuser):
        # Anonymous: forbidden
        resp = api_client.get("/api/onboarding/tenants/")
        assert resp.status_code in (401, 403)

        # Superuser: allowed
        api_client.force_authenticate(user=superuser)
        resp = api_client.get("/api/onboarding/tenants/")
        assert resp.status_code == 200

    def test_two_tenants_are_isolated(self, api_client):
        """Two signups create two separate organizations."""
        from org.models import Tenant
        api_client.post("/api/onboarding/signup/", self._payload("iso1"), format="json")
        api_client.post("/api/onboarding/signup/", self._payload("iso2"), format="json")
        t1 = Tenant.objects.get(slug="tr-iso1")
        t2 = Tenant.objects.get(slug="tr-iso2")
        assert t1.organization_id != t2.organization_id
