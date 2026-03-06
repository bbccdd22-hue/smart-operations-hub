"""
Django settings for Smart Operations Hub ERP.
See https://docs.djangoproject.com/en/6.0/topics/settings/ for details.
"""

import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

try:
    import dj_database_url
except ImportError:
    dj_database_url = None

BASE_DIR = Path(__file__).resolve().parent.parent


# ─── SECRET KEY ───────────────────────────────────────────────────────────────
# Must be set in environment. App refuses to start without it.
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY environment variable is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(50))\""
    )


# ─── DEBUG ────────────────────────────────────────────────────────────────────
# Defaults to False — must explicitly set DJANGO_DEBUG=true in local dev.
DEBUG = os.getenv("DJANGO_DEBUG", "false").lower() == "true"


# ─── ALLOWED HOSTS ────────────────────────────────────────────────────────────
# In production: set DJANGO_ALLOWED_HOSTS=yourapp.onrender.com,other.domain
# In dev: leave unset → falls back to localhost only. Never use '*' in production.
_raw_hosts = os.getenv("DJANGO_ALLOWED_HOSTS", "")
if _raw_hosts.strip():
    ALLOWED_HOSTS = [h.strip() for h in _raw_hosts.split(",") if h.strip()]
else:
    # Dev (no DJANGO_ALLOWED_HOSTS): allow any host للوصول عبر الشبكة المحلية
    ALLOWED_HOSTS = ["*"]


# ─── INSTALLED APPS ───────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    "django_otp",
    "django_otp.plugins.otp_totp",
    # Local apps
    "core",
    "org",
    "shifts",
    "inventory",
    "imports",
    "analytics",
    "foodics",
    "accounting",
    "financials",
    "procurement",
    "hr",
    "assets",
    "pos",
    "crm",
    "central_kitchen",
    "quality",
    "bi",
    "currencies",
    "notifications",
    "onboarding",
    "zatca",
    "payments",
    "customizer",
]


# ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
# Order matters:
#   1. CorsMiddleware must be first (before any response-generating middleware).
#   2. SecurityMiddleware must be second (HSTS, SSL redirect, etc.).
#   3. WhiteNoise serves static files as early as possible.
#   4. Tenant/context middleware goes last (needs auth middleware before it).
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.tenant_middleware.RequestContextMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# ─── DATABASE ─────────────────────────────────────────────────────────────────
# Local (no DATABASE_URL): SQLite.
# Production (Render): PostgreSQL via DATABASE_URL.
# Set USE_SQLITE=1 to force SQLite even when DATABASE_URL exists.
DATABASES = {}
_use_sqlite = os.getenv("USE_SQLITE", "").lower() in ("1", "true", "yes")
_database_url = os.getenv("DATABASE_URL")
_has_postgres = _database_url and dj_database_url

if _use_sqlite or not _has_postgres:
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
else:
    db_config = dj_database_url.config(
        conn_max_age=600,
        ssl_require=True,
    )
    db_config["CONN_HEALTH_CHECKS"] = True
    DATABASES["default"] = db_config


# ─── PASSWORD VALIDATION ──────────────────────────────────────────────────────
# Minimum 8 chars + no purely numeric passwords.
# Note: existing users with weak passwords can still log in; this only validates new ones.
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# ─── INTERNATIONALISATION ─────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "Asia/Riyadh")
USE_I18N = True
USE_TZ = True

LANGUAGES = [
    ("en", "English"),
    ("ar", "Arabic"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]


# ─── STATIC & MEDIA ───────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ─── CORS ─────────────────────────────────────────────────────────────────────
# Dev: allow all origins for convenience.
# Production: only origins listed in FRONTEND_ORIGINS env var.
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    _cors_origins = os.getenv("FRONTEND_ORIGINS", "")
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(",") if o.strip()]

CORS_ALLOW_CREDENTIALS = True
# Allow frontend custom header so preflight succeeds (لوحة المالك / executive dashboard)
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "accept-language",
    "authorization",
    "content-type",
    "origin",
    "x-csrftoken",
    "x-requested-with",
    "x-network-id",
]

# Dev convenience: keep local origins as fallback even in debug=true
CORS_ALLOWED_ORIGINS_DEV = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://172.23.135.143:5173",
    "http://172.23.135.143:8000",
    "http://10.219.168.113:5173",
    "http://10.219.168.113:8000",
]
if DEBUG and not CORS_ALLOW_ALL_ORIGINS:
    CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS_DEV


# ─── CSRF ─────────────────────────────────────────────────────────────────────
def _get_csrf_origins():
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://172.23.135.143:5173",
        "http://172.23.135.143:8000",
        "http://10.219.168.113:5173",
        "http://10.219.168.113:8000",
        "http://192.168.1.35:5173",
        "http://192.168.1.35:8000",
        "http://192.168.195.113:5173",
        "http://192.168.195.113:8000",
        "http://192.168.1.14:5173",
        "http://192.168.1.14:8000",
        "http://26.74.176.122:5173",
        "http://26.74.176.122:8000",
    ]
    # Add FRONTEND_ORIGINS from env (production HTTPS origins)
    _env_origins = os.getenv("FRONTEND_ORIGINS", "")
    for o in _env_origins.split(","):
        o = o.strip()
        if o:
            origins.append(o)
    # Auto-detect local host IP
    try:
        import socket
        host_ip = socket.gethostbyname(socket.gethostname())
        if host_ip and host_ip not in ("127.0.0.1", "127.0.0.0"):
            for port in (5173, 8000):
                origins.append(f"http://{host_ip}:{port}")
    except Exception:
        pass
    seen = set()
    return [o for o in origins if o not in seen and not seen.add(o)]

