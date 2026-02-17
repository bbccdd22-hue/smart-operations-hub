from rest_framework import serializers

from accounting.models import ChartAccount


class ChartAccountSerializer(serializers.ModelSerializer):
    has_balance = serializers.SerializerMethodField()

    class Meta:
        model = ChartAccount
        fields = [
            "id",
            "code",
            "name_ar",
            "name_en",
            "level",
            "parent",
            "account_type",
            "statement",
            "is_active",
            "balance",
            "has_balance",
        ]

    def get_has_balance(self, obj):
        """قاعدة سيف: لا حذف لحساب برصيد."""
        bal = getattr(obj, "balance", None)
        return bool(bal is not None and float(bal) != 0)
