# Restore Point – Feb 13, 2026 (Pre-sleep)

## Contents

- Full source code (backend, frontend)
- frontend/.env (VITE_API_BASE=http://192.168.195.113:8000/api)
- backend/config/settings.py (ALLOWED_HOSTS=['*'], FRONTEND_ORIGINS with 5173/5174)
- backend/db.sqlite3
- mobile_setup_status.txt

## Restore Steps

1. Copy `source/` contents over project root (or replace entire project).
2. Ensure `frontend/.env` has `VITE_API_BASE=http://192.168.195.113:8000/api`.
3. Run backend: `cd backend && run_server.bat`
4. Run frontend: `cd frontend && npm run dev`

## Next Session Priority

**Mobile connection still failing** – troubleshoot why phone cannot connect despite:
- Firewall rules (5173, 8000)
- Host binding (0.0.0.0)
- Private network
- CORS/CSRF configured

Consider: Router AP isolation, VPN interference, router firewall, mobile browser, CORS preflight, CSRF cookie domain.
