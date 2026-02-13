from django.contrib import admin
from .models import Shift, ShiftClosing, ShiftSecurityLog


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("branch", "status", "opened_at", "closed_at", "opened_by", "closed_by")


@admin.register(ShiftClosing)
class ShiftClosingAdmin(admin.ModelAdmin):
    list_display = ("shift", "variance_cash", "variance_network", "reconciled_at")


@admin.register(ShiftSecurityLog)
class ShiftSecurityLogAdmin(admin.ModelAdmin):
    list_display = ("user", "branch", "action", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("user__username", "branch__name")
    readonly_fields = ("shift", "user", "action", "branch", "notes", "created_at")
