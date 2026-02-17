# Config Backup – Auth & Network (Verified Working)

Restore these if connection fails (ERR_CONNECTION_REFUSED) after an update.

Run: `python restore_config.py` from project root.

## Files

- `settings_cors_allowed.txt` – Django ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS
- `env_api.txt` – Frontend VITE_API_BASE
- `api_base.txt` – Frontend api.ts API_BASE constant
