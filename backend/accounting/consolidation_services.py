"""
Financial Consolidation - التوحيد المحاسبي.
الميزانية الموحدة (Consolidated Balance Sheet) - تجميع أرباح وخسائر
جميع الفروع والشركات التابعة في تقرير واحد للمالك.
"""
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from django.db.models import Sum

from accounting.models import ChartAccount, JournalEntryLine
from org.models import Branch, Brand, Organization


@dataclass
class AccountBalance:
    """رصيد حساب في تقرير موحد."""
    code: str
    name_ar: str
    name_en: str
    balance: Decimal
    branch_id: Optional[int]
    branch_name: Optional[str]
    brand_id: Optional[int]
    brand_name: Optional[str]


def get_consolidated_balance_sheet(
    organization_id: Optional[int] = None,
    brand_ids: Optional[list[int]] = None,
    branch_ids: Optional[list[int]] = None,
    as_of_date: Optional[str] = None,
) -> list[AccountBalance]:
    """
    الميزانية الموحدة - تجميع أرصدة الحسابات من جميع الفروع.
    يُرجع قائمة حسابات مجمعة حسب الشجرة المحاسبية.
    """
    from django.db.models import F, Value, CharField
    from django.db.models.functions import Coalesce

    # فلترة JournalEntry حسب branch
    qs = JournalEntryLine.objects.select_related(
        "journal_entry", "account"
    ).filter(
        journal_entry__entry_date__lte=as_of_date or "9999-12-31"
    )

    if branch_ids:
        qs = qs.filter(journal_entry__branch_id__in=branch_ids)
    if brand_ids:
        qs = qs.filter(journal_entry__branch__brand_id__in=brand_ids)
    if organization_id:
        qs = qs.filter(journal_entry__branch__brand__organization_id=organization_id)

    # تجميع حسب account
    from django.db.models import Sum
    from collections import defaultdict

    balances = defaultdict(lambda: {"debit": Decimal("0"), "credit": Decimal("0")})
    for line in qs:
        key = line.account_id or line.account_code or "unknown"
        balances[key]["debit"] += line.debit_amount or Decimal("0")
        balances[key]["credit"] += line.credit_amount or Decimal("0")

    # تحويل للأرصدة النهائية
    result = []
    for account in ChartAccount.objects.filter(is_active=True).order_by("code"):
        net = (balances.get(account.id, {}).get("debit", Decimal("0"))
               - balances.get(account.id, {}).get("credit", Decimal("0")))
        if account.statement == "المركز المالي":
            result.append(AccountBalance(
                code=account.code,
                name_ar=account.name_ar,
                name_en=account.name_en,
                balance=net,
                branch_id=None,
                branch_name=None,
                brand_id=None,
                brand_name=None,
            ))
    return result


def get_consolidated_income(
    organization_id: Optional[int] = None,
    brand_ids: Optional[list[int]] = None,
    branch_ids: Optional[list[int]] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> dict:
    """
    قائمة الدخل الموحدة - إيرادات ونفقات مجمعة.
    """
    qs = JournalEntryLine.objects.filter(
        journal_entry__entry_date__gte=from_date or "1900-01-01",
        journal_entry__entry_date__lte=to_date or "9999-12-31",
    )
    if branch_ids:
        qs = qs.filter(journal_entry__branch_id__in=branch_ids)
    if brand_ids:
        qs = qs.filter(journal_entry__branch__brand_id__in=brand_ids)
    if organization_id:
        qs = qs.filter(journal_entry__branch__brand__organization_id=organization_id)

    income_lines = qs.filter(account__statement="قائمة الدخل", account__code__startswith="4")
    expense_lines = qs.filter(account__statement="قائمة الدخل", account__code__startswith="5")

    total_income = income_lines.aggregate(s=Sum("credit_amount"))["s"] or Decimal("0")
    total_expense = expense_lines.aggregate(s=Sum("debit_amount"))["s"] or Decimal("0")

    return {
        "total_revenue": total_income,
        "total_expenses": total_expense,
        "net_income": total_income - total_expense,
    }
