#!/usr/bin/env python
"""Wait for PostgreSQL to be ready before starting the app."""
import os
import sys
import time

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

def main():
    import django
    django.setup()
    from django.db import connection
    from django.db.utils import OperationalError

    max_attempts = 30
    for i in range(max_attempts):
        try:
            connection.ensure_connection()
            print("✓ Database ready")
            return 0
        except OperationalError as e:
            if i == max_attempts - 1:
                print(f"✗ Database not ready after {max_attempts} attempts: {e}")
                return 1
            print(f"  Waiting for database... ({i + 1}/{max_attempts})")
            time.sleep(2)
    return 1


if __name__ == "__main__":
    sys.exit(main())
