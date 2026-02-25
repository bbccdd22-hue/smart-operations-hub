from django.urls import path

from core import views
from core import two_factor_views

urlpatterns = [
    path("csrf/", views.csrf_token_view),
    path("login/", views.login_view),
    path("logout/", views.logout_view),
    path("me/", views.CurrentUserView.as_view()),
    path("2fa/setup/", two_factor_views.two_factor_setup_view),
    path("2fa/verify/", two_factor_views.two_factor_verify_view),
    path("2fa/validate/", two_factor_views.two_factor_validate_view),
    path("2fa/status/", two_factor_views.two_factor_status_view),
]
