# Smart Operations Hub

Cloud ERP (SaaS) for multi-brand F&B operations. Two-service monorepo: Django backend + React/Vite frontend.

## Cursor Cloud specific instructions

### Services

| Service | Port | Run Command |
|---------|------|-------------|
| Backend (Django) | 8000 | `cd backend && python3 manage.py runserver 0.0.0.0:8000 --noreload` |
| Frontend (Vite) | 5173 | `cd frontend && npm run dev` |

### Key gotchas

- Use `python3` (not `python`) — `python` is not on PATH in this environment.
- The database is SQLite by default (no external DB needed). Migrations and seed data must be run before first use:
  ```
  cd backend && python3 manage.py migrate && python3 manage.py create_owner SAIF 123
  ```
- Login credentials: username `SAIF` (uppercase), password `123`.
- The Vite dev server proxies `/api` and `/media` to the Django backend at `http://127.0.0.1:8000`, so start the backend first.
- The frontend has pre-existing TypeScript errors (`tsc -b` will fail). `vite build` succeeds despite this — Vite does not type-check at build time.
- There is no ESLint config and no automated test suite (0 tests). Django system check (`python3 manage.py check`) is the backend lint equivalent.
- No `.env` file is required for local development — sensible defaults are built into `backend/config/settings.py`.
- Standard dev commands are documented in the root `README.md`.
