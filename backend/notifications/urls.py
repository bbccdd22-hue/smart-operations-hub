from django.urls import path
from notifications import views

urlpatterns = [
    path("rules/", views.NotificationRuleListCreateView.as_view()),
    path("rules/trigger/", views.NotificationRuleTriggerView.as_view()),
    path("rules/<int:pk>/", views.NotificationRuleDetailView.as_view()),
]
