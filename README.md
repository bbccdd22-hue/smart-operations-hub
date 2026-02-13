# Smart Operations Hub

Cloud ERP (SaaS) for multi-brand F&B operations in KSA, designed to integrate with Foodics API v5.

## Repo structure

- `backend/`: Django + DRF (PostgreSQL schema, shift reconciliation, inventory BOM engine)
- `frontend/`: React + Tailwind (Owner Dashboard + Shift Closing UI, RTL/Arabic supported)

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
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py create_owner saif 123    # Create SAIF user (owner) with password 123
python manage.py runserver                # Starts API on http://localhost:8000
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

