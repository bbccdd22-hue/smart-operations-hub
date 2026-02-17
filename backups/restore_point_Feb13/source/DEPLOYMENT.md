# Smart Operations Hub – Deployment Guide

## Overview
- **Backend**: Railway or Heroku (Django + Gunicorn)
- **Frontend**: Vercel (React + Vite)
- **Database**: PostgreSQL (provided by Railway/Heroku)

---

## 1. Backend: Railway

1. Create a [Railway](https://railway.app) project.
2. Add a **PostgreSQL** service (Railway provides `DATABASE_URL` automatically).
3. Deploy from the `backend/` directory (or connect Git).

**Railway config:**
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn config.wsgi --log-file -`
- Add env vars:
  - `DJANGO_SECRET_KEY` – random secret
  - `DJANGO_DEBUG` – `false`
  - `DJANGO_ALLOWED_HOSTS` – `your-app.railway.app`
  - `FRONTEND_ORIGINS` – `https://your-frontend.vercel.app`
  - `DATABASE_URL` – set automatically by Railway PostgreSQL

4. Run migrations:
   ```bash
   railway run python manage.py migrate
   railway run python manage.py seed_brands
   railway run python manage.py createsuperuser
   ```

---

## 2. Backend: Heroku

1. Create app: `heroku create smart-ops-hub`
2. Add PostgreSQL: `heroku addons:create heroku-postgresql:mini`
3. Set env:
   ```bash
   heroku config:set DJANGO_SECRET_KEY=your-secret
   heroku config:set DJANGO_DEBUG=false
   heroku config:set DJANGO_ALLOWED_HOSTS=smart-ops-hub.herokuapp.com
   heroku config:set FRONTEND_ORIGINS=https://your-frontend.vercel.app
   ```
4. Deploy from `backend/`:
   ```bash
   cd backend
   heroku buildpacks:set heroku/python
   git subtree push --prefix backend heroku main
   # or: git push heroku main (if backend is root)
   ```
5. Migrate:
   ```bash
   heroku run python manage.py migrate
   heroku run python manage.py seed_brands
   heroku run python manage.py createsuperuser
   ```

---

## 3. Frontend: Vercel

1. Import the repo in [Vercel](https://vercel.com).
2. **Root directory**: `frontend`
3. **Build command**: `npm run build`
4. **Output directory**: `dist`
5. **Environment variables**:
   - `VITE_API_BASE` – `https://your-backend.railway.app/api` or `https://smart-ops-hub.herokuapp.com/api`

Vercel serves the SPA; `vercel.json` rewrites all routes to `index.html`.

---

## 4. Database: PostgreSQL (Production)

- **Railway / Heroku**: `DATABASE_URL` is set automatically.
- **Local**: Use SQLite with `DB_ENGINE=django.db.backends.sqlite3`, or run Postgres and set `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`.
- Migrations run on deploy (add `release` phase or run manually as above).

---

## 5. ETL (Excel Uploads)

- Excel files are **parsed once** and stored in DB models (`HourlySale`, `DailySale`, `ProductSale`).
- `ExcelUpload.status` is set to `PROCESSED` after success; duplicate parses are skipped.
- Dashboard, Forecast, and Shift Closing **read only from the database**—never from Excel files.
- `db_index=True` on `brand`, `branch`, and `date` for faster reporting.
