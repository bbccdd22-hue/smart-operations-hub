import uuid
from decimal import Decimal

from django.db import models

from config.constants import (
    SYSTEM_CODE_BRANCH_STOCK,
    SYSTEM_CODE_INGREDIENT,
    SYSTEM_CODE_PRODUCT,
    SYSTEM_CODE_RECIPE,
    SYSTEM_CODE_RECIPE_LINE,
    SYSTEM_CODE_STOCK_MOVEMENT,
    SYSTEM_CODE_STOCK_TRANSFER,
    SYSTEM_CODE_UNIT,
    SYSTEM_CODE_WASTE_LOG,
)
from org.models import Branch, TimestampedModel


class Unit(TimestampedModel):
    """
    Units for recipes/inventory: g, kg, ml, l, pcs, etc.
    IU1002 - Prep List (PR1002) fetches inventory units from this source.
    Multi-unit conversion: base_unit + factor_to_base (1 L = 1000 ML).
    """

    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_UNIT, db_index=True,
        help_text="ERP hierarchy code (IU1002)",
    )
    code = models.CharField(max_length=16, unique=True)  # e.g. "g", "pcs"
    name_en = models.CharField(max_length=64)
    name_ar = models.CharField(max_length=64, blank=True, default="")
    base_unit = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="derived_units"
    )
    factor_to_base = models.DecimalField(
        max_digits=18, decimal_places=6, default=Decimal("1"),
        help_text="1 unit = factor_to_base of base unit (e.g. 1 L = 1000 ML)",
    )

    def __str__(self) -> str:
        return self.code


class Ingredient(TimestampedModel):
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_INGREDIENT, db_index=True,
        help_text="ERP hierarchy code",
    )
    name_en = models.CharField(max_length=200, unique=True)
    name_ar = models.CharField(max_length=200, blank=True, default="")
    base_unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="ingredients")
    # PR1002 workable units: e.g. 1 carton = 12 base units
    package_conversion_factor = models.DecimalField(
        max_digits=18, decimal_places=6, null=True, blank=True,
        help_text="Base units per package (e.g. 12 for 12 pcs per carton)",
    )
    package_name_en = models.CharField(max_length=64, blank=True, default="")
    package_name_ar = models.CharField(max_length=64, blank=True, default="")
    package_is_active = models.BooleanField(
        default=True,
        help_text="إذا False: العبوة موقفة ولا تُستخدم في التقارير (عند وجود حركات مخزنية)",
    )
    default_display_unit = models.CharField(
        max_length=16,
        choices=[("base", "Base Unit"), ("package", "Package")],
        default="base",
        help_text="الوحدة الافتراضية التي تظهر في جميع التقارير بلا استثناء",
    )
    # Override for Unit column: exact display string when set (e.g. "علبة (2.8 لتر)")
    workable_unit_label_ar = models.CharField(max_length=128, blank=True, default="")
    workable_unit_label_en = models.CharField(max_length=128, blank=True, default="")
    serial_code = models.CharField(
        max_length=64, blank=True, default="", db_index=True,
        help_text="Unique serial/code from Excel import",
    )
    linked_product = models.ForeignKey(
        "FoodicsProduct",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="linked_ingredients",
        help_text="وصفة فرعية: عندما يكون المكوّن نصف مصنع، اربطه بمنتج له وصفة لتفكيك الخصم هرمياً",
    )
    system_group = models.CharField(
        max_length=32,
        choices=[
            ("raw_materials", "Raw Materials"),
            ("packaging", "Packaging"),
            ("other", "Other"),
        ],
        default="raw_materials",
        db_index=True,
        blank=True,
    )
    unit_cost = models.DecimalField(
        max_digits=14, decimal_places=4, null=True, blank=True, default=None,
        help_text="Cost per base unit (SAR)",
    )
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name_en


class IngredientPackage(TimestampedModel):
    """عبوة صنف — يدعم عبوات متعددة لكل صنف (كرتون، علبة، باليت، إلخ)."""
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name="packages")
    name_en = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True, default="")
    conversion_factor = models.DecimalField(
        max_digits=18, decimal_places=6,
        help_text="عدد الوحدات الأساسية في هذه العبوة (مثل: 12 قطعة في الكرتون)",
    )
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(
        default=False, db_index=True,
        help_text="العبوة الافتراضية التي تظهر في التقارير والمشتريات",
    )
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Ingredient Package"
        verbose_name_plural = "Ingredient Packages"

    def __str__(self) -> str:
        return f"{self.ingredient.name_en} → {self.name_en} (×{self.conversion_factor})"


