# Production Hardening — المرحلة 1 (أسبوع 9-10)

## المكونات المنفذة

### 1. PostgreSQL + Connection Pooling
- `DATABASE_URL` من env (Render: fromDatabase)
- `conn_max_age=600` لاتصالات مستمرة

### 2. Redis Cache
- **Local:** `REDIS_URL` غير مضبوط → LocMemCache (بدون Redis)
- **Production:** `REDIS_URL=redis://...` → django-redis

### 3. Celery (مهام خلفية)
- **Broker/Backend:** Redis أو `memory://` للتطوير
- **المهام المجدولة:**
  - `daily_backup_task` — 2 صباحاً (نسخ احتياطي + media)
  - `run_daily_reconciliation_task` — 3 صباحاً (مطابقة يومية)

### 4. التشغيل المحلي (بدون Redis)

```bash
cd backend
set DJANGO_SECRET_KEY=your-secret
set DJANGO_DEBUG=true
python manage.py runserver
```

Celery يعمل مع `memory://` عند عدم وجود REDIS_URL.

### 5. التشغيل مع Redis + Celery

**Terminal 1 — Redis (إن وُجد):**
```bash
redis-server
```

**Terminal 2 — Django:**
```bash
set REDIS_URL=redis://localhost:6379/1
set DJANGO_SECRET_KEY=your-secret
python manage.py runserver
```

**Terminal 3 — Celery worker + beat:**
```bash
set REDIS_URL=redis://localhost:6379/1
set DJANGO_SECRET_KEY=your-secret
celery -A config worker --beat -l info
```

### 6. Deploy على Render

- `render.yaml` جاهز مع:
  - Web (API)
  - Worker (Celery + Beat)
  - Redis (Key Value)
  - PostgreSQL

**Env Vars في Dashboard:**
- `DJANGO_ALLOWED_HOSTS` — your-app.onrender.com
- `FRONTEND_ORIGINS` — https://your-frontend.onrender.com
- `VITE_API_BASE` — https://smart-ops-hub-api.onrender.com/api

### 7. اختبار المهام يدوياً

```bash
# تشغيل المهام بشكل متزامن (بدون Redis)
set CELERY_TASK_ALWAYS_EAGER=true
python manage.py shell
>>> from core.tasks import daily_backup_task
>>> daily_backup_task.delay()
```
