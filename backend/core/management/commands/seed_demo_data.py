"""
Seed demo data for production first-run.
Runs: seed_brands + chart of accounts.
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed brands and chart of accounts for production demo."

    def handle(self, *args, **options):
        call_command("seed_brands")
        from onboarding.demo_seeder import seed_chart_of_accounts

        count = seed_chart_of_accounts()
        self.stdout.write(self.style.SUCCESS(f"Demo data seeded. COA accounts created: {count}"))
