"""
محرك حساب الرواتب - خصم الغياب، السلف، الجزاءات، وإنشاء قيد المحاسبة.
"""
import calendar
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from hr.models import (
    AttendanceRecord,
    CostCenter,
    Employee,
    EmployeeContract,
    EmployeePenalty,
    PayrollRun,
    PayrollRunLine,
    SalaryAdvance,
)


def _days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _worked_days(employee_id: int, year: int, month: int) -> int:
    """أيام العمل الفعلية من سجل الحضور (عدد الأيام التي سجّل فيها دخولاً)."""
    first = date(year, month, 1)
    _, last_day = calendar.monthrange(year, month)
    last = date(year, month, last_day)
    qs = AttendanceRecord.objects.filter(
        employee_id=employee_id,
        clock_in__date__gte=first,
        clock_in__date__lte=last,
    )
    dates = qs.values_list("clock_in__date", flat=True).distinct()
    return len(set(dates))


def calculate_net_salary(
    employee_id: int,
    period_month: int,
    period_year: int,
) -> dict:
    """
    حساب الراتب الصافي لموظف واحد: الأساسي + البدلات - الغياب - السلف - الجزاءات.
    Returns: {
        gross, deductions_absence, deductions_advances, deductions_penalties,
        total_deductions, net,
        worked_days, expected_days, contract
    }
    """
    contract = (
        EmployeeContract.objects.filter(
            employee_id=employee_id,
            employee__is_active=True,
            is_active=True,
            start_date__lte=date(period_year, period_month, calendar.monthrange(period_year, period_month)[1]),
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=date(period_year, period_month, 1)))
        .select_related("employee")
        .first()
    )
    if not contract:
        return {
            "gross": 0,
            "deductions_absence": 0,
            "deductions_advances": 0,
            "deductions_penalties": 0,
            "total_deductions": 0,
            "net": 0,
            "worked_days": 0,
            "expected_days": 0,
            "contract": None,
        }

    expected_days = _days_in_month(period_year, period_month)
    worked = _worked_days(employee_id, period_year, period_month)
    gross = contract.gross_salary

    deductions_absence = Decimal("0.00")
    if worked < expected_days and expected_days > 0:
        daily_rate = gross / expected_days
        deductions_absence = daily_rate * (expected_days - worked)

    advances_sum = (
        SalaryAdvance.objects.filter(
            employee_id=employee_id,
            status="approved",
            deducted_in_payroll__isnull=True,
        ).aggregate(s=Sum("amount"))["s"]
        or Decimal("0")
    )

    penalties_sum = (
        EmployeePenalty.objects.filter(
            employee_id=employee_id,
            period_month=period_month,
            period_year=period_year,
            deducted_in_payroll__isnull=True,
        ).aggregate(s=Sum("amount"))["s"]
        or Decimal("0")
    )

    total_deductions = deductions_absence + advances_sum + penalties_sum
    net = max(Decimal("0"), gross - total_deductions)

    return {
        "gross": float(gross),
        "deductions_absence": float(deductions_absence),
        "deductions_advances": float(advances_sum),
        "deductions_penalties": float(penalties_sum),
        "total_deductions": float(total_deductions),
        "net": float(net),
        "worked_days": worked,
        "expected_days": expected_days,
        "contract": {
            "contract_number": contract.contract_number,
            "basic_salary": float(contract.basic_salary),
            "housing_allowance": float(contract.housing_allowance),
            "transport_allowance": float(contract.transport_allowance),
            "other_allowances": float(contract.other_allowances),
        },
    }


