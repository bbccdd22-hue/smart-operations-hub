# Render Deployment Steps — Smart Operations Hub

**Date:** February 11, 2026  
**Purpose:** Exact buttons and steps for tomorrow's deployment from the Render dashboard.

---

## Prerequisites (Do Tonight)

- [ ] Code pushed to GitHub (e.g., `github.com/YOUR_USERNAME/smart-operations-hub`)
- [ ] Render account created at [render.com](https://render.com)

---

## Option A: Blueprint Deploy (Recommended — One-Click)

Render will read `render.yaml` and create all services and the database automatically.

### Step 1: Start Blueprint

1. On the **Render Dashboard**, find the **"New +"** button (top right).
2. Click **"New +"**.
3. From the dropdown, select **"Blueprint"**.

### Step 2: Connect Repository

1. Click **"Connect a repository"** (or "Connect account" if first time).
2. Choose **GitHub** and authorize Render.
3. Select your repository: **smart-operations-hub**.
4. Render will detect `render.yaml` automatically.
5. Click **"Apply"** or **"Deploy"**.

### Step 3: Review & Deploy

1. Render will show a preview: **3 services** (API, Frontend, DB) + **1 database**.
2. Confirm and click **"Apply"** or **"Create Blueprint"**.
3. Wait for initial build (API + DB first, then Frontend).

---

## Option B: Manual Deploy (If Blueprint Fails)

### Step 1: Create PostgreSQL Database

1. **New +** → **PostgreSQL**.
2. Name: `smart-ops-hub-db`.
3. Region: **Oregon (US West)**.
4. Plan: **Free**.
5. Click **"Create Database"**.
6. Copy the **Internal Database URL** (you'll need it for the API).

### Step 2: Create Web Service (Backend API)

1. **New +** → **Web Service**.
2. Connect your **smart-operations-hub** GitHub repo.
3. **Name:** `smart-ops-hub-api`.
4. **Region:** Oregon.
5. **Root Directory:** `backend`.
6. **Runtime:** Python.
7. **Build Command:**  
   `pip install -r requirements.txt && python manage.py migrate --noinput && python manage.py seed_brands && python manage.py collectstatic --noinput --clear`
8. **Start Command:**  
   `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
9. Plan: **Free**.

#### Environment Variables (Backend):

| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.11` |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | *(Click "Generate" or use a secure random string)* |
| `DJANGO_ALLOWED_HOSTS` | `smart-ops-hub-api.onrender.com` |
| `DATABASE_URL` | *(From PostgreSQL → Internal Database URL)* |
| `FRONTEND_ORIGINS` | `https://smart-ops-hub-frontend.onrender.com` |

10. Click **"Create Web Service"**.

### Step 3: Create Static Site (Frontend)

1. **New +** → **Static Site**.
2. Connect the same **smart-operations-hub** repo.
3. **Name:** `smart-ops-hub-frontend`.
4. **Root Directory:** `frontend`.
5. **Build Command:** `npm ci && npm run build`
6. **Publish Directory:** `dist`.
7. Plan: **Free**.

#### Environment Variable (Frontend):

| Key | Value |
|-----|-------|
| `VITE_API_BASE` | `https://smart-ops-hub-api.onrender.com/api` |

*(Replace with your actual API URL if different.)*

8. Add **Rewrite Rule:**  
   - **Source:** `/*`  
   - **Destination:** `/index.html`  

9. Click **"Create Static Site"**.

---

## Step 4: Set Environment Variables (Blueprint Deploy)

If you used Blueprint, you still need to set values for keys marked `sync: false`:

1. Go to **Dashboard** → click **smart-ops-hub-api**.
2. **Environment** tab → **Add Environment Variable**.
3. Set:
   - `DJANGO_ALLOWED_HOSTS` = `smart-ops-hub-api.onrender.com`
   - `FRONTEND_ORIGINS` = `https://smart-ops-hub-frontend.onrender.com`
4. Go to **smart-ops-hub-frontend** → **Environment**.
5. Set:
   - `VITE_API_BASE` = `https://smart-ops-hub-api.onrender.com/api`
6. Click **Save Changes** (Render will redeploy automatically).

---

## Step 5: Verify Deployment

1. **API:** Open `https://smart-ops-hub-api.onrender.com/api/dashboard/system-health/`  
   - Should return JSON with system health.
2. **Frontend:** Open `https://smart-ops-hub-frontend.onrender.com`  
   - Login page should load with iOS Glassmorphism theme.
3. **Brand dropdown:** Log in, go to Dashboard → Brand filter should show all 6 brands (8OZ, TEA PLUS, SWEET BREAD, HEMI, CHART, BLANCA).
4. **Net Sales:** Upload Excel and confirm صافي المبيعات / Net Sales displays correctly (e.g., 981,459.30 SAR).

---

## Dashboard Reference (Buttons)

| Button / Element | Location | Action |
|------------------|----------|--------|
| **New +** | Top right of Dashboard | Opens deploy options |
| **Blueprint** | Under New + | Deploy from render.yaml |
| **Web Service** | Under New + | Backend API |
| **Static Site** | Under New + | React frontend |
| **PostgreSQL** | Under New + | Database |
| **Environment** | Inside each service | Set env vars |
| **Manual Deploy** | Inside service | Trigger rebuild |

---

## Render Free Database (90-Day Limit)

Render's free PostgreSQL expires after 90 days. Options when it expires:
- Upgrade to paid Postgres on Render
- Export data and migrate to another provider (Supabase, Neon, etc.)
- Re-create DB and restore from `backups/8OZ_january_2026_backup.json`

---

## Troubleshooting

- **CORS errors:** Ensure `FRONTEND_ORIGINS` matches your frontend URL exactly (no trailing slash).
- **API 404:** Confirm `VITE_API_BASE` ends with `/api`.
- **Build fails:** Check build logs; ensure `rootDir` is `backend` or `frontend` as in render.yaml.

---

*Smart Operations Hub — Directed by SAIF*
