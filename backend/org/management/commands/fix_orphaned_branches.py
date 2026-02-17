"""
Fix branches that reference deleted cities (orphaned city_id).
Creates a placeholder city and assigns orphaned branches to it.
Run after CityClearView leaves orphaned branches.
"""
from django.core.management.base import BaseCommand
from django.db import connection

from org.models import Branch, City


class Command(BaseCommand):
    help = "Fix branches with orphaned city_id (city was deleted). Creates placeholder city."

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT DISTINCT city_id FROM org_branch WHERE city_id NOT IN (SELECT id FROM org_city)"
            )
            bad_ids = [r[0] for r in cursor.fetchall()]

        if not bad_ids:
            self.stdout.write(self.style.SUCCESS("No orphaned branches found."))
            return

        self.stdout.write(f"Found branches referencing deleted cities: {bad_ids}")

        # Create placeholder city if needed
        placeholder, created = City.objects.get_or_create(
            code="placeholder-city",
            defaults={
                "name_en": "Riyadh",
                "name_ar": "الرياض",
                "option_code": "CITY-01",
                "is_active": True,
            },
        )
        if created:
            self.stdout.write(f"Created placeholder city: {placeholder.name_en} (id={placeholder.id})")

        updated = Branch.objects.filter(city_id__in=bad_ids).update(city=placeholder)
        self.stdout.write(self.style.SUCCESS(f"Updated {updated} branch(es) to city {placeholder.name_en}."))
