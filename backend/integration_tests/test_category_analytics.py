"""
Category Analytics Integration Tests (8 tests)
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
    return User.objects.create_user(username="cat_user", password="pass1234", is_staff=True)


@pytest.fixture
def auth_client(db, api_client, auth_user):
    api_client.force_authenticate(user=auth_user)
    return api_client


@pytest.mark.django_db
class TestCategoryAnalytics:
    def test_returns_200(self, auth_client):
        resp = auth_client.get("/api/dashboard/categories/")
        assert resp.status_code == 200

    def test_has_required_keys(self, auth_client):
        resp = auth_client.get("/api/dashboard/categories/")
        assert "category_sales" in resp.data
        assert "period" in resp.data
        assert "abc_analysis" in resp.data

    def test_category_sales_structure(self, auth_client):
        resp = auth_client.get("/api/dashboard/categories/?period=month")
        cats = resp.data.get("category_sales", {})
        for key in ["beverages", "meals", "desserts", "grocery", "other"]:
            assert key in cats
            assert "pct" in cats.get(key, {}) or "sar" in str(cats.get(key, {}))

    def test_period_param(self, auth_client):
        resp = auth_client.get("/api/dashboard/categories/?period=day")
        assert resp.data["period"] == "day"

    def test_compare_branches_param(self, auth_client):
        resp = auth_client.get("/api/dashboard/categories/?compare_branches=true")
        assert "branch_comparison" in resp.data

    def test_abc_analysis_is_list(self, auth_client):
        resp = auth_client.get("/api/dashboard/categories/")
        assert isinstance(resp.data.get("abc_analysis"), list)

    def test_total_revenue_key(self, auth_client):
        resp = auth_client.get("/api/dashboard/categories/")
        assert "total_revenue_sar" in resp.data

    def test_requires_auth(self, api_client):
        resp = api_client.get("/api/dashboard/categories/")
        assert resp.status_code in (401, 403)
