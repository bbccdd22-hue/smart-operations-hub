from django.core.management.base import BaseCommand
from django.db import transaction

from org.models import Brand


DEFAULT_BRANDS = [
    "8OZ",
    "HEMI",
    "SWEET BREAD",
    "BLANCA",
    "TEA PLUS",
    "CHART",
]


class Command(BaseCommand):
    help = "Seed default brands for Smart Operations Hub."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing brands then re-seed.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        reset = bool(options["reset"])

        if reset:
            Brand.objects.all().delete()

        created = 0
        for name in DEFAULT_BRANDS:
            _, was_created = Brand.objects.get_or_create(name=name)
            created += 1 if was_created else 0

        self.stdout.write(self.style.SUCCESS(f"Brands seeded. created={created}, total={Brand.objects.count()}"))

