#!/usr/bin/env python3
"""
Restore auth & network config from config_backup/ if connection fails.
Run from project root: python restore_config.py
"""
import os
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKUP = os.path.join(ROOT, "config_backup")


def restore_env():
    """Restore frontend .env with verified VITE_API_BASE."""
    src = os.path.join(BACKUP, "env_api.txt")
    dst = os.path.join(ROOT, "frontend", ".env")
    if not os.path.exists(src):
        print("Backup env_api.txt not found.")
        return False
    with open(src, encoding="utf-8") as f:
        content = f.read().strip()
    # Ensure proper format
    if "VITE_API_BASE=" not in content:
        content = f"VITE_API_BASE={content}\n"
    with open(dst, "w", encoding="utf-8") as f:
        f.write(content)
    print("Restored frontend/.env")
    return True


def main():
    print("Restoring config from config_backup/...")
    restore_env()
    print("\nDone. Restart frontend (npm run dev) and backend (run_smart.py).")
    print("For Django settings, manually verify backend/config/settings.py")
    print("  has 172.23.135.143 in ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS.")


if __name__ == "__main__":
    main()
