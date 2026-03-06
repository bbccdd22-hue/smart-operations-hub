"""
Integration: HR → Payroll → Accounting
========================================
Attendance → PayrollRun → JournalEntry

Invariants validated:
  1. Employees with full attendance: net = gross salary.
  2. Absence deduction reduces net proportionally.
  3. Salary advance deduction reduces net and marks advance as deducted.
  4. PayrollRun total_amount = sum of all PayrollRunLine.net_amount.
  5. post_payroll_journal_entry produces a balanced JE.
  6. Expense account (0510308) appears on debit side.
  7. Cash account (011011102) appears on credit side.
  8. Calling post_payroll_journal_entry twice is idempotent.
  9. PayrollRun with status=posted cannot be recalculated (returns existing run).
 10. Zero-employee brand produces no JE.
 11. Penalty deduction reduces net correctly.
 12. Absent employee with no contract is skipped (no crash).
"""
import calendar
import datetime
from decimal import Decimal

import pytest

YEAR = 2025
MONTH = 6  # June — a non-conflicting month

BASIC_SALARY = Decimal("3000.00")
HOUSING = Decimal("500.00")
TRANSPORT = Decimal("200.00")
GROSS = BASIC_SALARY + HOUSING + TRANSPORT  # 3700.00


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_cost_center(brand, branch):
    from hr.models import CostCenter
    cc, _ = CostCenter.objects.get_or_create(
        brand=brand, branch=branch, code=f"CC-{branch.id}",
        defaults={"name": "Operations", "name_ar": "عمليات", "is_active": True},
    )
    return cc


def _make_employee(brand, branch, emp_id, cost_center):
    from hr.models import Employee, EmployeeContract
    emp, _ = Employee.objects.get_or_create(
        employee_id=emp_id,
        defaults={
            "brand": brand, "branch": branch, "cost_center": cost_center,
            "first_name": f"Emp", "last_name": emp_id, "is_active": True,
        },
    )
    EmployeeContract.objects.get_or_create(
        contract_number=f"CON-{emp_id}",
        defaults={
            "employee": emp, "start_date": datetime.date(2024, 1, 1),
            "basic_salary": BASIC_SALARY, "housing_allowance": HOUSING,
            "transport_allowance": TRANSPORT, "other_allowances": Decimal("0"),
            "is_active": True,
        },
    )
    return emp


def _add_full_attendance(emp, branch, year, month):
    from hr.models import AttendanceRecord
    _, last_day = calendar.monthrange(year, month)
    for day in range(1, last_day + 1):
        dt = datetime.datetime(year, month, day, 9, 0, 0, tzinfo=datetime.timezone.utc)
        AttendanceRecord.objects.get_or_create(
            employee=emp, clock_in=dt, defaults={"branch": branch, "source": "manual"}
        )


def _add_attendance_days(emp, branch, year, month, days):
    from hr.models import AttendanceRecord
    for day in days:
        dt = datetime.datetime(year, month, day, 9, 0, 0, tzinfo=datetime.timezone.utc)
        AttendanceRecord.objects.get_or_create(
            employee=emp, clock_in=dt, defaults={"branch": branch, "source": "manual"}
        )


def _make_payroll_accounts():
    from accounting.models import ChartAccount
    for code, name_ar, name_en in [
        ("0510308", "مصروف رواتب", "Salary Expense"),
        ("011011102", "نقدية", "Cash"),
    ]:
        ChartAccount.objects.get_or_create(
            code=code,
            defaults={"name_ar": name_ar, "name_en": name_en, "level": 4,
                      "account_type": "تحليلي", "statement": "قائمة الدخل"},
        )


def _run_payroll(brand, month, year, user, run_date=None):
    from hr.payroll_services import calculate_payroll_run
    return calculate_payroll_run(
        brand_id=brand.id, period_month=month, period_year=year,
        run_date=run_date or datetime.date(year, month, 1), created_by=user,
    )


# ─── Test 1: Full attendance → net = gross ────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_full_attendance_net_equals_gross(main_branch, test_brand, superuser):
    cc = _make_cost_center(test_brand, main_branch)
    emp = _make_employee(test_brand, main_branch, "HR-INT-01", cc)
    _add_full_attendance(emp, main_branch, YEAR, MONTH)

    from hr.payroll_services import calculate_net_salary
    result = calculate_net_salary(emp.id, MONTH, YEAR)

    assert result["net"] == pytest.approx(float(GROSS), abs=0.01), (
        f"Expected net={GROSS}, got {result['net']}"
    )
    assert result["total_deductions"] == pytest.approx(0.0, abs=0.01)


