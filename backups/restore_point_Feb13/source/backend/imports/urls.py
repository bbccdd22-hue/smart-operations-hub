from django.urls import path

from imports.views import BatchUploadView, ExcelUploadView, ParsePreviewView, SystemCashLookupView, UploadAnalyticsView

urlpatterns = [
    path("parse-preview/", ParsePreviewView.as_view(), name="parse-preview"),
    path("batch-upload/", BatchUploadView.as_view(), name="batch-upload"),
    path("upload/", ExcelUploadView.as_view(), name="excel-upload"),
    path("upload/<int:upload_id>/analytics/", UploadAnalyticsView.as_view(), name="upload-analytics"),
    path("system-cash/", SystemCashLookupView.as_view(), name="system-cash-lookup"),
]

