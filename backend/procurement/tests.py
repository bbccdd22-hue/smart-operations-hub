from datetime import date
from decimal import Decimal
import uuid

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from imports.models import ExcelReportType, ExcelUpload, ProductSale
from inventory.models import (
    BranchStock,
    FoodicsProduct,
    Ingredient,
    Recipe,
    RecipeLine,
    Unit,
)
from org.models import Brand, Branch, City
from procurement.purchase_suggestion_services import get_purchase_suggestions


class PurchaseSuggestionDisplayUnitTests(TestCase):
    def setUp(self):
        self.base_unit, _ = Unit.objects.get_or_create(
            code="ml",
            defaults={"name_en": "Milliliter", "name_ar": "مل"},
        )
        uniq = uuid.uuid4().hex[:8]
        self.city = City.objects.create(name_en=f"Riyadh {uniq}", code=f"riyadh-{uniq}")
        self.brand = Brand.objects.create(
            name=f"Demo Brand {uniq}",
            slug=f"demo-brand-{uniq}",
            brand_code=f"BR-{uniq}",
        )
        self.branch = Branch.objects.create(
            brand=self.brand,
            city=self.city,
            name=f"Main Branch {uniq}",
            code=f"main-branch-{uniq}",
        )
        self.ingredient = Ingredient.objects.create(
            name_en=f"Milk-{uniq}",
            name_ar="حليب",
            base_unit=self.base_unit,
            package_conversion_factor=Decimal("12000"),
            package_name_en="Case*12",
            package_name_ar="كرتون*12",
            default_display_unit="package",
            package_is_active=True,
        )
        BranchStock.objects.create(
            branch=self.branch,
            ingredient=self.ingredient,
            on_hand=Decimal("6000"),
            reorder_level=Decimal("0"),
        )
        product = FoodicsProduct.objects.create(foodics_product_id=f"SKU-MILK-{uniq}", name=f"Latte {uniq}")
        recipe = Recipe.objects.create(
            product=product,
            yield_qty=Decimal("1"),
            yield_unit=self.base_unit,
        )
        RecipeLine.objects.create(
            recipe=recipe,
            ingredient=self.ingredient,
            qty=Decimal("1000"),
            unit=self.base_unit,
        )
        upload = ExcelUpload.objects.create(
            report_type=ExcelReportType.PRODUCT_SALES,
            file=SimpleUploadedFile(
                "product_sales.xlsx",
                b"dummy",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ),
        )
        ProductSale.objects.create(
            brand=self.brand,
            branch=self.branch,
            date=date.today(),
            product_name=product.name,
            product_sku=product.foodics_product_id,
            qty=Decimal("12"),
            total_sales=Decimal("120"),
            upload=upload,
        )

    def _suggestions(self):
        return get_purchase_suggestions(
            branch_id=self.branch.id,
            horizon_days=1,
            lookback_days=1,
            safety_buffer_days=0,
        )

    def test_uses_package_default_unit_for_purchase_suggestion_display(self):
        suggestions = self._suggestions()
        self.assertEqual(len(suggestions), 1)
        item = suggestions[0]

        self.assertEqual(item["display_unit_source"], "package")
        self.assertEqual(item["unit_code"], "Case*12")
        self.assertEqual(Decimal(item["required_base_qty"]), Decimal("12000"))
        self.assertEqual(Decimal(item["on_hand_base_qty"]), Decimal("6000"))
        self.assertEqual(Decimal(item["suggested_purchase_base_qty"]), Decimal("6000"))
        self.assertEqual(Decimal(item["required_qty"]), Decimal("1"))
        self.assertEqual(Decimal(item["on_hand"]), Decimal("0.5"))
        self.assertEqual(Decimal(item["suggested_purchase_qty"]), Decimal("0.5"))

    def test_falls_back_to_base_unit_when_package_not_active(self):
        self.ingredient.package_is_active = False
        self.ingredient.save(update_fields=["package_is_active"])

        suggestions = self._suggestions()
        self.assertEqual(len(suggestions), 1)
        item = suggestions[0]

        self.assertEqual(item["display_unit_source"], "base")
        self.assertEqual(item["unit_code"], "ml")
        self.assertEqual(Decimal(item["required_qty"]), Decimal("12000"))
        self.assertEqual(Decimal(item["suggested_purchase_qty"]), Decimal("6000"))
