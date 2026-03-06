"""
Stripe Billing - SaaS subscriptions.
Starter: 500 SAR | Pro: 1500 SAR | Enterprise: 4000 SAR
"""
from django.db import models

from org.models import Tenant


class TenantSubscription(models.Model):
    PLAN_CHOICES = [
        ("trial", "Trial"),
        ("starter", "Starter - 500 SAR/month (1 branch)"),
        ("pro", "Pro - 1500 SAR/month (5 branches)"),
        ("enterprise", "Enterprise - 4000 SAR/month (unlimited)"),
    ]

    tenant = models.OneToOneField(
        Tenant,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    stripe_customer_id = models.CharField(max_length=100, blank=True, db_index=True)
    stripe_subscription_id = models.CharField(max_length=100, blank=True, db_index=True)
    plan = models.CharField(
        max_length=20,
        choices=PLAN_CHOICES,
        default="trial",
        db_index=True,
    )
    current_period_end = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tenant Subscription"

    def __str__(self):
        return f"{self.tenant.name} - {self.get_plan_display()}"