class FoodicsProduct(TimestampedModel):
    """
    Product (final item sold). From Product Catalog upload or Foodics sync.
    Ingredients are raw materials; Products are sold items.
    """

    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_PRODUCT, db_index=True,
        help_text="ERP hierarchy code",
    )
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
    Bill of Materials (BOM) for a Foodics product. Part of Prep List (PR1002).
    """

    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_RECIPE, db_index=True,
        help_text="ERP hierarchy code",
    )
    product = models.OneToOneField(FoodicsProduct, on_delete=models.CASCADE, related_name="recipe")
    yield_qty = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("1.0000"))
    yield_unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="recipes")

    def __str__(self) -> str:
        return f"Recipe: {self.product}"


class RecipeLine(TimestampedModel):
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_RECIPE_LINE, db_index=True,
        help_text="ERP hierarchy code",
    )
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
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_BRANCH_STOCK, db_index=True,
        help_text="ERP hierarchy code",
    )
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
    TRANSFER_OUT = "transfer_out", "Transfer Out"
    TRANSFER_IN = "transfer_in", "Transfer In"


class StockMovement(TimestampedModel):
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_STOCK_MOVEMENT, db_index=True,
        help_text="ERP hierarchy code",
    )
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="stock_movements")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name="stock_movements")
    movement_type = models.CharField(max_length=16, choices=StockMovementType.choices)
    qty_delta = models.DecimalField(max_digits=14, decimal_places=4)
    reference = models.CharField(max_length=128, blank=True, default="")  # e.g. Foodics order id

    def __str__(self) -> str:
        return f"{self.branch} {self.ingredient} {self.qty_delta}"


class StockTransferStatus(models.TextChoices):
    PENDING = "pending", "Pending / قيد الانتظار"
    CONFIRMED = "confirmed", "Confirmed / مؤكد الاستلام"
    REJECTED = "rejected", "Rejected / مرفوض الاستلام"


class StockTransfer(TimestampedModel):
    """طلب تحويل مخزون بين فرعين."""
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_STOCK_TRANSFER, db_index=True,
        help_text="ERP hierarchy code",
    )
    from_branch = models.ForeignKey(
        Branch, on_delete=models.PROTECT, related_name="transfers_out"
    )
    to_branch = models.ForeignKey(
        Branch, on_delete=models.PROTECT, related_name="transfers_in"
    )
    status = models.CharField(
        max_length=16, choices=StockTransferStatus.choices,
        default=StockTransferStatus.PENDING, db_index=True
    )
    requested_by = models.ForeignKey(
        "auth.User", on_delete=models.PROTECT, null=True, blank=True,
        related_name="requested_transfers",
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    confirmed_by = models.ForeignKey(
        "auth.User", on_delete=models.PROTECT, null=True, blank=True,
        related_name="confirmed_transfers",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(
        "auth.User", on_delete=models.PROTECT, null=True, blank=True,
        related_name="rejected_transfers",
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-requested_at"]


class StockTransferLine(TimestampedModel):
    """سطر تحويل – مكوّن واحد والكمية."""
    transfer = models.ForeignKey(
        StockTransfer, on_delete=models.CASCADE, related_name="lines"
    )
    ingredient = models.ForeignKey(
        Ingredient, on_delete=models.PROTECT, related_name="transfer_lines"
    )
    qty = models.DecimalField(max_digits=14, decimal_places=4)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["transfer", "ingredient"],
                name="uniq_transfer_ingredient",
            ),
        ]


class WasteLog(TimestampedModel):
    """Waste tracking: theoretical (from Prep List) vs actual usage per ingredient per date per branch."""

    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_WASTE_LOG, db_index=True,
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="waste_logs",
        db_index=True,
        help_text="الفرع – مطلوب لتتبع الهدر حسب الفرع. null للتسجيلات القديمة.",
    )
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name="waste_logs")
    date = models.DateField(db_index=True)
    theoretical_usage = models.DecimalField(
        max_digits=14, decimal_places=4, default=Decimal("0"),
        help_text="Expected usage from Prep List (base units)",
    )
    actual_usage = models.DecimalField(
        max_digits=14, decimal_places=4, default=Decimal("0"),
        help_text="Actual usage recorded (base units)",
    )
    variance = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Variance %: ((actual - theoretical) / theoretical) * 100",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["ingredient", "date"],
                condition=models.Q(branch__isnull=True),
                name="uniq_waste_log_legacy",
            ),
            models.UniqueConstraint(
                fields=["ingredient", "date", "branch"],
                condition=models.Q(branch__isnull=False),
                name="uniq_waste_log_ingredient_date_branch",
            ),
        ]
        ordering = ["-date", "ingredient__name_en"]

    def __str__(self) -> str:
        return f"{self.ingredient} {self.date}: {self.theoretical_usage} vs {self.actual_usage}"


class WasteEntry(WasteLog):
    """Alias for WasteLog (Date, Ingredient, ExpectedQty, ActualQty, Variance). Same table."""
    class Meta:
        proxy = True
