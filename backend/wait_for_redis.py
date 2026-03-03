#!/usr/bin/env python
"""Wait for Redis to be ready before starting the app."""
import os
import sys
import time

def main():
    redis_url = os.getenv("REDIS_URL", "").strip()
    if not redis_url:
        print("✓ No REDIS_URL — skipping Redis check (using LocMem)")
        return 0

    max_attempts = 15
    for i in range(max_attempts):
        try:
            import redis
            r = redis.from_url(redis_url)
            r.ping()
            print("✓ Redis ready")
            return 0
        except Exception as e:
            if i == max_attempts - 1:
                print(f"✗ Redis not ready after {max_attempts} attempts: {e}")
                return 1
            print(f"  Waiting for Redis... ({i + 1}/{max_attempts})")
            time.sleep(2)
    return 1


if __name__ == "__main__":
    sys.exit(main())
