# Smart Operations Hub

Cloud ERP (SaaS) for multi-brand F&B operations in KSA, designed to integrate with Foodics API v5.

## Repo structure

- `backend/`: Django + DRF (PostgreSQL schema, shift reconciliation, inventory BOM engine)
- `frontend/`: React + Tailwind (Owner Dashboard + Shift Closing UI, RTL/Arabic supported)

## Cloud Agent environment setup

For a fresh cloud agent machine, run one command from repo root:

```bash
./setup_cloud_agent_env.sh
```

This script will:

- install backend Python dependencies from `backend/requirements.txt`
- install frontend dependencies via `npm ci` in `frontend/`
- verify backend with `python3 manage.py check`
- verify frontend with `npm run build`

## Backend (Django)

### Environment

Create a `.env` (or set env vars) for Postgres:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG` (default `true`)
- `DJANGO_ALLOWED_HOSTS` (default `localhost,127.0.0.1`)
- `DB_ENGINE` (default `django.db.backends.postgresql`)
- `DB_NAME` (default `smart_ops_hub`)
- `DB_USER` (default `postgres`)
- `DB_PASSWORD` (default `postgres`)
- `DB_HOST` (default `localhost`)
- `DB_PORT` (default `5432`)
- `FRONTEND_ORIGINS` (default `http://localhost:5173`)

### Run

```bash
cd backend
python3 -m pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py create_owner SAIF 123   # Create/refresh SAIF owner user with password 123
python3 manage.py runserver 0.0.0.0:8000 --noreload
```

**If login shows "Cannot connect to server"**: Start the backend first (`python manage.py runserver` in `backend/`).

API:

- `GET /api/dashboard/summary/`
- `POST /api/shifts/closing/`
- `GET /api/org/brands/` / `cities/` / `branches/`

## Frontend (React)

```bash
cd frontend
npm i
npm run dev
```

Set backend URL (optional):

- `VITE_API_BASE=http://localhost:8000/api`

