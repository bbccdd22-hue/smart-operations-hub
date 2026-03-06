"""
Supplier Portal Integration Tests (10 tests)
"""
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def supplier_with_key(db):
    from org.models import Organization, Brand, Branch, City, BranchType
    from procurement.models import Supplier

    org = Organization.objects.create(name="SP Org", org_code="SP001")
    city, _ = City.objects.get_or_create(name_en="RUH-SP", defaults={"name_ar": "الرياض", "option_code": "CITY-SP"})
    bt, _ = BranchType.objects.get_or_create(name_en="Rest-SP", defaults={"name_ar": "مطعم", "option_code": "TYPE-SP"})
    brand = Brand.objects.create(name="SP Brand", organization=org, slug="sp-brand", brand_code="SP-B01")
    branch = Branch.objects.create(name="SP Branch", brand=brand, city=city, branch_type=bt)

    s = Supplier.objects.create(name="SP Supplier", brand=brand)
    raw_key = s.generate_new_api_key()
    return s, raw_key, branch


@pytest.mark.django_db
class TestSupplierPortalAuth:
    def test_auth_valid_key(self, api_client, supplier_with_key):
        _, raw_key, _ = supplier_with_key
        resp = api_client.post("/api/supplier-portal/auth/", {"api_key": raw_key}, format="json")
        assert resp.status_code == 200
        assert "supplier_id" in resp.data
        assert "supplier_name" in resp.data

    def test_auth_invalid_key(self, api_client):
        resp = api_client.post("/api/supplier-portal/auth/", {"api_key": "wrong-key"}, format="json")
        assert resp.status_code == 401

    def test_auth_missing_key(self, api_client):
        resp = api_client.post("/api/supplier-portal/auth/", {}, format="json")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestSupplierPortalDashboard:
    def test_dashboard_requires_key(self, api_client):
        resp = api_client.get("/api/supplier-portal/dashboard/")
        assert resp.status_code == 401

    def test_dashboard_with_valid_key(self, api_client, supplier_with_key):
        supplier, raw_key, _ = supplier_with_key
        resp = api_client.get("/api/supplier-portal/dashboard/", HTTP_X_SUPPLIER_API_KEY=raw_key)
        assert resp.status_code == 200
        assert resp.data["supplier_name"] == supplier.name
        assert "purchase_orders" in resp.data
        assert "goods_receipts_pending" in resp.data
        assert "recent_invoices" in resp.data

    def test_dashboard_bearer_key(self, api_client, supplier_with_key):
        _, raw_key, _ = supplier_with_key
        resp = api_client.get("/api/supplier-portal/dashboard/", HTTP_AUTHORIZATION=f"Bearer {raw_key}")
        assert resp.status_code == 200


@pytest.mark.django_db
class TestSupplierPortalInvoice:
    def test_invoice_submit_requires_key(self, api_client):
        resp = api_client.post("/api/supplier-portal/invoice/", {"invoice_number": "INV-1", "total_amount": 100}, format="json")
        assert resp.status_code == 401

    def test_invoice_submit_with_key(self, api_client, supplier_with_key):
        _, raw_key, branch = supplier_with_key
        resp = api_client.post(
            "/api/supplier-portal/invoice/",
            {"invoice_number": "INV-SP-001", "total_amount": "150.50", "branch_id": branch.id, "auto_post": False},
            format="json",
            HTTP_X_SUPPLIER_API_KEY=raw_key,
        )
        assert resp.status_code in (200, 201), resp.data

    def test_invoice_missing_total_rejected(self, api_client, supplier_with_key):
        _, raw_key, _ = supplier_with_key
        resp = api_client.post(
            "/api/supplier-portal/invoice/",
            {"invoice_number": "INV-2"},
            format="json",
            HTTP_X_SUPPLIER_API_KEY=raw_key,
        )
        assert resp.status_code == 400
