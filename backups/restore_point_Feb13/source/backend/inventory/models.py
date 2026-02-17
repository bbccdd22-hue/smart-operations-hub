from decimal import Decimal

from django.db import models

from org.models import Branch, TimestampedModel


class Unit(TimestampedModel):
    """
    Units for recipes/inventory: g, kg, ml, l, pcs, etc.
    """

    code = models.CharField(max_length=16, unique=True)  # e.g. "g", "pcs"
    name_en = models.CharField(max_length=64)
    name_ar = models.CharField(max_length=64, blank=True, default="")

    def __str__(self) -> str:
        return self.code


class Ingredient(TimestampedModel):
    name_en = models.CharField(max_length=200, unique=True)
    name_ar = models.CharField(max_length=200, blank=True, default="")
    base_unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="ingredients")
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name_en


class FoodicsProduct(TimestampedModel):
    """
    Product (final item sold). From Product Catalog upload or Foodics sync.
    Ingredients are raw materials; Products are sold items.
    """

    foodics_product_id = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    sales_unit = models.ForeignKey(
        Unit, null=True, blank=True, on_delete=models.SET_NULL, related_name="products"
    )
    price_excl_tax = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True
    )

    def __str__(self) -> str:
        return self.name


class Recipe(TimestampedModel):
    """
    Bill of Materials (BOM) for a Foodics product.
    """

    product = models.OneToOneField(FoodicsProduct, on_delete=models.CASCADE, related_name="recipe")
    yield_qty = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("1.0000"))
    yield_unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="recipes")

    def __str__(self) -> str:
        return f"Recipe: {self.product}"


class RecipeLine(TimestampedModel):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="lines")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name="recipe_lines")
    qty = models.DecimalField(max_digits=12, decimal_places=4)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="recipe_lines")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["recipe", "ingredient"], name="uniq_recipe_ingredient"),
        ]

    def __str__(self) -> str:
        return f"{self.recipe.product} -> {self.ingredient} ({self.qty} {self.unit})"


class BranchStock(TimestampedModel):
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="stock_items")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name="branch_stocks")

    on_hand = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0.0000"))
    reorder_level = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal("0.0000"))

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["branch", "ingredient"], name="uniq_branch_ingredient_stock"),
        ]

    def __str__(self) -> str:
        return f"{self.branch}: {self.ingredient} = {self.on_hand}"


class StockMovementType(models.TextChoices):
    PURCHASE = "purchase", "Purchase"
    ADJUSTMENT = "adjustment", "Adjustment"
    DEPLETION = "depletion", "Depletion"


class StockMovement(TimestampedModel):
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="stock_movements")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name="stock_movements")
    movement_type = models.CharField(max_length=16, choices=StockMovementType.choices)
    qty_delta = models.DecimalField(max_digits=14, decimal_places=4)
    reference = models.CharField(max_length=128, blank=True, default="")  # e.g. Foodics order id

    def __str__(self) -> str:
        return f"{self.branch} {self.ingredient} {self.qty_delta}"
