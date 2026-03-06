"""
Table Management Integration Tests (15 tests)
===============================================
Covers:
  1.  Create table — succeeds with valid data
  2.  Create table — duplicate number rejected
  3.  List tables — filtered by branch
  4.  Get table detail
  5.  Update table (capacity, section, position)
  6.  Deactivate table (DELETE)
  7.  Status change: available → occupied
  8.  Status change: occupied → paid
  9.  Status change: paid → cleaning
  10. Status change: cleaning → available
  11. Invalid status rejected
  12. Table merge creates TableMerge record
  13. Table merge marks secondary as occupied
  14. Table transfer — moves sale and sets source to cleaning
  15. Table transfer — fails if target is not available
"""
import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(username="tbl_staff", password="pass1234", is_staff=True)


@pytest.fixture
def auth_client(db, api_client, staff_user):
    api_client.force_authenticate(user=staff_user)
    return api_client


@pytest.fixture
def branch(db):
    from org.models import Organization, Brand, Branch, City, BranchType
    org = Organization.objects.create(name="TBL Org", org_code="TBL001")
    city, _ = City.objects.get_or_create(name_en="RUH-TBL", defaults={"name_ar": "الرياض", "option_code": "CITY-TBL"})
    bt, _ = BranchType.objects.get_or_create(name_en="Rest-TBL", defaults={"name_ar": "مطعم", "option_code": "TYPE-TBL"})
    brand = Brand.objects.create(name="TBL Brand", organization=org, slug="tbl-brand", brand_code="TBL-B01")
    return Branch.objects.create(name="TBL Branch", brand=brand, city=city, branch_type=bt)


@pytest.fixture
def table_1(db, branch):
    from pos.models import RestaurantTable
    return RestaurantTable.objects.create(branch=branch, number="T1", capacity=4)


@pytest.fixture
def table_2(db, branch):
    from pos.models import RestaurantTable
    return RestaurantTable.objects.create(branch=branch, number="T2", capacity=2)


# ── Tests ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTableCRUD:
    def test_create_table_success(self, auth_client, branch):
        resp = auth_client.post("/api/pos/tables/", {
            "branch_id": branch.id, "number": "T-NEW", "capacity": 6, "section": "VIP",
        }, format="json")
        assert resp.status_code == 201
        assert resp.data["number"] == "T-NEW"
        assert resp.data["capacity"] == 6

    def test_create_table_duplicate_rejected(self, auth_client, branch, table_1):
        resp = auth_client.post("/api/pos/tables/", {
            "branch_id": branch.id, "number": "T1",
        }, format="json")
        assert resp.status_code == 400

    def test_list_tables_by_branch(self, auth_client, branch, table_1, table_2):
        resp = auth_client.get(f"/api/pos/tables/?branch_id={branch.id}")
        assert resp.status_code == 200
        numbers = [t["number"] for t in resp.data]
        assert "T1" in numbers
        assert "T2" in numbers

    def test_get_table_detail(self, auth_client, table_1):
        resp = auth_client.get(f"/api/pos/tables/{table_1.id}/")
        assert resp.status_code == 200
        assert resp.data["number"] == "T1"

    def test_update_table_capacity(self, auth_client, table_1):
        resp = auth_client.patch(f"/api/pos/tables/{table_1.id}/", {"capacity": 8}, format="json")
        assert resp.status_code == 200
        assert resp.data["capacity"] == 8

    def test_update_table_section(self, auth_client, table_1):
        resp = auth_client.patch(f"/api/pos/tables/{table_1.id}/", {"section": "Terrace"}, format="json")
        assert resp.status_code == 200
        assert resp.data["section"] == "Terrace"

    def test_deactivate_table(self, auth_client, table_1):
        resp = auth_client.delete(f"/api/pos/tables/{table_1.id}/")
        assert resp.status_code == 200
        table_1.refresh_from_db()
        assert table_1.is_active is False


@pytest.mark.django_db
class TestTableStatus:
    def test_set_status_occupied(self, auth_client, table_1):
        resp = auth_client.post(f"/api/pos/tables/{table_1.id}/status/", {"status": "occupied"}, format="json")
        assert resp.status_code == 200
        assert resp.data["status"] == "occupied"

    def test_set_status_paid(self, auth_client, table_1):
        resp = auth_client.post(f"/api/pos/tables/{table_1.id}/status/", {"status": "paid"}, format="json")
        assert resp.status_code == 200
        assert resp.data["status"] == "paid"

    def test_set_status_cleaning(self, auth_client, table_1):
        resp = auth_client.post(f"/api/pos/tables/{table_1.id}/status/", {"status": "cleaning"}, format="json")
        assert resp.status_code == 200
        assert resp.data["status"] == "cleaning"

    def test_clear_to_available(self, auth_client, table_1):
        resp = auth_client.post(f"/api/pos/tables/{table_1.id}/status/", {"status": "available"}, format="json")
        assert resp.status_code == 200
        assert resp.data["status"] == "available"

    def test_invalid_status_rejected(self, auth_client, table_1):
        resp = auth_client.post(f"/api/pos/tables/{table_1.id}/status/", {"status": "flying"}, format="json")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestTableMergeAndTransfer:
    def test_merge_creates_record(self, auth_client, table_1, table_2):
        from pos.models import TableMerge
        resp = auth_client.post("/api/pos/tables/merge/", {
            "primary_table_id": table_1.id,
            "secondary_table_id": table_2.id,
        }, format="json")
        assert resp.status_code == 201
        assert TableMerge.objects.filter(primary_table=table_1, secondary_table=table_2).exists()

    def test_merge_marks_secondary_occupied(self, auth_client, table_1, table_2):
        auth_client.post("/api/pos/tables/merge/", {
            "primary_table_id": table_1.id,
            "secondary_table_id": table_2.id,
        }, format="json")
        table_2.refresh_from_db()
        assert table_2.status == "occupied"

    def test_transfer_sets_source_to_cleaning(self, auth_client, table_1, table_2):
        # table_1 is occupied, table_2 is available → transfer to table_2
        table_1.status = "occupied"
        table_1.save()
        resp = auth_client.post(f"/api/pos/tables/{table_1.id}/transfer/", {
            "target_table_id": table_2.id,
        }, format="json")
        assert resp.status_code == 200
        table_1.refresh_from_db()
        assert table_1.status == "cleaning"

    def test_transfer_fails_if_target_occupied(self, auth_client, table_1, table_2):
        table_2.status = "occupied"
        table_2.save()
        resp = auth_client.post(f"/api/pos/tables/{table_1.id}/transfer/", {
            "target_table_id": table_2.id,
        }, format="json")
        assert resp.status_code == 400
