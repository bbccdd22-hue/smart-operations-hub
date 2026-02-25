"""
Multi-currency support: Currency and ExchangeRate models.
Uses Decimal(20, 10) for all rates and monetary calculations.
"""
from django.db import models

from config.constants import DECIMAL_MAX_DIGITS, DECIMAL_PLACES


class Currency(models.Model):
    """ISO currency with optional base-currency flag."""
    code = models.CharField(max_length=3, unique=True, db_index=True)  # ISO 4217: SAR, USD, EUR
    name = models.CharField(max_length=120)
    symbol = models.CharField(max_length=16, blank=True, default="")
    is_base = models.BooleanField(default=False, help_text="Base currency for conversions (e.g. SAR)")

    class Meta:
        verbose_name = "Currency"
        verbose_name_plural = "Currencies"
        ordering = ["code"]

    def __str__(self) -> str:
        return f"{self.code} ({self.name})"


class ExchangeRate(models.Model):
    """Exchange rate: 1 from_currency = rate to_currency."""
    from_currency = models.ForeignKey(
        Currency,
        on_delete=models.CASCADE,
        related_name="rates_from",
    )
    to_currency = models.ForeignKey(
        Currency,
        on_delete=models.CASCADE,
        related_name="rates_to",
    )
    rate = models.DecimalField(
        max_digits=DECIMAL_MAX_DIGITS,
        decimal_places=DECIMAL_PLACES,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Exchange Rate"
        verbose_name_plural = "Exchange Rates"
        unique_together = [("from_currency", "to_currency")]
        ordering = ["from_currency", "to_currency"]

    def __str__(self) -> str:
        return f"{self.from_currency.code} → {self.to_currency.code}: {self.rate}"
