from django.urls import path
from . import views

urlpatterns = [
    path("self/", views.EmployeeSelfServiceView.as_view()),
    path("leaves/", views.LeaveRequestListCreateView.as_view()),
    path("advances/", views.SalaryAdvanceListCreateView.as_view()),
    path("clock-in/", views.ClockInView.as_view()),
    path("clock-out/", views.ClockOutView.as_view()),
]
