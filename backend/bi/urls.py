from django.urls import path
from . import views

urlpatterns = [
    path("profit-report/", views.AdvancedProfitReportView.as_view()),
    path("forecast/", views.SalesForecastView.as_view()),
    path("control-center/", views.ControlCenterView.as_view()),
]
