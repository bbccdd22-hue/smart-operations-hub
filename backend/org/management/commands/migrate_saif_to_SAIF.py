"""
Migrate Super Admin: consolidate saif (lowercase) into SAIF (uppercase).
- Establishes SAIF as the sole Super Admin
- Migrates all data from saif to SAIF
- Deletes saif account
- Clears sessions for the deleted account

Usage: python manage.py migrate_saif_to_SAIF [--password PASSWORD]
"""
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.core.management.base import BaseCommand
from django.db import transaction

from org.models import (
    UserProfile,
    UserRole,
    ActivityLog,
    AdminNotification,
    NotificationPreference,
    SavedView,
)

User = get_user_model()
OWNER_EMAIL = "SAAL.NQ@ICLOUD.COM"


def _clear_sessions_for_user(user_id):
    """Delete all sessions for a given user ID."""
    deleted = 0
    for session in Session.objects.all():
        try:
            data = session.get_decoded()
            if str(data.get("_auth_user_id")) == str(user_id):
                session.delete()
                deleted += 1
        except Exception:
            pass
    return deleted


class Command(BaseCommand):
    help = "Migrate saif (lowercase) to SAIF (uppercase) as sole Super Admin. Delete saif, clear its sessions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            type=str,
            default="",
            help="Password for SAIF if creating new (recommended for first run)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without making changes",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        password = (options.get("password") or "").strip()

        saif_lower = User.objects.filter(username="saif").first()
        saif_upper = User.objects.filter(username="SAIF").first()

        self.stdout.write(f"Found saif (lowercase): {saif_lower is not None}" + (f" (id={saif_lower.id})" if saif_lower else ""))
        self.stdout.write(f"Found SAIF (uppercase): {saif_upper is not None}" + (f" (id={saif_upper.id})" if saif_upper else ""))

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN – no changes applied"))
            return

        with transaction.atomic():
            if saif_lower and not saif_upper:
                # Only saif exists: rename to SAIF (simplest path)
                self.stdout.write("Renaming saif -> SAIF...")
                saif_lower.username = "SAIF"
                saif_lower.is_staff = True
                saif_lower.is_superuser = True
                saif_lower.save(update_fields=["username", "is_staff", "is_superuser"])
                saif_upper = saif_lower
                saif_lower = None
                self.stdout.write(self.style.SUCCESS("Renamed saif to SAIF with full privileges"))

            elif saif_lower and saif_upper:
                # Both exist: migrate data from saif to SAIF, then delete saif
                self.stdout.write("Both accounts exist. Migrating data from saif to SAIF...")

                # Migrate models with user FK (exclude UserProfile - it's 1:1, we keep SAIF's)
                ActivityLog.objects.filter(user=saif_lower).update(user=saif_upper)
                AdminNotification.objects.filter(user=saif_lower).update(user=saif_upper)
                NotificationPreference.objects.filter(user=saif_lower).update(user=saif_upper)
                SavedView.objects.filter(user=saif_lower).update(user=saif_upper)

                # ExcelUpload uses uploaded_by
                try:
                    from imports.models import ExcelUpload
                    ExcelUpload.objects.filter(uploaded_by=saif_lower).update(uploaded_by=saif_upper)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"ExcelUpload migration: {e}"))

                # shifts SecurityLog
                try:
                    from shifts.models import ShiftSecurityLog
                    ShiftSecurityLog.objects.filter(user=saif_lower).update(user=saif_upper)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"ShiftSecurityLog migration: {e}"))

                # Clear sessions for saif BEFORE deleting
                cleared = _clear_sessions_for_user(saif_lower.id)
                self.stdout.write(f"Cleared {cleared} session(s) for saif")

                # Delete saif's profile first (it will cascade on user delete, but explicit is safer)
                UserProfile.objects.filter(user=saif_lower).delete()
                saif_lower.delete()
                self.stdout.write(self.style.SUCCESS("Deleted saif account"))

            elif saif_upper and not saif_lower:
                # Ensure SAIF has full privileges
                if not saif_upper.is_staff or not saif_upper.is_superuser:
                    saif_upper.is_staff = True
                    saif_upper.is_superuser = True
                    saif_upper.save(update_fields=["is_staff", "is_superuser"])
                    self.stdout.write(self.style.SUCCESS("SAIF privileges updated (is_staff, is_superuser)"))
                else:
                    self.stdout.write(self.style.SUCCESS("SAIF already exists with full privileges. Nothing to do."))

            else:
                # Neither exists: create SAIF
                self.stdout.write("Neither account exists. Creating SAIF...")
                if not password:
                    self.stdout.write(self.style.ERROR("Cannot create SAIF without password. Use --password YOUR_PASSWORD"))
                    return
                saif_upper = User.objects.create_user(
                    username="SAIF",
                    password=password,
                    email=OWNER_EMAIL,
                    is_staff=True,
                    is_superuser=True,
                )
                UserProfile.objects.get_or_create(
                    user=saif_upper,
                    defaults={"role": UserRole.OWNER},
                )
                profile = saif_upper.profile
                profile.role = UserRole.OWNER
                profile.save()
                self.stdout.write(self.style.SUCCESS(f"Created SAIF (id={saif_upper.id})"))

        # Final safeguard: ensure SAIF cannot be created with lowercase elsewhere
        self.stdout.write(self.style.SUCCESS("Done. SAIF is now the sole Super Admin."))
        self.stdout.write(self.style.WARNING("If saif (lowercase) was deleted: any open sessions were cleared. Re-login with SAIF (uppercase)."))
