"""Create an owner user with profile. Usage: python manage.py create_owner <username> <password> [--email EMAIL]"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from org.models import UserProfile, UserRole

User = get_user_model()
OWNER_EMAIL = "SAAL.NQ@ICLOUD.COM"  # Correct owner email (use for SAIF)


class Command(BaseCommand):
    help = "Create an owner user with profile (superuser + Owner role)"

    def add_arguments(self, parser):
        parser.add_argument("username", type=str)
        parser.add_argument("password", type=str)
        parser.add_argument("--email", type=str, default="", help="Email (optional). For SAIF, uses SAAL.NQ@ICLOUD.COM if not provided)")

    def handle(self, *args, **options):
        username = options["username"]
        password = options["password"]
        email = (options.get("email") or "").strip()
        if not email and username.upper() == "SAIF":
            email = OWNER_EMAIL

        defaults = {"is_staff": True, "is_superuser": True}
        if email:
            defaults["email"] = email

        user, created = User.objects.get_or_create(
            username=username,
            defaults=defaults,
        )
        user.is_staff = True
        user.is_superuser = True
        if email:
            user.email = email
        user.set_password(password)
        user.save()

        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={"role": UserRole.OWNER},
        )
        profile.role = UserRole.OWNER
        profile.brand_id = None
        profile.branch_id = None
        profile.save()

        self.stdout.write(self.style.SUCCESS(f"Owner user '{username}' ready. Created={created}"))
