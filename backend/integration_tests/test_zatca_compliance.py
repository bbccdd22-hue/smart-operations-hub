"""
ZATCA E-Invoicing Compliance Tests (7 tests)
"""
import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def auth_user(db):
    return User.objects.create_user(username="zatca_user", password="pass1234", is_staff=True)


@pytest.fixture
def auth_client(db, api_client, auth_user):
    api_client.force_authenticate(user=auth_user)
    return api_client


@pytest.mark.django_db
class TestZATCAInvoice:
    def test_returns_200_with_valid_data(self, auth_client):
        resp = auth_client.post("/api/zatca/invoice/", {
            "seller_name": "مطعم الرياض",
            "vat_number": "300000000000003",
            "invoice_number": "INV-Z-001",
            "total_with_vat": "115.00",
            "vat_amount": "15.00",
        }, format="json")
        assert resp.status_code == 200

    def test_returns_xml_key(self, auth_client):
        resp = auth_client.post("/api/zatca/invoice/", {
            "seller_name": "Test Co",
            "vat_number": "123456789012345",
        }, format="json")
        assert "xml" in resp.data

    def test_returns_qr_code_base64(self, auth_client):
        resp = auth_client.post("/api/zatca/invoice/", {
            "seller_name": "Test",
            "vat_number": "123",
        }, format="json")
        assert "qr_code_base64" in resp.data
        import base64
        decoded = base64.b64decode(resp.data["qr_code_base64"])
        assert len(decoded) > 0

    def test_returns_invoice_hash(self, auth_client):
        resp = auth_client.post("/api/zatca/invoice/", {
            "seller_name": "X",
            "vat_number": "Y",
        }, format="json")
        assert "invoice_hash" in resp.data
        assert len(resp.data["invoice_hash"]) == 64

    def test_missing_seller_rejected(self, auth_client):
        resp = auth_client.post("/api/zatca/invoice/", {"vat_number": "123"}, format="json")
        assert resp.status_code == 400

    def test_missing_vat_rejected(self, auth_client):
        resp = auth_client.post("/api/zatca/invoice/", {"seller_name": "Co"}, format="json")
        assert resp.status_code == 400

    def test_requires_auth(self, api_client):
        resp = api_client.post("/api/zatca/invoice/", {"seller_name": "X", "vat_number": "Y"}, format="json")
        assert resp.status_code in (401, 403)
