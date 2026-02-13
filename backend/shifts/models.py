from decimal import Decimal

from django.conf import settings
from django.db import models

from org.models import Branch, TimestampedModel


class ShiftStatus(models.TextChoices):
    OPEN = "open", "Open"
    CLOSED = "closed", "Closed"


class ShiftType(models.TextChoices):
    MORNING = "morning", "Morning"
    EVENING = "evening", "Evening"
    LATE_NIGHT = "late_night", "Late Night"


class Shift(TimestampedModel):
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="shifts")
    status = models.CharField(max_length=16, choices=ShiftStatus.choices, default=ShiftStatus.OPEN)
    shift_type = models.CharField(
        max_length=16, choices=ShiftType.choices, default=ShiftType.MORNING, db_index=True
    )

    opened_at = models.DateTimeField()
    closed_at = models.DateTimeField(null=True, blank=True)

    opening_petty_cash = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="opened_shifts"
    )
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="closed_shifts"
    )

    notes = models.TextField(blank=True, default="")

    def __str__(self) -> str:
        return f"{self.branch} @ {self.opened_at:%Y-%m-%d %H:%M}"


class ShiftClosing(TimestampedModel):
    """
    Digital version of shift closing.

    - Manual inputs: denomination counts + digital/delivery inputs + deductions
    - System inputs: pulled from Foodics (cash/network/delivery totals)
    - Variances: cash + network computed separately
    """

    shift = models.OneToOneField(Shift, on_delete=models.CASCADE, related_name="closing")

    # Denominations (SAR)
    bills_500 = models.PositiveIntegerField(default=0)
    bills_200 = models.PositiveIntegerField(default=0)
    bills_100 = models.PositiveIntegerField(default=0)
    bills_50 = models.PositiveIntegerField(default=0)
    bills_20 = models.PositiveIntegerField(default=0)
    bills_10 = models.PositiveIntegerField(default=0)
    bills_5 = models.PositiveIntegerField(default=0)
    bills_1 = models.PositiveIntegerField(default=0)

    # Manual inputs
    manual_cash_override = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, help_text="Optional: manual cash total override"
    )

    mada = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    visa = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    master_card = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    hungerstation = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    jahez = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    lugmety = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    the_chefz = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    toyou = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    expenses_vouchers = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    staff_drinks = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # System values (Foodics API v5)
    system_cash = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    system_network = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    system_delivery = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    system_total_sales = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Computed reconciliation outputs (stored for reporting/alerts)
    variance_cash = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    variance_network = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    reconciled_at = models.DateTimeField(null=True, blank=True)

    # Submission & Approval
    class ClosingStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"

    status = models.CharField(
        max_length=16, choices=ClosingStatus.choices, default=ClosingStatus.DRAFT, db_index=True
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="submitted_closings",
    )

    def denomination_total(self) -> Decimal:
        return (
            Decimal(self.bills_500) * 500
            + Decimal(self.bills_200) * 200
            + Decimal(self.bills_100) * 100
            + Decimal(self.bills_50) * 50
            + Decimal(self.bills_20) * 20
            + Decimal(self.bills_10) * 10
            + Decimal(self.bills_5) * 5
            + Decimal(self.bills_1) * 1
        )

    def manual_cash_total(self) -> Decimal:
        return self.manual_cash_override if self.manual_cash_override is not None else self.denomination_total()

    def manual_network_total(self) -> Decimal:
        return self.mada + self.visa + self.master_card

    def manual_delivery_total(self) -> Decimal:
        return self.hungerstation + self.jahez + self.lugmety + self.the_chefz + self.toyou

    def compute_variances(self) -> tuple[Decimal, Decimal]:
        """
        Variance logic:
        - Cash variance compares manual cash against system cash (optionally adjust by deductions if desired later)
        - Network variance compares manual network against system network
        """
        v_cash = self.manual_cash_total() - self.system_cash
        v_network = self.manual_network_total() - self.system_network
        return (v_cash, v_network)


class ShiftSecurityLog(TimestampedModel):
    """
    Audit log: who closed which shift and when.
    """
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name="security_logs")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="shift_security_logs"
    )
    action = models.CharField(max_length=32, default="shift_closed")  # shift_closed, etc.
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
