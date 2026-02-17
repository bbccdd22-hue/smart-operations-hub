#!/usr/bin/env python3
"""
Smart Operations Hub – Start Backend + Frontend (Final Version)
- Checks ports 8000 and 5173 are free before starting
- Binds to 0.0.0.0 for network access (Mobile/iPad)
"""
import os
import re
import socket
import subprocess
import sys
import time

HOST_IP = "10.219.168.113"  # ZeroTier IP – update when network changes
ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_PORT = 8000
FRONTEND_PORT = 5173


def is_port_free(port: int) -> bool:
    """Check if port is available for binding."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


def ensure_env():
    """Ensure frontend .env has VITE_API_BASE for production builds. Dev uses Vite proxy (/api)."""
    env_path = os.path.join(ROOT, "frontend", ".env")
    target = f"VITE_API_BASE=http://{HOST_IP}:{BACKEND_PORT}/api"
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            content = f.read()
        if "VITE_API_BASE=" in content:
            content = re.sub(r"VITE_API_BASE=.*", target, content)
        else:
            content = content.rstrip() + "\n" + target + "\n"
        with open(env_path, "w", encoding="utf-8") as f:
            f.write(content)
    else:
        with open(env_path, "w", encoding="utf-8") as f:
            f.write(f"# Set by run_smart.py\n{target}\n")


def main():
    ensure_env()

    if not is_port_free(BACKEND_PORT):
        print(f"[ERROR] Port {BACKEND_PORT} is already in use.")
        print("Stop the process using it (e.g. another Django server) and try again.")
        sys.exit(1)

    if not is_port_free(FRONTEND_PORT):
        print(f"[ERROR] Port {FRONTEND_PORT} is already in use.")
        print("Stop the process using it (e.g. another Vite server) and try again.")
        sys.exit(1)

    backend_cwd = os.path.join(ROOT, "backend")
    frontend_cwd = os.path.join(ROOT, "frontend")

    print("=" * 50)
    print("  Smart Operations Hub")
    print("=" * 50)
    print(f"\nBackend  : http://0.0.0.0:{BACKEND_PORT}  (bind: all interfaces)")
    print(f"Frontend : http://0.0.0.0:{FRONTEND_PORT}  (Vite proxy /api -> backend)")
    print(f"\nAccess from network: http://{HOST_IP}:{FRONTEND_PORT}")
    print("  (Login/cookies work: same-origin via proxy)")
    print("\nStarting servers...\n")

    backend = subprocess.Popen(
        [sys.executable, "manage.py", "runserver", f"0.0.0.0:{BACKEND_PORT}"],
        cwd=backend_cwd,
        stdout=sys.stdout,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )

    time.sleep(3)

    frontend = subprocess.Popen(
        ["npm", "run", "dev", "--", "--host"],
        cwd=frontend_cwd,
        shell=sys.platform == "win32",
        stdout=sys.stdout,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )

    try:
        backend.wait()
    except KeyboardInterrupt:
        pass
    finally:
        backend.terminate()
        frontend.terminate()


if __name__ == "__main__":
    main()
