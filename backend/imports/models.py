from django.db import models

from config.constants import (
    SYSTEM_CODE_DAILY_SALE,
    SYSTEM_CODE_EXCEL_UPLOAD,
    SYSTEM_CODE_HOURLY_SALE,
    SYSTEM_CODE_PRODUCT_SALE,
)
from org.models import Brand, Branch, TimestampedModel


class ExcelReportType(models.TextChoices):
    HOURLY_SALES = "hourly_sales", "Hourly Sales"
    DAILY_SALES = "daily_sales", "Daily Sales"
    PRODUCT_SALES = "product_sales", "Product Sales"
    PAYMENTS_REPORT = "payments_report", "Payments Report / تقرير المقبوضات"


class ExcelUploadStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    PROCESSED = "processed", "Processed"
    FAILED = "failed", "Failed"


class ExcelUpload(TimestampedModel):
    """
    Raw file archive + basic metadata.
    ETL: Parse once → save to DB models → mark PROCESSED. UI fetches from DB only.
    """

    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_EXCEL_UPLOAD, db_index=True,
        help_text="ERP hierarchy code",
    )
    report_type = models.CharField(max_length=32, choices=ExcelReportType.choices)
    file = models.FileField(upload_to="excel_uploads/")
    uploaded_by = models.ForeignKey(
        "auth.User", on_delete=models.PROTECT, related_name="excel_uploads", null=True, blank=True
    )
    status = models.CharField(
        max_length=16, choices=ExcelUploadStatus.choices, default=ExcelUploadStatus.PENDING, db_index=True
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")

    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, null=True, blank=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True)
    report_date_from = models.DateField(null=True, blank=True)
    report_date_to = models.DateField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.report_type} - {self.file.name}"


class HourlySale(TimestampedModel):
    """
    Parsed Hourly Sales archive. All UI reads from this—never re-reads Excel.
    """

    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_HOURLY_SALE, db_index=True,
        help_text="ERP hierarchy code",
    )
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, db_index=True)
    date = models.DateField(db_index=True)
    hour = models.TimeField()

    total_sales = models.DecimalField(max_digits=14, decimal_places=2)
    cash_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    network_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    upload = models.ForeignKey(ExcelUpload, on_delete=models.CASCADE, related_name="hourly_rows")

    class Meta:
        indexes = [
            models.Index(fields=["branch", "date"]),
        ]


class DailySale(TimestampedModel):
    """
    Parsed Daily Sales archive. All UI reads from this—never re-reads Excel.
    """

    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_DAILY_SALE, db_index=True,
        help_text="ERP hierarchy code",
    )
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, db_index=True)
    date = models.DateField(db_index=True)

    total_sales = models.DecimalField(max_digits=14, decimal_places=2)
    cash_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    network_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    order_count = models.PositiveIntegerField(default=0, help_text="عدد الطلبات / Order Count")
    average_order = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text="متوسط الطلب / Average Order - pre-calculated from Excel, DO NOT compute"
    )

    upload = models.ForeignKey(ExcelUpload, on_delete=models.CASCADE, related_name="daily_rows")

    class Meta:
        indexes = [
            models.Index(fields=["branch", "date"]),
        ]


class ProductSale(TimestampedModel):
    """
    Product-level archive (per branch). All UI reads from this—never re-reads Excel.
    SP1003 - Prep List (PR1002) fetches sales data from this source.
    """

    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_PRODUCT_SALE, db_index=True,
        help_text="ERP hierarchy code (SP1003)",
    )
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, db_index=True)
    date = models.DateField(db_index=True)

    product_name = models.CharField(max_length=255, db_index=True)
    product_sku = models.CharField(max_length=128, blank=True, default="")

    qty = models.DecimalField(max_digits=14, decimal_places=2)
    total_sales = models.DecimalField(max_digits=14, decimal_places=2)

    upload = models.ForeignKey(ExcelUpload, on_delete=models.CASCADE, related_name="product_rows")

    class Meta:
        indexes = [
            models.Index(fields=["branch", "date"]),
            models.Index(fields=["product_name"]),
        ]

