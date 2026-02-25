"""
Update exchange rates: manual input or optional external API.

Usage:
  # Manual: set rate for USD -> SAR
  python manage.py update_exchange_rates --from USD --to SAR --rate 3.75

  # Manual: set rate for EUR -> SAR
  python manage.py update_exchange_rates --from EUR --to SAR --rate 4.02

  # Create currencies if missing, then set rate
  python manage.py update_exchange_rates --from USD --to SAR --rate 3.75 --create-currencies

  # Placeholder for external API (implement fetch_external_rates when needed)
  python manage.py update_exchange_rates --external
"""
from decimal import Decimal

from django.core.management.base import BaseCommand

from config.constants import DECIMAL_MAX_DIGITS, DECIMAL_PLACES
from currencies.models import Currency, ExchangeRate


def _get_or_create_currency(code: str, name: str = "", symbol: str = "") -> Currency:
    code = code.upper()
    obj, created = Currency.objects.get_or_create(
        code=code,
        defaults={"name": name or code, "symbol": symbol or ""},
    )
    return obj


def fetch_external_rates():
    """
    Placeholder for external exchange rate API (e.g. exchangerate-api.com, fixer.io).
    Override this to integrate with a real provider.

    Returns:
        list of (from_code, to_code, rate) tuples
    """
    # Example structure when implementing:
    # import requests
    # resp = requests.get("https://api.exchangerate-api.com/v4/latest/SAR")
    # data = resp.json()
    # return [(code, "SAR", Decimal(str(1 / rate))) for code, rate in data["rates"].items()]
    return []


class Command(BaseCommand):
    help = "Update exchange rates: manual (--from/--to/--rate) or external API (--external)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--from",
            dest="from_code",
            type=str,
            default=None,
            help="Source currency code (e.g. USD)",
        )
        parser.add_argument(
            "--to",
            dest="to_code",
            type=str,
            default=None,
            help="Target currency code (e.g. SAR)",
        )
        parser.add_argument(
            "--rate",
            type=str,
            default=None,
            help="Exchange rate: 1 from_currency = rate to_currency",
        )
        parser.add_argument(
            "--create-currencies",
            action="store_true",
            help="Create Currency records if they do not exist",
        )
        parser.add_argument(
            "--external",
            action="store_true",
            help="Fetch rates from external API (placeholder: implement fetch_external_rates)",
        )

    def handle(self, *args, **options):
        from_code = options.get("from_code")
        to_code = options.get("to_code")
        rate_str = options.get("rate")
        create_currencies = options.get("create_currencies")
        use_external = options.get("external")

        if use_external:
            rates = fetch_external_rates()
            if not rates:
                self.stdout.write(
                    self.style.WARNING(
                        "External API placeholder: no rates returned. "
                        "Implement fetch_external_rates() in this command."
                    )
                )
                return
            updated = 0
            for fc, tc, rate in rates:
                try:
                    _update_rate(fc, tc, rate, create_currencies)
                    updated += 1
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Failed {fc}->{tc}: {e}"))
            self.stdout.write(self.style.SUCCESS(f"Updated {updated} exchange rate(s) from external API."))
            return

        if not from_code or not to_code or not rate_str:
            self.stdout.write(
                self.style.ERROR("For manual mode, provide --from, --to, and --rate")
            )
            return

        try:
            rate = Decimal(rate_str)
        except Exception:
            self.stdout.write(self.style.ERROR(f"Invalid rate: {rate_str}"))
            return

        _update_rate(from_code, to_code, rate, create_currencies)
        self.stdout.write(
            self.style.SUCCESS(f"Set {from_code} -> {to_code} = {rate}")
        )


def _update_rate(from_code: str, to_code: str, rate: Decimal, create_currencies: bool):
    from_code = from_code.upper()
    to_code = to_code.upper()
    rate = Decimal(str(rate)).quantize(Decimal(f"0.{'0' * DECIMAL_PLACES}"))

    if create_currencies:
        _get_or_create_currency(from_code)
        _get_or_create_currency(to_code)

    from_curr = Currency.objects.get(code=from_code)
    to_curr = Currency.objects.get(code=to_code)

    obj, created = ExchangeRate.objects.update_or_create(
        from_currency=from_curr,
        to_currency=to_curr,
        defaults={"rate": rate},
    )
    return obj
