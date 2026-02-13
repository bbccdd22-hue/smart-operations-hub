"""Fix owner email typo: ICLOU.COM -> ICLOUD.COM. Run: python manage.py fix_owner_email"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()
OWNER_EMAIL_CORRECT = "SAAL.NQ@ICLOUD.COM"


class Command(BaseCommand):
    help = "Fix SAIF owner email to SAAL.NQ@ICLOUD.COM"

    def handle(self, *args, **options):
        for wrong in ("SAAL.NQ@ICLOU.COM", "saal.nq@iclou.com"):
            updated = User.objects.filter(username__iexact="saif", email__iexact=wrong).update(
                email=OWNER_EMAIL_CORRECT
            )
            if updated:
                self.stdout.write(self.style.SUCCESS(f"Fixed {updated} user(s) email to {OWNER_EMAIL_CORRECT}"))
        saif = User.objects.filter(username__iexact="saif").first()
        if saif:
            if saif.email != OWNER_EMAIL_CORRECT:
                saif.email = OWNER_EMAIL_CORRECT
                saif.save()
                self.stdout.write(self.style.SUCCESS(f"Set SAIF email to {OWNER_EMAIL_CORRECT}"))
            else:
                self.stdout.write(f"SAIF email already correct: {saif.email}")
        else:
            self.stdout.write(self.style.WARNING("SAIF user not found"))
