from rest_framework import serializers

from imports.models import ExcelReportType, ExcelUpload


class ExcelUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExcelUpload
        fields = [
            "id", "uuid", "report_type", "file", "brand", "branch",
            "report_date_from", "report_date_to",
            "status", "processed_at", "error_message",
            "progress_pct", "progress_message",
            "created_at",
        ]
        read_only_fields = [
            "report_date_from", "report_date_to", "status", "processed_at",
            "error_message", "progress_pct", "progress_message", "created_at",
        ]

    def validate_report_type(self, value):
        if value not in ExcelReportType.values:
            raise serializers.ValidationError("Invalid report type.")
        return value

