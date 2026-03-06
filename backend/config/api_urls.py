from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from core.health_views import HealthCheckView
from analytics.executive_summary_views import ExecutiveSummaryView

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("executive-summary/", ExecutiveSummaryView.as_view(), name="api-executive-summary"),
    path("auth/", include("core.urls")),
    path("system/", include("core.system_urls")),
    path("dashboard/", include("analytics.urls")),
    path("reports/", include("analytics.report_urls")),
    path("shifts/", include("shifts.urls")),
    path("org/", include("org.urls")),
    path("imports/", include("imports.urls")),
    path("inventory/", include("inventory.urls")),
    path("accounting/", include("accounting.urls")),
    path("financials/", include("financials.urls")),
    path("procurement/", include("procurement.urls")),
    path("supplier-portal/", include("procurement.supplier_portal_urls")),
    path("zatca/", include("zatca.urls")),
    path("payments/", include("payments.urls")),
    path("hr/", include("hr.urls")),
    path("assets/", include("assets.urls")),
    path("pos/", include("pos.urls")),
    path("bi/", include("bi.urls")),
    path("notifications/", include("notifications.urls")),
    path("customizer/", include("customizer.urls")),
    # Test Dashboard – superuser only
    path("test-dashboard/", include("core.test_dashboard_urls")),
    # Onboarding – public signup + tenant info
    path("onboarding/", include("onboarding.urls")),
    # Open API - للتكامل مع بوابات الدفع، التوصيل، الضرائب
    path("openapi/schema/", SpectacularAPIView.as_view(), name="openapi_schema"),
    path("openapi/swagger/", SpectacularSwaggerView.as_view(url_name="openapi_schema"), name="swagger_ui"),
    path("openapi/redoc/", SpectacularRedocView.as_view(url_name="openapi_schema"), name="redoc"),
]

