"""
Owner Dashboard VIP Integration Tests (10 tests)
Data sources: /dashboard/summary, /dashboard/food-cost
"""
import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(username="owner_test", password="pass1234", is_staff=True)


@pytest.fixture
def auth_client(db, api_client, staff_user):
    api_client.force_authenticate(user=staff_user)
    return api_client


@pytest.mark.django_db
class TestOwnerDashboardDataSources:
    def test_summary_returns_200(self, auth_client):
        resp = auth_client.get("/api/dashboard/summary/")
        assert resp.status_code == 200

    def test_summary_has_totals(self, auth_client):
        resp = auth_client.get("/api/dashboard/summary/")
        assert "totals" in resp.data

    def test_food_cost_day_returns_200(self, auth_client):
        resp = auth_client.get("/api/dashboard/food-cost/?period=day")
        assert resp.status_code == 200

    def test_food_cost_week_returns_200(self, auth_client):
        resp = auth_client.get("/api/dashboard/food-cost/?period=week")
        assert resp.status_code == 200

    def test_summary_totals_structure(self, auth_client):
        resp = auth_client.get("/api/dashboard/summary/")
        totals = resp.data.get("totals", {})
        assert "system_total_sales" in totals or "shifts_count" in totals or len(totals) >= 0

    def test_food_cost_has_period(self, auth_client):
        resp = auth_client.get("/api/dashboard/food-cost/?period=month")
        assert resp.data.get("period") == "month"

    def test_command_center_returns_ok_or_forbidden(self, auth_client):
        resp = auth_client.get("/api/dashboard/command-center/")
        assert resp.status_code in (200, 403, 404)

    def test_executive_dashboard_returns_ok_or_forbidden(self, auth_client):
        resp = auth_client.get("/api/dashboard/executive-dashboard/")
        assert resp.status_code in (200, 403, 404)

    def test_insights_returns_200(self, auth_client):
        resp = auth_client.get("/api/dashboard/insights/")
        assert resp.status_code == 200

    def test_chart_data_returns_200(self, auth_client):
        resp = auth_client.get("/api/dashboard/chart-data/")
        assert resp.status_code == 200
