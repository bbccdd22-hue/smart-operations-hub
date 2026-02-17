from decimal import Decimal

from rest_framework import serializers

from shifts.models import Shift, ShiftClosing, ShiftStatus, ShiftType


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = [
            "id", "branch", "status", "shift_type",
            "opened_at", "closed_at", "opening_petty_cash",
            "opened_by", "closed_by", "notes",
        ]


class ShiftClosingSerializer(serializers.ModelSerializer):
    denomination_total = serializers.SerializerMethodField()
    manual_cash_total = serializers.SerializerMethodField()
    manual_network_total = serializers.SerializerMethodField()
    manual_delivery_total = serializers.SerializerMethodField()
    shift_notes = serializers.SerializerMethodField()
    opening_petty_cash = serializers.SerializerMethodField()

    class Meta:
        model = ShiftClosing
        fields = [
            "id",
            "shift",
            "status",
            "submitted_at",
            "submitted_by",
            # denominations
            "bills_500",
            "bills_200",
            "bills_100",
            "bills_50",
            "bills_20",
            "bills_10",
            "bills_5",
            "bills_1",
            "manual_cash_override",
            # manual inputs
            "mada",
            "visa",
            "master_card",
            "hungerstation",
            "jahez",
            "lugmety",
            "the_chefz",
            "toyou",
            "expenses_vouchers",
            "staff_drinks",
            # system inputs
            "system_cash",
            "system_network",
            "system_delivery",
            "system_total_sales",
            # computed
            "variance_cash",
            "variance_network",
            "reconciled_at",
            # helpers
            "denomination_total",
            "manual_cash_total",
            "manual_network_total",
            "manual_delivery_total",
            "shift_notes",
            "opening_petty_cash",
        ]

        read_only_fields = ["variance_cash", "variance_network", "reconciled_at", "submitted_at", "submitted_by"]

    def get_denomination_total(self, obj) -> Decimal:
        return obj.denomination_total()

    def get_manual_cash_total(self, obj) -> Decimal:
        return obj.manual_cash_total()

    def get_manual_network_total(self, obj) -> Decimal:
        return obj.manual_network_total()

    def get_manual_delivery_total(self, obj) -> Decimal:
        return obj.manual_delivery_total()

    def get_shift_notes(self, obj) -> str:
        return (obj.shift.notes or "") if obj.shift_id else ""

    def get_opening_petty_cash(self, obj) -> Decimal | None:
        return obj.shift.opening_petty_cash if obj.shift_id else None


class ShiftClosingCreatePayloadSerializer(serializers.Serializer):
    """Payload for create/update + submit."""
    branch_id = serializers.IntegerField()
    date = serializers.DateField()
    shift_type = serializers.ChoiceField(choices=ShiftType.choices, default=ShiftType.MORNING)
    notes = serializers.CharField(required=False, allow_blank=True)
    opening_petty_cash = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal("0"))
    submit = serializers.BooleanField(default=False)
    # Denominations
    bills_500 = serializers.IntegerField(default=0)
    bills_200 = serializers.IntegerField(default=0)
    bills_100 = serializers.IntegerField(default=0)
    bills_50 = serializers.IntegerField(default=0)
    bills_20 = serializers.IntegerField(default=0)
    bills_10 = serializers.IntegerField(default=0)
    bills_5 = serializers.IntegerField(default=0)
    bills_1 = serializers.IntegerField(default=0)
    manual_cash_override = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    # Cards
    mada = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    visa = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    master_card = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    # Delivery
    hungerstation = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    jahez = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    lugmety = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    the_chefz = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    toyou = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    # Deductions
    expenses_vouchers = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    staff_drinks = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    # System (from Excel/Foodics)
    system_cash = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    system_network = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    system_delivery = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    system_total_sales = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
