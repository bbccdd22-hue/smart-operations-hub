from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path("auth/", include("core.urls")),
    path("system/", include("core.system_urls")),
    path("dashboard/", include("analytics.urls")),
    path("shifts/", include("shifts.urls")),
    path("org/", include("org.urls")),
    path("imports/", include("imports.urls")),
    path("inventory/", include("inventory.urls")),
    path("accounting/", include("accounting.urls")),
    path("financials/", include("financials.urls")),
    path("procurement/", include("procurement.urls")),
    path("hr/", include("hr.urls")),
    path("assets/", include("assets.urls")),
    path("pos/", include("pos.urls")),
    path("bi/", include("bi.urls")),
    path("notifications/", include("notifications.urls")),
    # Open API - للتكامل مع بوابات الدفع، التوصيل، الضرائب
    path("openapi/schema/", SpectacularAPIView.as_view(), name="openapi_schema"),
    path("openapi/swagger/", SpectacularSwaggerView.as_view(url_name="openapi_schema"), name="swagger_ui"),
    path("openapi/redoc/", SpectacularRedocView.as_view(url_name="openapi_schema"), name="redoc"),
]

