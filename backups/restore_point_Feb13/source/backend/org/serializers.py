from rest_framework import serializers

from org.models import Brand, Branch, City


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["id", "name_en", "name_ar", "code", "is_active"]


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name", "slug", "brand_code", "is_active"]


class BranchSerializer(serializers.ModelSerializer):
    brand = BrandSerializer(read_only=True)
    city = CitySerializer(read_only=True)

    class Meta:
        model = Branch
        fields = ["id", "name", "name_ar", "code", "branch_code", "brand", "city", "foodics_branch_id", "is_active"]

