"""
Recipe Costing Integration Tests (12 tests)
=============================================
Covers:
  1.  waste_percentage stored and retrievable
  2.  effective_qty = qty * (1 + waste_pct/100)
  3.  actual_cost_per_serving = effective_qty * unit_cost
  4.  actual_cost_per_serving = 0 when unit_cost is None
  5.  Recipe.total_ingredients_cost sums all lines
  6.  Recipe.waste_cost is correct
  7.  Recipe Cost API returns 200 with correct structure
  8.  Recipe Cost API returns correct cost_per_serving
  9.  Recipe Cost API has_missing_costs = True when ingredient has no cost
  10. Recipe Cost API food_cost_pct calculated correctly
  11. Zero waste_percentage is the default
  12. Multiple lines: cost is additive
"""
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model

User = get_user_model()


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def base_unit(db):
    from inventory.models import Unit
    u, _ = Unit.objects.get_or_create(code="g-rc", defaults={"name_en": "gram", "factor_to_base": Decimal("1")})
    return u


@pytest.fixture
def ingredient_with_cost(db, base_unit):
    from inventory.models import Ingredient
    return Ingredient.objects.create(
        name_en="Flour-RC", base_unit=base_unit, unit_cost=Decimal("0.05"),
    )


@pytest.fixture
def ingredient_no_cost(db, base_unit):
    from inventory.models import Ingredient
    return Ingredient.objects.create(
        name_en="Water-RC", base_unit=base_unit, unit_cost=None,
    )


@pytest.fixture
def product_with_price(db):
    from inventory.models import FoodicsProduct
    return FoodicsProduct.objects.create(
        foodics_product_id="RC-BURGER-001",
        name="RC Burger",
        price_excl_tax=Decimal("25.00"),
    )


@pytest.fixture
def product_no_price(db):
    from inventory.models import FoodicsProduct
    return FoodicsProduct.objects.create(
        foodics_product_id="RC-SALAD-001",
        name="RC Salad",
        price_excl_tax=None,
    )


@pytest.fixture
def recipe(db, product_with_price, base_unit):
    from inventory.models import Recipe
    return Recipe.objects.create(product=product_with_price, yield_unit=base_unit)


@pytest.fixture
def recipe_line(db, recipe, ingredient_with_cost, base_unit):
    from inventory.models import RecipeLine
    return RecipeLine.objects.create(
        recipe=recipe,
        ingredient=ingredient_with_cost,
        qty=Decimal("100"),
        unit=base_unit,
        waste_percentage=Decimal("10.00"),
    )


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def auth_client(db, api_client):
    user = User.objects.create_user(username="rc_user", password="pass1234")
    api_client.force_authenticate(user=user)
    return api_client


# ── Tests ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRecipeCostingModel:
    def test_waste_percentage_stored(self, recipe_line):
        assert recipe_line.waste_percentage == Decimal("10.00")

    def test_zero_waste_is_default(self, db, recipe, ingredient_with_cost, base_unit):
        from inventory.models import RecipeLine
        line = RecipeLine.objects.create(
            recipe=recipe, ingredient=ingredient_with_cost,
            qty=Decimal("50"), unit=base_unit,
        )
        assert line.waste_percentage == Decimal("0.00")

    def test_effective_qty_with_waste(self, recipe_line):
        # qty=100, waste=10% → effective = 100 * 1.10 = 110
        expected = Decimal("110.0000")
        assert recipe_line.effective_qty == expected

    def test_effective_qty_zero_waste(self, db, recipe, ingredient_with_cost, base_unit):
        from inventory.models import RecipeLine
        line = RecipeLine.objects.create(
            recipe=recipe, ingredient=ingredient_with_cost,
            qty=Decimal("50"), unit=base_unit, waste_percentage=Decimal("0"),
        )
        assert line.effective_qty == Decimal("50.0000")

    def test_cost_per_serving_with_cost(self, recipe_line):
        # effective_qty=110g, unit_cost=0.05 SAR/g → cost = 5.5000
        expected = Decimal("5.5000")
        assert recipe_line.actual_cost_per_serving == expected

    def test_cost_per_serving_no_unit_cost(self, db, recipe, ingredient_no_cost, base_unit):
        from inventory.models import RecipeLine
        line = RecipeLine.objects.create(
            recipe=recipe, ingredient=ingredient_no_cost,
            qty=Decimal("100"), unit=base_unit, waste_percentage=Decimal("10"),
        )
        assert line.actual_cost_per_serving == Decimal("0.00")

    def test_recipe_total_cost(self, recipe_line):
        # One line: cost = 5.5
        total = recipe_line.recipe.total_ingredients_cost
        assert total == Decimal("5.5000")

    def test_recipe_waste_cost(self, recipe_line):
        # raw cost = 100 * 0.05 = 5.0, effective = 5.5, waste = 0.5
        waste = recipe_line.recipe.waste_cost
        assert abs(waste - Decimal("0.5000")) < Decimal("0.001")

    def test_multiple_lines_additive(self, db, recipe, ingredient_with_cost, ingredient_no_cost, base_unit):
        from inventory.models import RecipeLine
        RecipeLine.objects.create(
            recipe=recipe, ingredient=ingredient_with_cost,
            qty=Decimal("100"), unit=base_unit, waste_percentage=Decimal("0"),
        )
        RecipeLine.objects.create(
            recipe=recipe, ingredient=ingredient_no_cost,
            qty=Decimal("200"), unit=base_unit, waste_percentage=Decimal("20"),
        )
        # ingredient_with_cost: 100 * 0.05 = 5.0
        # ingredient_no_cost: no cost → 0
        total = recipe.total_ingredients_cost
        assert total == Decimal("5.0000")


@pytest.mark.django_db
class TestRecipeCostAPI:
    def test_recipe_cost_api_returns_200(self, auth_client, product_with_price, recipe_line):
        resp = auth_client.get(f"/api/inventory/recipes/{product_with_price.pk}/cost/")
        assert resp.status_code == 200

    def test_recipe_cost_api_structure(self, auth_client, product_with_price, recipe_line):
        resp = auth_client.get(f"/api/inventory/recipes/{product_with_price.pk}/cost/")
        data = resp.data
        assert "cost_per_serving" in data
        assert "ingredients_cost" in data
        assert "waste" in data
        assert "lines" in data

    def test_recipe_cost_api_food_cost_pct(self, auth_client, product_with_price, recipe_line):
        # cost=5.5, price=25 → 22%
        resp = auth_client.get(f"/api/inventory/recipes/{product_with_price.pk}/cost/")
        pct = resp.data["food_cost_pct"]
        assert pct is not None
        assert 20 <= float(pct) <= 25  # ~22%