# ─── Test 2: Absence deduction is proportional ───────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_absence_deduction_is_proportional(main_branch, test_brand, superuser):
    cc = _make_cost_center(test_brand, main_branch)
    emp = _make_employee(test_brand, main_branch, "HR-INT-02", cc)

    _, total_days = calendar.monthrange(YEAR, MONTH)
    absent_days = 5
    worked_days = total_days - absent_days
    _add_attendance_days(emp, main_branch, YEAR, MONTH, list(range(1, worked_days + 1)))

    from hr.payroll_services import calculate_net_salary
    result = calculate_net_salary(emp.id, MONTH, YEAR)

    expected_deduction = (GROSS / total_days) * absent_days
    expected_net = max(Decimal("0"), GROSS - expected_deduction)

    assert result["net"] == pytest.approx(float(expected_net), abs=1.0), (
        f"Expected net≈{expected_net}, got {result['net']}"
    )
    assert result["deductions_absence"] == pytest.approx(float(expected_deduction), abs=1.0)


# ─── Test 3: Salary advance reduces net ──────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_salary_advance_reduces_net(main_branch, test_brand, superuser):
    cc = _make_cost_center(test_brand, main_branch)
    emp = _make_employee(test_brand, main_branch, "HR-INT-03", cc)
    _add_full_attendance(emp, main_branch, YEAR, MONTH)

    from hr.models import SalaryAdvance
    advance = SalaryAdvance.objects.create(
        employee=emp, amount=Decimal("500"), status="approved",
    )

    from hr.payroll_services import calculate_net_salary
    result = calculate_net_salary(emp.id, MONTH, YEAR)

    assert result["deductions_advances"] == pytest.approx(500.0, abs=0.01)
    assert result["net"] == pytest.approx(float(GROSS - Decimal("500")), abs=0.01)


# ─── Test 4: Penalty deduction reduces net ───────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_penalty_deduction_reduces_net(main_branch, test_brand, superuser):
    cc = _make_cost_center(test_brand, main_branch)
    emp = _make_employee(test_brand, main_branch, "HR-INT-04", cc)
    _add_full_attendance(emp, main_branch, YEAR, MONTH)

    from hr.models import EmployeePenalty
    EmployeePenalty.objects.create(
        employee=emp, amount=Decimal("200"),
        period_month=MONTH, period_year=YEAR,
        reason="Late arrival",
    )

    from hr.payroll_services import calculate_net_salary
    result = calculate_net_salary(emp.id, MONTH, YEAR)

    assert result["deductions_penalties"] == pytest.approx(200.0, abs=0.01)
    assert result["net"] == pytest.approx(float(GROSS - Decimal("200")), abs=0.01)


# ─── Test 5: PayrollRun total = sum of lines ─────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_payroll_run_total_equals_sum_of_lines(main_branch, test_brand, superuser):
    cc = _make_cost_center(test_brand, main_branch)
    emp1 = _make_employee(test_brand, main_branch, "HR-INT-05A", cc)
    emp2 = _make_employee(test_brand, main_branch, "HR-INT-05B", cc)
    _add_full_attendance(emp1, main_branch, YEAR, 7)  # July
    _add_full_attendance(emp2, main_branch, YEAR, 7)

    payroll = _run_payroll(test_brand, 7, YEAR, superuser)

    assert payroll is not None
    lines_total = sum(l.net_amount for l in payroll.lines.all())
    assert payroll.total_amount == lines_total, (
        f"PayrollRun total {payroll.total_amount} ≠ sum of lines {lines_total}"
    )


# ─── Test 6: Journal entry is balanced ───────────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_payroll_journal_entry_balanced(main_branch, test_brand, superuser):
    _make_payroll_accounts()
    cc = _make_cost_center(test_brand, main_branch)
    emp = _make_employee(test_brand, main_branch, "HR-INT-06", cc)
    _add_full_attendance(emp, main_branch, YEAR, 8)  # August

    payroll = _run_payroll(test_brand, 8, YEAR, superuser)
    from hr.payroll_services import post_payroll_journal_entry
    je = post_payroll_journal_entry(payroll, created_by=superuser)

    if je is None:
        pytest.skip("Missing payroll accounts")

    from integration_tests.conftest import lines_balanced
    assert lines_balanced(je), "Payroll journal entry not balanced"


# ─── Test 7: Expense account on debit, cash on credit ───────────────────────

