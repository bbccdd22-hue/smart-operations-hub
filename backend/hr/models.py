"""
HR & Payroll Engine - محرك الموارد البشرية والرواتب.
ملفات موظفين، عقود، مراكز تكلفة، قيد رواتب شهري مربوط بمراكز التكلفة.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from config.constants import (
    SYSTEM_CODE_COST_CENTER,
    SYSTEM_CODE_EMPLOYEE,
    SYSTEM_CODE_EMPLOYEE_CONTRACT,
    SYSTEM_CODE_PAYROLL_RUN,
)
from org.models import Branch, Brand, TimestampedModel


class CostCenter(TimestampedModel):
    """مركز تكلفة - لكل فرع أو قسم."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_COST_CENTER, db_index=True,
    )
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="cost_centers")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="cost_centers")
    code = models.CharField(max_length=32, db_index=True)
    name = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]
        unique_together = [["brand", "code"]]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Employee(TimestampedModel):
    """موظف."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_EMPLOYEE, db_index=True,
    )
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="employees")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="employees")
    cost_center = models.ForeignKey(
        CostCenter, on_delete=models.PROTECT, null=True, blank=True, related_name="employees",
    )

    employee_id = models.CharField(max_length=64, unique=True, db_index=True)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    first_name_ar = models.CharField(max_length=120, blank=True, default="")
    last_name_ar = models.CharField(max_length=120, blank=True, default="")

    national_id = models.CharField(max_length=32, blank=True, default="")
    insurance_provider = models.CharField(max_length=120, blank=True, default="")
    insurance_number = models.CharField(max_length=64, blank=True, default="")
    career_history = models.JSONField(
        default=list, blank=True,
        help_text="[{ from_date, to_date, company, position }]",
    )
    hire_date = models.DateField(null=True, blank=True)
    termination_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_profile",
    )

    class Meta:
        ordering = ["employee_id"]

    def __str__(self):
        return f"{self.employee_id} - {self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class EmployeeContract(TimestampedModel):
    """عقد الموظف - يحدد الراتب والبنود."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_EMPLOYEE_CONTRACT, db_index=True,
    )
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="contracts")
    contract_number = models.CharField(max_length=64, unique=True, db_index=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    housing_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    other_allowances = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.employee.employee_id} - {self.contract_number}"

    @property
    def gross_salary(self):
        return (
            self.basic_salary
            + self.housing_allowance
            + self.transport_allowance
            + self.other_allowances
        )


class PayrollRunStatus(models.TextChoices):
    DRAFT = "draft", "مسودة"
    POSTED = "posted", "مرحّل - تم إنشاء القيد المحاسبي"


class PayrollRun(TimestampedModel):
    """دفعة رواتب - تولد قيداً محاسبياً مرتبطاً بمراكز التكلفة."""
    system_code = models.CharField(
        max_length=16, default=SYSTEM_CODE_PAYROLL_RUN, db_index=True,
    )
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="payroll_runs")
    period_month = models.PositiveSmallIntegerField()
    period_year = models.PositiveSmallIntegerField()
    run_date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=16, choices=PayrollRunStatus.choices, default=PayrollRunStatus.DRAFT, db_index=True,
    )
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="payroll_runs",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_payroll_runs",
    )

    class Meta:
        ordering = ["-period_year", "-period_month"]
        unique_together = [["brand", "period_month", "period_year"]]

    def __str__(self):
        return f"Payroll {self.period_year}-{self.period_month:02d}"


class PayrollRunLine(TimestampedModel):
    """سطر راتب - موظف واحد في دفعة الرواتب."""
    payroll_run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name="lines")
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="payroll_lines")
    cost_center = models.ForeignKey(CostCenter, on_delete=models.PROTECT, related_name="payroll_lines")
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    net_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = [["payroll_run", "employee"]]

    def __str__(self):
        return f"{self.payroll_run} - {self.employee} = {self.net_amount}"


class AttendanceRecord(models.Model):
    """سجل الحضور والانصراف - ربط تسجيل الدخول بالكاشير مع تتبع الموقع."""
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="attendance_records")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="attendance_records")
    clock_in = models.DateTimeField(db_index=True)
    clock_out = models.DateTimeField(null=True, blank=True)
    source = models.CharField(max_length=24, default="pos", help_text="pos | biometric | manual")
    location_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    within_geo_fence = models.BooleanField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-clock_in"]


class LeaveRequest(models.Model):
    """طلب إجازة - الخدمة الذاتية."""
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="leave_requests")
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=16, default=STATUS_PENDING, db_index=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_leaves",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class EmployeePenalty(models.Model):
    """جزاء - خصم من الراتب (تأخير، مخالفة، إلخ)."""
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="penalties")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=255, blank=True, default="")
    period_month = models.PositiveSmallIntegerField()
    period_year = models.PositiveSmallIntegerField()
    deducted_in_payroll = models.ForeignKey(
        PayrollRun, on_delete=models.SET_NULL, null=True, blank=True, related_name="penalty_deductions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class SalaryAdvance(models.Model):
    """سلفة - تُخصم من قيد الرواتب."""
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_DEDUCTED = "deducted"

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="salary_advances")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    requested_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=16, default=STATUS_PENDING, db_index=True)
    deducted_in_payroll = models.ForeignKey(
        PayrollRun, on_delete=models.SET_NULL, null=True, blank=True, related_name="advance_deductions",
    )
