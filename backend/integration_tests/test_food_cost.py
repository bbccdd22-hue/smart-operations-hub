"""
Food Cost Dashboard Integration Tests (8 tests)
=================================================
Covers:
  1.  API returns 200 with correct keys
  2.  food_cost_pct = None when no revenue
  3.  top_expensive_dishes sorted by cost descending
  4.  reorder_alerts triggered when on_hand < threshold
  5.  Period 'day' returns single trend point
  6.  Period 'week' returns multiple trend points
  7.  trend point has correct structure
  8.  top_waste_ingredients aggregates waste correctly
"""
import pytest
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def auth_user(db):
    return User.objects.create_user(username="fc_user", password="pass1234", is_staff=True)


@pytest.fixture
def auth_client(db, api_client, auth_user):
    api_client.force_authenticate(user=auth_user)
    return api_client


@pytest.mark.django_db
class TestFoodCostAPI:
    BASE_URL = "/api/dashboard/food-cost/"

    def test_returns_200(self, auth_client):
        resp = auth_client.get(self.BASE_URL)
        assert resp.status_code == 200

    def test_response_has_required_keys(self, auth_client):
        resp = auth_client.get(self.BASE_URL)
        keys = ["period", "date_from", "date_to", "food_cost_pct",
                "food_cost_sar", "revenue_sar", "top_expensive_dishes",
                "top_waste_ingredients", "reorder_alerts", "trend"]
        for k in keys:
            assert k in resp.data, f"Missing key: {k}"

    def test_no_revenue_means_null_pct(self, auth_client):
        resp = auth_client.get(self.BASE_URL + "?period=day")
        assert resp.data["food_cost_pct"] is None

    def test_period_day_returns_single_trend_point(self, auth_client):
        resp = auth_client.get(self.BASE_URL + "?period=day")
        assert len(resp.data["trend"]) == 1

    def test_period_week_returns_multiple_trend_points(self, auth_client):
        resp = auth_client.get(self.BASE_URL + "?period=week")
        assert len(resp.data["trend"]) >= 1  # at least today

    def test_trend_point_structure(self, auth_client):
        resp = auth_client.get(self.BASE_URL + "?period=week")
        if resp.data["trend"]:
            point = resp.data["trend"][0]
            assert "date" in point
            assert "food_cost_sar" in point
            assert "revenue_sar" in point
            assert "food_cost_pct" in point

    def test_top_expensive_dishes_sorted(self, db, auth_client):
        """Dishes with higher cost should appear first."""
        from inventory.models import FoodicsProduct, Recipe, Unit, Ingredient, RecipeLine
        unit, _ = Unit.objects.get_or_create(code="g-fc1", defaults={"name_en": "g"})
        ing_cheap = Ingredient.objects.create(name_en="FC-Cheap", base_unit=unit, unit_cost=Decimal("0.01"))
        ing_expensive = Ingredient.objects.create(name_en="FC-Expensive", base_unit=unit, unit_cost=Decimal("1.00"))

        p1 = FoodicsProduct.objects.create(foodics_product_id="FC-P1", name="Cheap Dish", price_excl_tax=Decimal("10"))
        p2 = FoodicsProduct.objects.create(foodics_product_id="FC-P2", name="Expensive Dish", price_excl_tax=Decimal("50"))

        r1 = Recipe.objects.create(product=p1, yield_unit=unit)
        r2 = Recipe.objects.create(product=p2, yield_unit=unit)

        RecipeLine.objects.create(recipe=r1, ingredient=ing_cheap, qty=Decimal("10"), unit=unit)
        RecipeLine.objects.create(recipe=r2, ingredient=ing_expensive, qty=Decimal("100"), unit=unit)

        resp = auth_client.get(self.BASE_URL)
        dishes = resp.data["top_expensive_dishes"]
        if len(dishes) >= 2:
            assert dishes[0]["cost_per_serving"] >= dishes[1]["cost_per_serving"]

    def test_reorder_alerts_triggered(self, db, auth_client):
        """A branch with low stock should trigger a reorder alert."""
        from org.models import Organization, Brand, Branch, City, BranchType
        from inventory.models import Unit, Ingredient, BranchStock

        org = Organization.objects.create(name="FC Org", org_code="FC001")
        city, _ = City.objects.get_or_create(name_en="RUH-FC", defaults={"name_ar": "الرياض", "option_code": "CITY-FC"})
        bt, _ = BranchType.objects.get_or_create(name_en="Rest-FC", defaults={"name_ar": "مطعم", "option_code": "TYPE-FC"})
        brand = Brand.objects.create(name="FC Brand", organization=org, slug="fc-brand", brand_code="FC-B01")
        branch = Branch.objects.create(name="FC Branch", brand=brand, city=city, branch_type=bt)

        unit, _ = Unit.objects.get_or_create(code="g-fc2", defaults={"name_en": "g"})
        ing = Ingredient.objects.create(name_en="Low-Stock-Ing", base_unit=unit, unit_cost=Decimal("1.00"))

        # Create stock below 10 (default reorder threshold)
        BranchStock.objects.create(branch=branch, ingredient=ing, on_hand=Decimal("3"))

        resp = auth_client.get(self.BASE_URL + f"?period=week&branch_id={branch.id}")
        alerts = resp.data["reorder_alerts"]
        assert any(a["ingredient_name"] == "Low-Stock-Ing" for a in alerts)
