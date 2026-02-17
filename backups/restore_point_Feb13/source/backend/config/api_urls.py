from django.urls import include, path

urlpatterns = [
    path("auth/", include("core.urls")),
    path("dashboard/", include("analytics.urls")),
    path("shifts/", include("shifts.urls")),
    path("org/", include("org.urls")),
    path("imports/", include("imports.urls")),
    path("inventory/", include("inventory.urls")),
    path("accounting/", include("accounting.urls")),
]

