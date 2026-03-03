from django.urls import path
from .views import SignupView, TenantDetailView, TenantListView

urlpatterns = [
    path("signup/",   SignupView.as_view(),       name="onboarding-signup"),
    path("tenant/",   TenantDetailView.as_view(), name="onboarding-tenant-detail"),
    path("tenants/",  TenantListView.as_view(),   name="onboarding-tenant-list"),
]
