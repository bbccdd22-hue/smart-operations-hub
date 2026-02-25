import json
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase

from inventory.models import Ingredient, Unit


class DefaultDisplayUnitPersistenceTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="tester", password="123")
        self.client.force_login(self.user)
        self.base_unit, _ = Unit.objects.get_or_create(
            code="ml",
            defaults={"name_en": "Milliliter", "name_ar": "مل"},
        )
        self.ingredient = Ingredient.objects.create(
            name_en=f"Milk-{uuid.uuid4().hex[:8]}",
            name_ar="حليب",
            base_unit=self.base_unit,
            package_conversion_factor="12000",
            package_name_en="Case*12",
            package_name_ar="كرتون*12",
            default_display_unit="base",
        )

    def test_patch_default_display_unit_persists_after_refresh(self):
        patch_res = self.client.patch(
            f"/api/inventory/ingredients/{self.ingredient.id}/",
            data=json.dumps({"default_display_unit": "package"}),
            content_type="application/json",
        )
        self.assertEqual(patch_res.status_code, 200, patch_res.content)

        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.default_display_unit, "package")

        detail_res = self.client.get(f"/api/inventory/ingredients/{self.ingredient.id}/")
        self.assertEqual(detail_res.status_code, 200, detail_res.content)
        self.assertEqual(detail_res.json().get("default_display_unit"), "package")

    def test_default_display_unit_resets_to_base_when_package_removed(self):
        self.ingredient.default_display_unit = "package"
        self.ingredient.save(update_fields=["default_display_unit"])

        patch_res = self.client.patch(
            f"/api/inventory/ingredients/{self.ingredient.id}/",
            data=json.dumps({"package_conversion_factor": None}),
            content_type="application/json",
        )
        self.assertEqual(patch_res.status_code, 200, patch_res.content)

        self.ingredient.refresh_from_db()
        self.assertEqual(self.ingredient.default_display_unit, "base")
