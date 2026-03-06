from django.urls import path
from .views import ZATCAInvoiceView

urlpatterns = [
    path("invoice/", ZATCAInvoiceView.as_view(), name="zatca-invoice"),
]
