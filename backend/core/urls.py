from django.urls import path

from core import views

urlpatterns = [
    path("csrf/", views.csrf_token_view),
    path("login/", views.login_view),
    path("logout/", views.logout_view),
    path("me/", views.CurrentUserView.as_view()),
]
