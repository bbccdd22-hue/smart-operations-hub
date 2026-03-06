# Production Deploy — Render

## render.yaml (جذر المشروع)

المشروع يحتوي على `render.yaml` جاهز للنشر على Render.

## متغيرات البيئة (Render Dashboard)

### أساسية
| المتغير | القيمة | ملاحظات |
|---------|-------|---------|
| `DJANGO_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(64))"` | مولد تلقائي من envVarGroups |
| `DJANGO_DEBUG` | `false` | |
| `DJANGO_ALLOWED_HOSTS` | `yourapp.onrender.com,*.onrender.com` | |
| `SMARTOPS_BASE_DOMAIN` | `smartops.com` | |
| `FRONTEND_ORIGINS` | `https://smartops-frontend.onrender.com` | حسب رابط الفرونت |
| `VITE_API_BASE` | `https://smartops-backend.onrender.com/api` | للفرونت |

### Stripe
| المتغير | القيمة |
|---------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` أو `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` أو `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_PRICES` | `{"starter_monthly":"price_xxx","pro_monthly":"price_yyy","enterprise_monthly":"price_zzz"}` |

### Stripe Webhook
- **URL:** `https://smartops-backend.onrender.com/api/payments/stripe/webhook/`
- **Events:** `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`

## أوامر التحقق بعد النشر

```bash
# Health check
curl https://smartops-backend.onrender.com/api/health/

# Demo signup
curl -X POST https://smartops-backend.onrender.com/api/onboarding/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Demo Coffee الرياض",
    "tenant_slug": "demo-riyadh",
    "brand_name": "قهوة الرياض",
    "admin_username": "demo",
    "admin_email": "demo@coffee.com",
    "admin_password": "DemoPass123!",
    "plan": "trial"
  }'
```

## الخدمات (5)

1. **smartops-backend** — Django + Gunicorn
2. **celery-worker** — مهام خلفية
3. **celery-beat** — جدولة (نسخ احتياطي، مطابقة، تنبيهات)
4. **smartops-frontend** — Static (Vite build)
5. **smartops-redis** — Cache + Celery broker
