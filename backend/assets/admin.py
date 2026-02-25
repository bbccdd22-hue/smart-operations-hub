from django.contrib import admin
from .models import Asset, AssetDepreciation


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "branch", "purchase_cost", "useful_life_months")
    list_filter = ("category", "brand")


@admin.register(AssetDepreciation)
class AssetDepreciationAdmin(admin.ModelAdmin):
    list_display = ("asset", "period_year", "period_month", "depreciation_amount")
    list_filter = ("period_year",)
