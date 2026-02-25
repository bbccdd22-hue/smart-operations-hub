"""
CRM & Loyalty - ملفات العملاء، النقاط، المحفظة الرقمية.
"""
from decimal import Decimal

from django.db import models

from config.constants import SYSTEM_CODE_CUSTOMER, SYSTEM_CODE_LOYALTY_POINTS, SYSTEM_CODE_WALLET
from org.models import Brand, Branch, TimestampedModel


class CustomerTier(models.TextChoices):
    BRONZE = "bronze", "برونزي"
    SILVER = "silver", "فضي"
    GOLD = "gold", "ذهبي"
    PLATINUM = "platinum", "بلاتيني"


class Customer(TimestampedModel):
    system_code = models.CharField(max_length=16, default=SYSTEM_CODE_CUSTOMER, db_index=True)
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="customers")
    customer_code = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=32, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    birth_date = models.DateField(null=True, blank=True)
    preferences = models.JSONField(default=dict, blank=True)
    tier = models.CharField(
        max_length=16, choices=CustomerTier.choices, default=CustomerTier.BRONZE, db_index=True,
    )
    total_spent = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    visit_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["customer_code"]

    def __str__(self):
        return f"{self.customer_code} - {self.name}"


class LoyaltyPointsTransaction(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="points_transactions")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True)
    points_delta = models.IntegerField()
    point_type = models.CharField(max_length=16, db_index=True)
    reference = models.CharField(max_length=128, blank=True, default="")
    sale_transaction = models.ForeignKey(
        "pos.SaleTransaction", on_delete=models.SET_NULL, null=True, blank=True, related_name="loyalty_points",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class LoyaltyReward(models.Model):
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="loyalty_rewards")
    name = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True, default="")
    points_required = models.PositiveIntegerField()
    product = models.ForeignKey(
        "inventory.FoodicsProduct", on_delete=models.SET_NULL, null=True, blank=True, related_name="loyalty_rewards",
    )
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.points_required} pts)"


class LoyaltyOffer(models.Model):
    """عرض اشترِ X واحصل على Y - أو نقاط مقابل الريالات."""
    OFFER_TYPE_BUY_X_GET_Y = "buy_x_get_y"
    OFFER_TYPE_POINTS_PER_SAR = "points_per_sar"

    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="loyalty_offers")
    name = models.CharField(max_length=120)
    offer_type = models.CharField(max_length=24, default=OFFER_TYPE_BUY_X_GET_Y, db_index=True)
    buy_x = models.PositiveIntegerField(default=1, help_text="اشترِ كم")
    get_y = models.PositiveIntegerField(default=0, help_text="احصل على كم مجاناً")
    points_per_sar = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="نقاط لكل ريال مكرر",
    )
    product = models.ForeignKey(
        "inventory.FoodicsProduct", on_delete=models.SET_NULL, null=True, blank=True, related_name="loyalty_offers",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} (buy {self.buy_x} get {self.get_y})"


class WalletBalance(models.Model):
    customer = models.OneToOneField(Customer, on_delete=models.PROTECT, related_name="wallet")
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    updated_at = models.DateTimeField(auto_now=True)


class WalletTransaction(models.Model):
    wallet = models.ForeignKey(WalletBalance, on_delete=models.PROTECT, related_name="transactions")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    txn_type = models.CharField(max_length=16)
    reference = models.CharField(max_length=128, blank=True, default="")
    sale_transaction = models.ForeignKey(
        "pos.SaleTransaction", on_delete=models.SET_NULL, null=True, blank=True, related_name="wallet_transactions",
    )
    journal_entry = models.ForeignKey(
        "accounting.JournalEntry", on_delete=models.SET_NULL, null=True, blank=True, related_name="wallet_transactions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
