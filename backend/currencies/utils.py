"""
Currency conversion utilities.
Uses Decimal(20, 10) precision for monetary calculations.
"""
from decimal import Decimal, ROUND_HALF_UP

from config.constants import DECIMAL_PLACES


def convert_amount(amount, from_currency, to_currency):
    """
    Convert amount from one currency to another using ExchangeRate.

    Args:
        amount: Decimal or float (will be coerced to Decimal)
        from_currency: Currency instance or code (e.g. "USD")
        to_currency: Currency instance or code (e.g. "SAR")

    Returns:
        Decimal: Converted amount with DECIMAL_PLACES precision, or amount unchanged
        if from_currency equals to_currency or rate is 1.

    Raises:
        ValueError: If conversion path cannot be resolved.
    """
    from .models import Currency, ExchangeRate

    amount = Decimal(str(amount))
    if amount == 0:
        return Decimal("0").quantize(Decimal(f"0.{'0' * DECIMAL_PLACES}"), rounding=ROUND_HALF_UP)

    # Resolve to Currency instances
    if isinstance(from_currency, str):
        try:
            from_currency = Currency.objects.get(code=from_currency.upper())
        except Currency.DoesNotExist:
            raise ValueError(f"Currency not found: {from_currency}")
    if isinstance(to_currency, str):
        try:
            to_currency = Currency.objects.get(code=to_currency.upper())
        except Currency.DoesNotExist:
            raise ValueError(f"Currency not found: {to_currency}")

    if from_currency.id == to_currency.id:
        return amount.quantize(Decimal(f"0.{'0' * DECIMAL_PLACES}"), rounding=ROUND_HALF_UP)

    # Direct rate: from_currency -> to_currency
    rate_qs = ExchangeRate.objects.filter(
        from_currency=from_currency,
        to_currency=to_currency,
    )
    if rate_qs.exists():
        rate = rate_qs.first().rate
        result = (amount * rate).quantize(Decimal(f"0.{'0' * DECIMAL_PLACES}"), rounding=ROUND_HALF_UP)
        return result

    # Inverse rate: to_currency -> from_currency (use 1/rate)
    inv_qs = ExchangeRate.objects.filter(
        from_currency=to_currency,
        to_currency=from_currency,
    )
    if inv_qs.exists():
        inv_rate = inv_qs.first().rate
        if inv_rate == 0:
            raise ValueError(f"Cannot convert: inverse rate from {to_currency.code} to {from_currency.code} is zero")
        rate = Decimal("1") / inv_rate
        result = (amount * rate).quantize(Decimal(f"0.{'0' * DECIMAL_PLACES}"), rounding=ROUND_HALF_UP)
        return result

    # Via base currency if available
    base = Currency.objects.filter(is_base=True).first()
    if base and base.id not in (from_currency.id, to_currency.id):
        try:
            to_base = convert_amount(amount, from_currency, base)
            return convert_amount(to_base, base, to_currency)
        except ValueError:
            pass

    raise ValueError(
        f"No exchange rate found for {from_currency.code} → {to_currency.code}. "
        "Add rates via Admin or update_exchange_rates management command."
    )
