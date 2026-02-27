"""
Procurement serializers - Supplier, Purchase Order, etc.
"""
from rest_framework import serializers

from procurement.models import Supplier


class SupplierSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    brand_slug = serializers.CharField(source="brand.slug", read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id",
            "brand",
            "brand_name",
            "brand_slug",
            "name",
            "name_ar",
            "tax_number",
            "contact_email",
            "contact_phone",
            "address",
            "credit_days",
            "payment_terms",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
