"""
Automated backup of SQLite DB and media/archives.
- Compresses to .zip with date label (backup_YYYY_MM_DD.zip)
- Saves to local 'backups' folder + optional external path
- Keeps only last 30 days; deletes older backups
"""
import os
import shutil
import zipfile
from datetime import date, timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


def get_backup_sources(base_dir: Path) -> list[tuple[Path, str]]:
    """Return list of (absolute_path, archive_name) to include in backup."""
    sources = []
    db_path = base_dir / "db.sqlite3"
    if db_path.exists():
        sources.append((db_path, "db.sqlite3"))
    media = getattr(settings, "MEDIA_ROOT", None)
    if media:
        media = Path(media)
    else:
        media = base_dir / "media"
    for folder in ("excel_uploads", "foodics_archives"):
        d = media / folder
        if d.exists():
            for f in d.rglob("*"):
                if f.is_file():
                    try:
                        rel = f.relative_to(media)
                        arc = f"media/{rel}".replace("\\", "/")
                        sources.append((f, arc))
                    except ValueError:
                        sources.append((f, f"media/{f.name}"))
    return sources if sources else ([(db_path, "db.sqlite3")] if db_path.exists() else [])


def run_backup(local_dir: Path, external_dir: Path | None, retention_days: int) -> list[Path]:
    base_dir = Path(settings.BASE_DIR)
    today = date.today()
    zip_name = f"backup_{today.year}_{today.month:02d}_{today.day:02d}.zip"
    created = []

    for dest_parent in (local_dir, external_dir) if external_dir else (local_dir,):
        dest_parent = Path(dest_parent)
        dest_parent.mkdir(parents=True, exist_ok=True)
        zip_path = dest_parent / zip_name

        sources = get_backup_sources(base_dir)
        if not sources:
            continue

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for src, arcname in sources:
                if src.exists():
                    zf.write(src, arcname)
        created.append(zip_path)

        # Cleanup old backups in this destination
        cutoff = today - timedelta(days=retention_days)
        for old in dest_parent.glob("backup_*.zip"):
            try:
                parts = old.stem.replace("backup_", "").split("_")
                if len(parts) >= 3:
                    y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                    if date(y, m, d) < cutoff:
                        old.unlink()
            except (ValueError, OSError):
                pass

    return created


class Command(BaseCommand):
    help = "Backup db.sqlite3 and media archives to .zip; keep last 30 days."

    def add_arguments(self, parser):
        parser.add_argument(
            "--external",
            type=str,
            default=os.getenv("BACKUP_EXTERNAL_PATH"),
            help="External path (e.g. USB drive) for second copy",
        )
        parser.add_argument(
            "--local",
            type=str,
            default=None,
            help="Local backups folder (default: project/backups)",
        )
        parser.add_argument(
            "--retention",
            type=int,
            default=30,
            help="Days to keep backups (default: 30)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be backed up without creating files",
        )

    def handle(self, *args, **options):
        base = Path(settings.BASE_DIR)
        local_dir = Path(options["local"] or str(base / "backups"))
        external = options.get("external")
        external_dir = Path(external) if external else None
        retention = max(1, options["retention"])
        dry_run = options["dry_run"]

        sources = get_backup_sources(base)
        self.stdout.write(f"Sources: {[s[1] for s in sources]}")

        if dry_run:
            self.stdout.write(f"Would create: {local_dir / f'backup_{date.today():%Y_%m_%d}.zip'}")
            if external_dir:
                self.stdout.write(f"Would copy to: {external_dir}")
            self.stdout.write(self.style.SUCCESS("Dry run done."))
            return

        try:
            created = run_backup(local_dir, external_dir, retention)
            for p in created:
                self.stdout.write(self.style.SUCCESS(f"Created: {p}"))
            self.stdout.write(self.style.SUCCESS("Backup complete."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Backup failed: {e}"))
            raise
