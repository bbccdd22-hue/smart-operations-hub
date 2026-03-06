from django.urls import path

from . import webhooks

urlpatterns = [
    path("stripe/webhook/", webhooks.stripe_webhook),
]
