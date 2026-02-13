from django.urls import path

from shifts import views

urlpatterns = [
    path("closing/", views.ShiftClosingCreateView.as_view(), name="shift-closing-create"),
    path("closing/by-branch-date/", views.ShiftClosingByBranchDateView.as_view(), name="shift-closing-by-branch-date"),
    path("closing/<int:pk>/submit/", views.ShiftClosingSubmitView.as_view(), name="shift-closing-submit"),
    path("closing/<int:pk>/", views.ShiftClosingDetailView.as_view(), name="shift-closing-detail"),
]

