from django.contrib import admin
from .models import ChartAccount, FoodicsSettlement


@admin.register(ChartAccount)
class ChartAccountAdmin(admin.ModelAdmin):
    list_display = ("code", "name_ar", "name_en", "level", "account_type", "statement")
    list_filter = ("level", "account_type", "statement")
    search_fields = ("code", "name_ar", "name_en")
    ordering = ("code",)


@admin.register(FoodicsSettlement)
class FoodicsSettlementAdmin(admin.ModelAdmin):
    list_display = ("branch", "report_date", "total_deposited", "created_at")
    list_filter = ("report_date", "branch__brand")
    search_fields = ("branch__name", "notes")