def calculate_payroll_run(
    brand_id: int,
    period_month: int,
    period_year: int,
    run_date: date | None = None,
    created_by=None,
) -> PayrollRun | None:
    """
    حساب دفعة الرواتب للشهر المحدد.
    - يجمع الموظفين النشطين بعقود سارية
    - يحسب الإجمالي والخصومات (غياب، سلف، جزاءات)
    - ينشئ PayrollRun و PayrollRunLine
    """
    run_date = run_date or timezone.now().date()
    payroll, _ = PayrollRun.objects.get_or_create(
        brand_id=brand_id,
        period_month=period_month,
        period_year=period_year,
        defaults={
            "run_date": run_date,
            "status": "draft",
            "created_by_id": getattr(created_by, "id", None),
        },
    )
    if payroll.status == "posted":
        return payroll

    expected_days = _days_in_month(period_year, period_month)
    contracts = (
        EmployeeContract.objects.filter(
            employee__brand_id=brand_id,
            employee__is_active=True,
            is_active=True,
            start_date__lte=date(period_year, period_month, expected_days),
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=date(period_year, period_month, 1)))
        .select_related("employee", "employee__cost_center")
    )

    total_amount = Decimal("0.00")
    with transaction.atomic():
        PayrollRunLine.objects.filter(payroll_run=payroll).delete()
        for contract in contracts:
            emp = contract.employee
            cost_center = emp.cost_center
            if not cost_center:
                cc = CostCenter.objects.filter(brand_id=brand_id, branch=emp.branch).first()
                if not cc:
                    continue
                cost_center = cc

            gross = contract.gross_salary
            deductions = Decimal("0.00")

            # خصم الغياب
            worked = _worked_days(emp.id, period_year, period_month)
            if worked < expected_days and expected_days > 0:
                daily_rate = gross / expected_days
                deductions += daily_rate * (expected_days - worked)

            # خصم السلف المعتمدة
            advances = SalaryAdvance.objects.filter(
                employee=emp,
                status="approved",
                deducted_in_payroll__isnull=True,
            )
            for adv in advances:
                deductions += adv.amount
                adv.deducted_in_payroll = payroll
                adv.status = "deducted"
                adv.save(update_fields=["deducted_in_payroll", "status"])

            # خصم الجزاءات
            penalties = EmployeePenalty.objects.filter(
                employee=emp,
                period_month=period_month,
                period_year=period_year,
                deducted_in_payroll__isnull=True,
            )
            for pen in penalties:
                deductions += pen.amount
                pen.deducted_in_payroll = payroll
                pen.save(update_fields=["deducted_in_payroll"])

            net = max(Decimal("0"), gross - deductions)
            PayrollRunLine.objects.create(
                payroll_run=payroll,
                employee=emp,
                cost_center=cost_center,
                gross_amount=gross,
                deductions=deductions,
                net_amount=net,
            )
            total_amount += net

        payroll.total_amount = total_amount
        payroll.save(update_fields=["total_amount"])
    return payroll


def post_payroll_journal_entry(payroll: PayrollRun, created_by=None):
    """
    إصدار قيد رواتب في شجرة الحسابات.
    مدين: مصروف رواتب (0510308 أو 05103)
    دائن: نقدية/بنك (011)
    """
    if payroll.journal_entry_id:
        return payroll.journal_entry
    from accounting.models import ChartAccount, JournalEntry, JournalEntryLine, JournalEntrySource
    from org.models import Branch

    total = payroll.total_amount
    if total <= 0:
        return None

    expense_account = (
        ChartAccount.objects.filter(code__startswith="0510308").first()
        or ChartAccount.objects.filter(code__startswith="05103").first()
    )
    cash_account = (
        ChartAccount.objects.filter(code="011011102").first()
        or ChartAccount.objects.filter(code__startswith="011").first()
    )
    if not expense_account or not cash_account:
        return None

    branch = None
    first_line = payroll.lines.select_related("cost_center__branch").first()
    if first_line and first_line.cost_center:
        branch = first_line.cost_center.branch
    if not branch and payroll.brand_id:
        branch = Branch.objects.filter(brand_id=payroll.brand_id).first()

    je = JournalEntry.objects.create(
        entry_date=payroll.run_date,
        description=f"قيد رواتب {payroll.period_year}-{payroll.period_month:02d}",
        source_type=JournalEntrySource.PAYROLL,
        branch=branch,
        created_by=created_by,
    )
    JournalEntryLine.objects.create(
        journal_entry=je,
        account=expense_account,
        account_code=expense_account.code,
        account_name_ar=expense_account.name_ar,
        debit_amount=total,
        credit_amount=Decimal("0"),
    )
    JournalEntryLine.objects.create(
        journal_entry=je,
        account=cash_account,
        account_code=cash_account.code,
        account_name_ar=cash_account.name_ar,
        debit_amount=Decimal("0"),
        credit_amount=total,
    )
    payroll.journal_entry = je
    payroll.status = "posted"
    payroll.save(update_fields=["journal_entry", "status"])
    return je
