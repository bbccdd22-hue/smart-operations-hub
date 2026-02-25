from django.contrib import admin
from .models import Currency, ExchangeRate


@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "symbol", "is_base")
    list_filter = ("is_base",)
    search_fields = ("code", "name")
    ordering = ["code"]


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ("from_currency", "to_currency", "rate", "updated_at")
    list_filter = ("from_currency", "to_currency")
    search_fields = ("from_currency__code", "to_currency__code")
    raw_id_fields = ("from_currency", "to_currency")
