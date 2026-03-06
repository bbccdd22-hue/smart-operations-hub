"""Serializers for the Onboarding Wizard API."""
from rest_framework import serializers


class SignupRequestSerializer(serializers.Serializer):
    """Step 1 of onboarding: Company info + admin credentials."""

    # Company info
    company_name = serializers.CharField(max_length=200)
    company_name_ar = serializers.CharField(max_length=200, required=False, default="")
    tenant_slug = serializers.SlugField(
        max_length=63,
        required=False,
        allow_blank=True,
        help_text="يُستخدم كـ subdomain. يُولَّد تلقائياً من اسم الشركة إذا تُرك فارغاً.",
    )
    brand_name = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        help_text="اسم العلامة التجارية — يساوي اسم الشركة إذا تُرك فارغاً.",
    )

    # Admin user
    admin_username = serializers.CharField(max_length=150)
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(
        min_length=8,
        write_only=True,
        style={"input_type": "password"},
    )

    # Plan
    plan = serializers.ChoiceField(
        choices=["trial", "starter", "growth", "pro", "enterprise"],
        default="trial",
    )

    def validate_admin_username(self, value: str) -> str:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("اسم المستخدم موجود بالفعل.")
        return value

    def validate_tenant_slug(self, value: str) -> str:
        if not value:
            return value
        from org.models import Tenant
        if Tenant.objects.filter(slug=value).exists():
            raise serializers.ValidationError("هذا الـ slug مستخدم بالفعل.")
        return value
