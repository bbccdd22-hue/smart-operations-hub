from django.contrib import admin
from .models import FoodicsSettlement


@admin.register(FoodicsSettlement)
class FoodicsSettlementAdmin(admin.ModelAdmin):
    list_display = ("branch", "report_date", "total_deposited", "created_at")
    list_filter = ("report_date", "branch__brand")
    search_fields = ("branch__name", "notes")