CSRF_TRUSTED_ORIGINS = _get_csrf_origins()


# ─── SESSIONS ─────────────────────────────────────────────────────────────────
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30   # 30 days (branch devices stay logged in)
SESSION_SAVE_EVERY_REQUEST = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
# Dev: no domain so cookie works for both localhost and 127.0.0.1 (Vite proxy)
if DEBUG:
    SESSION_COOKIE_DOMAIN = None


# ─── REST FRAMEWORK ───────────────────────────────────────────────────────────
# BasicAuthentication removed: it sends credentials base64-encoded (not encrypted).
# If BasicAuth is needed for a specific endpoint, add it per-view.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
    },
}


# ─── PRODUCTION SECURITY HARDENING ───────────────────────────────────────────
# These settings only activate when DEBUG=False (i.e. in production).
if not DEBUG:
    SESSION_COOKIE_SECURE = True        # Session cookie only over HTTPS
    CSRF_COOKIE_SECURE = True           # CSRF cookie only over HTTPS
    SECURE_SSL_REDIRECT = True          # Redirect HTTP → HTTPS
    SECURE_HSTS_SECONDS = 31536000      # 1 year HSTS
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True          # Allow submission to browser preload list
    SECURE_CONTENT_TYPE_NOSNIFF = True  # Prevent MIME sniffing
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = "DENY"


# ─── OPEN API (drf-spectacular) ───────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "Smart Operations Hub API",
    "DESCRIPTION": (
        "Enterprise ERP API - التوثيق التلقائي لجميع الـ APIs. "
        "جاهز للربط مع أنظمة خارجية، بوابات الدفع، التوصيل، الضرائب، وتطبيقات الموبايل."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "TAGS": [
        {"name": "auth",          "description": "تسجيل الدخول والمستخدم الحالي"},
        {"name": "org",           "description": "المنظمة، الفروع، العلامات، المستخدمون، الأدوار والصلاحيات"},
        {"name": "shifts",        "description": "الورديات وإقفال الشفتات"},
        {"name": "inventory",     "description": "المخزون، المنتجات، التكاليف والربح"},
        {"name": "financials",    "description": "الملخص المالي والتقارير"},
        {"name": "notifications", "description": "محرك التنبيهات وقواعد الإرسال"},
    ],
}


# ─── MULTI-TENANT SAAS CONFIGURATION ─────────────────────────────────────────
# Base domain used to extract tenant slugs from subdomains.
# In production: "smartops.com"  → acme.smartops.com resolves to tenant "acme"
# In dev:        "localhost"     → acme.localhost resolves to tenant "acme"
SMARTOPS_BASE_DOMAIN = os.getenv("SMARTOPS_BASE_DOMAIN", "smartops.com")


# ─── POS REAL-TIME DEPLETION FEATURE FLAG ────────────────────────────────────
# When True, saving a POS SaleTransaction triggers inventory depletion immediately.
# Enable per-branch via Branch.pos_depletion_enabled.
# When False (default), only Excel-based uploads drive depletion (legacy path).
# Toggle in deployment: POS_REALTIME_DEPLETION_ENABLED=true
POS_REALTIME_DEPLETION_ENABLED = os.getenv("POS_REALTIME_DEPLETION_ENABLED", "false").lower() == "true"


# ─── NET SALES OVERRIDE (optional) ───────────────────────────────────────────
# Set NET_SALES_OVERRIDE=981459 in env to force-display a verified net sales figure.
# Remove this env var when Foodics sync is confirmed correct.
NET_SALES_OVERRIDE = None
_raw = os.getenv("NET_SALES_OVERRIDE", "").strip()
if _raw and _raw.replace(",", "").replace(".", "").isdigit():
    try:
        NET_SALES_OVERRIDE = float(_raw.replace(",", ""))
    except ValueError:
        pass


# ─── REDIS CACHE (Production) ────────────────────────────────────────────────────
# Local: REDIS_URL unset → use LocMemCache (no Redis required).
# Production: REDIS_URL=redis://localhost:6379/1 or Render Redis URL.
REDIS_URL = os.getenv("REDIS_URL", "").strip()
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "SOCKET_CONNECT_TIMEOUT": 5,
                "IGNORE_EXCEPTIONS": True,
                "CONNECTION_POOL_KWARGS": {"max_connections": 20},
            },
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "smartops-default",
        }
    }


# ─── CELERY (Background Jobs) ────────────────────────────────────────────────────
# Broker = Redis. When REDIS_URL unset, Celery runs in-memory (dev) or fails (prod).
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL") or REDIS_URL or "memory://"
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND") or CELERY_BROKER_URL
# Optional: route tasks to queues — workers need: celery -A config worker -Q default,reports
# CELERY_TASK_ROUTES = {"accounting.tasks.*": {"queue": "reports"}}
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = os.getenv("DJANGO_TIME_ZONE", "Asia/Riyadh")
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "false").lower() == "true"
# Beat schedule defined in config/celery.py

# Stripe Billing — Starter 500 SAR | Pro 1500 SAR | Enterprise 4000 SAR
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
# STRIPE_PRICES: JSON map or env vars — starter_monthly:price_xxx, pro_monthly:price_yyy
_stripe_prices = os.getenv("STRIPE_PRICES", "").strip()
STRIPE_PRICES = {}
if _stripe_prices:
    import json
    try:
        STRIPE_PRICES = json.loads(_stripe_prices)
    except json.JSONDecodeError:
        for pair in _stripe_prices.split(","):
            if ":" in pair:
                k, v = pair.strip().split(":", 1)
                STRIPE_PRICES[k.strip()] = v.strip()
