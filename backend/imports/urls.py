from django.urls import path

from imports.views import (
    BatchUploadView,
    ExcelUploadView,
    ParsePreviewView,
    SystemCashLookupView,
    UploadAnalyticsView,
    UploadStatusView,
)

urlpatterns = [
    path("parse-preview/", ParsePreviewView.as_view(), name="parse-preview"),
    path("batch-upload/", BatchUploadView.as_view(), name="batch-upload"),
    path("upload/", ExcelUploadView.as_view(), name="excel-upload"),
    path("upload/<uuid:upload_uuid>/analytics/", UploadAnalyticsView.as_view(), name="upload-analytics"),
    path("upload/<uuid:upload_uuid>/", UploadStatusView.as_view(), name="upload-status"),
    path("system-cash/", SystemCashLookupView.as_view(), name="system-cash-lookup"),
]

