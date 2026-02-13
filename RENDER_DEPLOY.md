# Render Deployment – Smart Operations Hub

## Quick Start (24/7 Hosting)

1. **Push to GitHub** – Ensure your repo is on GitHub.
2. **Connect to Render** – Go to [render.com](https://render.com) → New → Blueprint.
3. **Select Repo** – Connect your GitHub repo. Render will detect `render.yaml`.
4. **Configure Env Vars** (in Render dashboard):
   - `DJANGO_ALLOWED_HOSTS`: `smart-ops-hub-api.onrender.com` (or your custom domain)
   - `FRONTEND_ORIGINS`: `https://smart-ops-hub-frontend.onrender.com` (or your frontend URL)
   - `VITE_API_BASE` (frontend): `https://smart-ops-hub-api.onrender.com/api`
5. **Deploy** – Render builds and deploys both services and the database.

## Services

| Service          | Type     | URL                            |
|------------------|----------|--------------------------------|
| API (Django)     | Web      | `https://smart-ops-hub-api.onrender.com` |
| Frontend (React) | Static   | `https://smart-ops-hub-frontend.onrender.com` |
| Database         | PostgreSQL | (internal)                  |

## After Deploy

1. **Create owner user** (in Render Shell for API service):
   ```bash
   python manage.py create_owner saif 123
   ```
2. **Open frontend URL** and log in with `saif` / `123`.

## Docker (Optional)

To run backend via Docker locally:
```bash
cd backend
docker build -t smart-ops-api .
docker run -p 8000:8000 -e DATABASE_URL=... smart-ops-api
```
