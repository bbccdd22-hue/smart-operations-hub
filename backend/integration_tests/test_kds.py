"""
KDS (Kitchen Display System) Integration Tests (6 tests)
==========================================================
Covers:
  1.  Create KDS order via POST /api/pos/kds/
  2.  List active orders — only pending/cooking/ready
  3.  Advance pending → cooking (POST .../advance/)
  4.  Advance cooking → ready
  5.  Advance ready → delivered
  6.  KDS stats returns correct counts
"""
import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def branch(db):
    from org.models import Organization, Brand, Branch, City, BranchType
    org = Organization.objects.create(name="KDS Org", org_code="KDS001")
    city, _ = City.objects.get_or_create(name_en="RUH-KDS", defaults={"name_ar": "الرياض", "option_code": "CITY-KDS"})
    bt, _ = BranchType.objects.get_or_create(name_en="Rest-KDS", defaults={"name_ar": "مطعم", "option_code": "TYPE-KDS"})
    brand = Brand.objects.create(name="KDS Brand", organization=org, slug="kds-brand", brand_code="KDS-B01")
    return Branch.objects.create(name="KDS Branch", brand=brand, city=city, branch_type=bt)


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(username="kds_staff", password="pass1234", is_staff=True)


@pytest.fixture
def kds_order(db, branch):
    from pos.models import KDSOrder
    return KDSOrder.objects.create(
        branch=branch,
        order_number="KDS-TEST-001",
        table_number="T5",
        items=[{"name": "Burger", "qty": 2}, {"name": "Fries", "qty": 1}],
        priority=0,
    )


@pytest.mark.django_db
class TestKDSOrders:
    def test_create_kds_order(self, api_client, branch):
        resp = api_client.post("/api/pos/kds/", {
            "branch_id": branch.id,
            "order_number": "KDS-NEW-001",
            "table_number": "T3",
            "items": [{"name": "Shawarma", "qty": 3}],
        }, format="json")
        assert resp.status_code == 201
        assert resp.data["order_number"] == "KDS-NEW-001"
        assert resp.data["kds_status"] == "pending"

    def test_list_active_orders(self, api_client, branch, kds_order):
        resp = api_client.get(f"/api/pos/kds/?branch_id={branch.id}")
        assert resp.status_code == 200
        order_numbers = [o["order_number"] for o in resp.data]
        assert "KDS-TEST-001" in order_numbers

    def test_advance_pending_to_cooking(self, api_client, kds_order):
        resp = api_client.post(f"/api/pos/kds/{kds_order.id}/advance/")
        assert resp.status_code == 200
        assert resp.data["kds_status"] == "cooking"
        assert resp.data["advanced_to"] == "cooking"
        kds_order.refresh_from_db()
        assert kds_order.cooking_started_at is not None

    def test_advance_cooking_to_ready(self, api_client, kds_order):
        kds_order.kds_status = "cooking"
        kds_order.save()
        resp = api_client.post(f"/api/pos/kds/{kds_order.id}/advance/")
        assert resp.status_code == 200
        assert resp.data["kds_status"] == "ready"
        kds_order.refresh_from_db()
        assert kds_order.ready_at is not None

    def test_advance_ready_to_delivered(self, api_client, kds_order):
        kds_order.kds_status = "ready"
        kds_order.save()
        resp = api_client.post(f"/api/pos/kds/{kds_order.id}/advance/")
        assert resp.status_code == 200
        assert resp.data["kds_status"] == "delivered"

    def test_kds_stats_returns_counts(self, api_client, staff_user, branch, kds_order):
        api_client.force_authenticate(user=staff_user)
        resp = api_client.get(f"/api/pos/kds/stats/?branch_id={branch.id}")
        assert resp.status_code == 200
        assert "total_orders" in resp.data
        assert "pending" in resp.data
        assert resp.data["pending"] >= 1
