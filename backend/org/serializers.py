from rest_framework import serializers

from org.models import Brand, Branch, City, District, BranchType


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["id", "option_code", "name_en", "name_ar", "code", "is_active"]


class DistrictSerializer(serializers.ModelSerializer):
    city_name_en = serializers.CharField(source="city.name_en", read_only=True)
    city_name_ar = serializers.CharField(source="city.name_ar", read_only=True)

    class Meta:
        model = District
        fields = ["id", "option_code", "city", "city_name_en", "city_name_ar", "name_en", "name_ar", "is_active"]


class BranchTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BranchType
        fields = ["id", "option_code", "name_en", "name_ar", "is_active"]


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name", "name_ar", "slug", "brand_code", "chart_rev_prefix", "chart_exp_prefix", "is_active"]


class BranchSerializer(serializers.ModelSerializer):
    brand = BrandSerializer(read_only=True)
    city = CitySerializer(read_only=True)
    district = DistrictSerializer(read_only=True)
    branch_type = BranchTypeSerializer(read_only=True)

    class Meta:
        model = Branch
        fields = [
            "id", "name", "name_ar", "code", "branch_code",
            "brand", "city", "district", "branch_type",
            "foodics_branch_id", "is_active",
        ]

