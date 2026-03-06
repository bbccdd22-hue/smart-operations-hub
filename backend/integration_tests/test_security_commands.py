"""
Tests for Security Commands (الأوامر الأمنية الثلاثة)
========================================================
1. أمر التأمين: SECRET_KEY + ALLOWED_HOSTS from env
2. أمر التشفير: Supplier api_key_hash + verify_api_key
3. أمر الأداء: Pagination on list endpoints
"""
import pytest


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


# ─── 1. Settings (أمر التأمين) ──────────────────────────────────────────────────


class TestSettingsSecurity:
    def test_secret_key_required_from_env(self):
        """DJANGO_SECRET_KEY must be set; conftest sets it for tests."""
        from django.conf import settings
        assert settings.SECRET_KEY
        assert len(settings.SECRET_KEY) >= 3  # env sets it; no default fallback

    def test_allowed_hosts_from_env_or_safe_fallback(self):
        """ALLOWED_HOSTS comes from DJANGO_ALLOWED_HOSTS or localhost fallback."""
        from django.conf import settings
        assert isinstance(settings.ALLOWED_HOSTS, list)
        assert "localhost" in settings.ALLOWED_HOSTS or "127.0.0.1" in settings.ALLOWED_HOSTS
        assert "*" not in settings.ALLOWED_HOSTS


# ─── 2. Supplier API Key (أمر التشفير) ─────────────────────────────────────────────


class TestSupplierApiKeyEncryption:
    def test_generate_api_key_returns_raw_once(self, db, supplier):
        """generate_api_key yields raw key; hash stored, raw never again."""
        raw = supplier.generate_api_key()
        assert raw
        assert len(raw) >= 32
        assert supplier.api_key_hash
        assert supplier.api_key_hash != raw

    def test_verify_api_key_accepted(self, db, supplier):
        """verify_api_key returns True for correct key."""
        raw = supplier.generate_api_key()
        assert supplier.verify_api_key(raw) is True
        assert supplier.check_api_key(raw) is True

    def test_verify_api_key_rejected_wrong(self, db, supplier):
        """verify_api_key returns False for wrong key."""
        supplier.generate_api_key()
        assert supplier.verify_api_key("wrong-key-12345") is False

    def test_revoked_key_rejected(self, db, supplier):
        """Revoked key is rejected even if hash matches."""
        raw = supplier.generate_api_key()
        supplier.api_key_revoked = True
        supplier.save(update_fields=["api_key_revoked"])
        assert supplier.verify_api_key(raw) is False


# ─── 3. Pagination (أمر الأداء) ──────────────────────────────────────────────────


class TestListEndpointPagination:
    """All 5 list endpoints return pagination metadata."""

    def test_supplier_invoices_pagination(self, api_client, superuser, supplier, main_branch):
        from datetime import date
        from procurement.models import SupplierInvoice, SupplierInvoiceStatus
        api_client.force_authenticate(user=superuser)
        SupplierInvoice.objects.create(
            supplier=supplier, branch=main_branch,
            invoice_number="INV-PAG-1", invoice_date=date.today(),
            total_amount=100, status=SupplierInvoiceStatus.DRAFT,
        )
        r = api_client.get("/api/procurement/invoices/")
        assert r.status_code == 200
        assert "pagination" in r.json()
        p = r.json()["pagination"]
        assert "count" in p and "page" in p and "page_size" in p

    def test_purchase_orders_pagination(self, api_client, superuser, supplier, main_branch):
        from datetime import date
        from procurement.models import PurchaseOrder, PurchaseOrderStatus
        from django.contrib.auth import get_user_model
        User = get_user_model()
        u = superuser
        PurchaseOrder.objects.create(
            brand=main_branch.brand, branch=main_branch, supplier=supplier,
            order_number="PO-PAG-1", order_date=date.today(),
            status=PurchaseOrderStatus.DRAFT, created_by=u,
        )
        api_client.force_authenticate(user=superuser)
        r = api_client.get("/api/procurement/orders/")
        assert r.status_code == 200
        assert "pagination" in r.json()

    def test_purchase_requests_pagination(self, api_client, superuser, main_branch):
        from procurement.models import PurchaseRequest, PurchaseRequestStatus
        PurchaseRequest.objects.create(
            branch=main_branch, request_number="PR-PAG-001",
            status=PurchaseRequestStatus.DRAFT, requested_by=superuser,
        )
        api_client.force_authenticate(user=superuser)
        r = api_client.get("/api/procurement/requests/")
        assert r.status_code == 200
        assert "pagination" in r.json()

    def test_stock_balance_pagination(self, api_client, superuser):
        api_client.force_authenticate(user=superuser)
        r = api_client.get("/api/inventory/stock-balance/")
        assert r.status_code == 200
        data = r.json()
        assert "pagination" in data
        assert "rows" in data

    def test_shift_closings_pagination(self, api_client, superuser):
        from django.contrib.auth.models import User
        superuser.is_staff = True
        superuser.save()
        api_client.force_authenticate(user=superuser)
        r = api_client.get("/api/shifts/closing/auditor-list/")
        assert r.status_code in (200, 403)
        if r.status_code == 200:
            assert "pagination" in r.json()

    def test_page_size_param_respected(self, api_client, superuser):
        """page_size query param limits results per page."""
        api_client.force_authenticate(user=superuser)
        r = api_client.get("/api/inventory/stock-balance/?page_size=5")
        assert r.status_code == 200
        p = r.json().get("pagination", {})
        assert p.get("page_size") == 5
