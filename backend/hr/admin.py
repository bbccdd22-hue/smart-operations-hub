from django.contrib import admin
from .models import CostCenter, Employee, EmployeeContract, PayrollRun, PayrollRunLine


@admin.register(CostCenter)
class CostCenterAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "branch", "brand")
    list_filter = ("brand",)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("employee_id", "first_name", "last_name", "branch", "cost_center", "is_active")
    list_filter = ("brand", "branch")


@admin.register(EmployeeContract)
class EmployeeContractAdmin(admin.ModelAdmin):
    list_display = ("contract_number", "employee", "start_date", "basic_salary")
    list_filter = ("employee__brand",)


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ("period_year", "period_month", "brand", "total_amount", "status")
    list_filter = ("brand", "status")


@admin.register(PayrollRunLine)
class PayrollRunLineAdmin(admin.ModelAdmin):
    list_display = ("payroll_run", "employee", "cost_center", "net_amount")