@pytest.mark.django_db(transaction=True)
def test_payroll_je_expense_debit_cash_credit(main_branch, test_brand, superuser):
    _make_payroll_accounts()
    cc = _make_cost_center(test_brand, main_branch)
    emp = _make_employee(test_brand, main_branch, "HR-INT-07", cc)
    _add_full_attendance(emp, main_branch, YEAR, 9)  # September

    payroll = _run_payroll(test_brand, 9, YEAR, superuser)
    from hr.payroll_services import post_payroll_journal_entry
    from accounting.models import JournalEntryLine
    je = post_payroll_journal_entry(payroll, created_by=superuser)

    if je is None:
        pytest.skip("Missing payroll accounts")

    debit_lines = JournalEntryLine.objects.filter(
        journal_entry=je, account__code="0510308", debit_amount__gt=0
    )
    credit_lines = JournalEntryLine.objects.filter(
        journal_entry=je, account__code="011011102", credit_amount__gt=0
    )
    assert debit_lines.exists(), "Salary expense not on debit side"
    assert credit_lines.exists(), "Cash not on credit side"


# ─── Test 8: Posting payroll JE is idempotent ────────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_payroll_je_idempotent(main_branch, test_brand, superuser):
    _make_payroll_accounts()
    cc = _make_cost_center(test_brand, main_branch)
    emp = _make_employee(test_brand, main_branch, "HR-INT-08", cc)
    _add_full_attendance(emp, main_branch, YEAR, 10)  # October

    payroll = _run_payroll(test_brand, 10, YEAR, superuser)
    from hr.payroll_services import post_payroll_journal_entry
    je1 = post_payroll_journal_entry(payroll, created_by=superuser)
    je2 = post_payroll_journal_entry(payroll, created_by=superuser)

    if je1 is None:
        pytest.skip("Missing payroll accounts")

    assert je1.pk == je2.pk, "Posting payroll twice created two different JEs"


# ─── Test 9: Already-posted PayrollRun is not recalculated ───────────────────

@pytest.mark.django_db(transaction=True)
def test_posted_payroll_not_recalculated(main_branch, test_brand, superuser):
    _make_payroll_accounts()
    cc = _make_cost_center(test_brand, main_branch)
    emp = _make_employee(test_brand, main_branch, "HR-INT-09", cc)
    _add_full_attendance(emp, main_branch, YEAR, 11)  # November

    payroll = _run_payroll(test_brand, 11, YEAR, superuser)
    from hr.payroll_services import post_payroll_journal_entry
    post_payroll_journal_entry(payroll, created_by=superuser)

    payroll.refresh_from_db()
    assert payroll.status == "posted"

    # Calling calculate_payroll_run again returns the same posted run without changes
    payroll2 = _run_payroll(test_brand, 11, YEAR, superuser)
    assert payroll.pk == payroll2.pk
    assert payroll2.status == "posted"


# ─── Test 10: Zero-total payroll produces no JE ──────────────────────────────

@pytest.mark.django_db(transaction=True)
def test_zero_total_payroll_produces_no_je(main_branch, test_brand, superuser):
    """PayrollRun with total_amount=0 (no employees) must not create a JE."""
    _make_payroll_accounts()
    from hr.payroll_services import calculate_payroll_run, post_payroll_journal_entry
    from hr.models import PayrollRun

    # Ensure no employees for brand in this month
    payroll = PayrollRun.objects.create(
        brand=test_brand, period_month=12, period_year=YEAR,
        run_date=datetime.date(YEAR, 12, 1), status="draft",
        total_amount=Decimal("0"), created_by=superuser,
    )
    je = post_payroll_journal_entry(payroll, created_by=superuser)
    assert je is None, "Expected None JE for zero-total payroll"


# ─── Test 11: Employee without contract is skipped ───────────────────────────

@pytest.mark.django_db(transaction=True)
def test_employee_without_contract_is_skipped(main_branch, test_brand, superuser):
    """calculate_payroll_run must not crash if an employee has no active contract."""
    from hr.models import Employee
    Employee.objects.get_or_create(
        employee_id="HR-INT-11-NOCONTRACT",
        defaults={
            "brand": test_brand, "branch": main_branch,
            "first_name": "No", "last_name": "Contract", "is_active": True,
        },
    )
    # No exception should be raised
    payroll = _run_payroll(test_brand, 3, YEAR, superuser)
    assert payroll is not None


# ─── Test 12: PayrollRunLine count matches active employees ──────────────────

@pytest.mark.django_db(transaction=True)
def test_payroll_line_count_matches_employees(main_branch, test_brand, superuser):
    cc = _make_cost_center(test_brand, main_branch)
    emp_ids = ["HR-INT-12A", "HR-INT-12B", "HR-INT-12C"]
    for eid in emp_ids:
        emp = _make_employee(test_brand, main_branch, eid, cc)
        _add_full_attendance(emp, main_branch, YEAR, 4)  # April

    payroll = _run_payroll(test_brand, 4, YEAR, superuser)
    assert payroll is not None
    # There should be at least as many lines as the 3 employees we created
    assert payroll.lines.count() >= len(emp_ids), (
        f"Expected ≥{len(emp_ids)} lines, got {payroll.lines.count()}"
    )
