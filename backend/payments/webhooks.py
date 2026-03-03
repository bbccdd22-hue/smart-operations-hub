"""
Stripe Webhooks — تحديث اشتراكات العملاء عند الدفع الناجح.
"""
import os

import stripe
from django.conf import settings

stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", "") or os.getenv("STRIPE_SECRET_KEY", "")
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """
    Webhook endpoint لـ Stripe.
    STRIPE_WEBHOOK_SECRET مطلوب في env.
    """
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
    webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", None) or os.getenv("STRIPE_WEBHOOK_SECRET", "")

    if not webhook_secret:
        return HttpResponse("Webhook secret not configured", status=500)

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
        return HttpResponse(status=400)

    if event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        subscription_id = invoice.get("subscription")
        customer_id = invoice.get("customer")
        if subscription_id and customer_id:
            try:
                _activate_tenant_subscription(customer_id, subscription_id)
            except Exception:
                pass  # Log in production

    return HttpResponse(status=200)


def _activate_tenant_subscription(customer_id: str, subscription_id: str):
    """تفعيل اشتراك الـ Tenant بعد الدفع الناجح."""
    from .models import TenantSubscription
    from org.models import TenantPlan

    sub = TenantSubscription.objects.filter(stripe_customer_id=customer_id).first()
    if not sub:
        return
    sub.stripe_subscription_id = subscription_id
    sub.is_active = True
    # Map Stripe price/plan to our plan
    try:
        stripe_sub = stripe.Subscription.retrieve(subscription_id)
        items = getattr(stripe_sub, "items", None) or stripe_sub.get("items", {})
        data = getattr(items, "data", None) or items.get("data", [])
        if data:
            price = data[0].get("price", {}) or getattr(data[0], "price", {})
            price_id = str(getattr(price, "id", None) or price.get("id", ""))
            for k in ("starter", "pro", "enterprise"):
                if k in price_id.lower():
                    sub.plan = k
                    break
        ts = getattr(stripe_sub, "current_period_end", None) or stripe_sub.get("current_period_end")
        if ts:
            from datetime import datetime
            sub.current_period_end = datetime.fromtimestamp(ts)
    except Exception:
        sub.plan = "pro"
    sub.save()
    # Update Tenant plan
    sub.tenant.plan = TenantPlan.PRO if sub.plan == "pro" else (
        TenantPlan.STARTER if sub.plan == "starter" else TenantPlan.ENTERPRISE
    )
    sub.tenant.max_branches = {"starter": 1, "pro": 5, "enterprise": 999}.get(sub.plan, 5)
    sub.tenant.save(update_fields=["plan", "max_branches"])
