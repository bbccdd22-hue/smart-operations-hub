"""
Force-delete ALL cities and districts. Uses raw SQL with FK checks disabled.
Branches will have orphaned city_id; reassign cities when creating new ones.
Next city gets CITY-01.
"""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "FORCE delete all Cities and Districts. Table 100%% empty. Next city: CITY-01."

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            vendor = connection.vendor

            # Disable FK checks
            if vendor == "sqlite":
                cursor.execute("PRAGMA foreign_keys = OFF")
            elif vendor == "postgresql":
                cursor.execute("SET session_replication_role = replica")

            try:
                cursor.execute("DELETE FROM org_district")
                district_deleted = cursor.rowcount
                cursor.execute("DELETE FROM org_city")
                city_deleted = cursor.rowcount
                self.stdout.write(self.style.SUCCESS(
                    f"Deleted {city_deleted} city(ies), {district_deleted} district(s). "
                    "Cities table is EMPTY. Next city will be CITY-01."
                ))
            finally:
                if vendor == "sqlite":
                    cursor.execute("PRAGMA foreign_keys = ON")
                elif vendor == "postgresql":
                    cursor.execute("SET session_replication_role = DEFAULT")
