"""
محرك القيود المحاسبية – توليد قيود مزدوجة من إقفال الورديات.
Double-entry: مجموع المدين = مجموع الدائن.
"""
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db import transaction

from accounting.models import ChartAccount, JournalEntry, JournalEntryLine, JournalEntrySource

if TYPE_CHECKING:
    from shifts.models import ShiftClosing

# Mapping: report display name -> (account_code, account_name_ar) من دليل الحسابات
ACCOUNT_MAPPING = {
    "صندوق فرعي": ("011011102", "نقدية - الفروع"),
    "بنك - بطاقات": ("011012", "البنوك"),
    "بنك - توصيل": ("011012", "البنوك"),
    "إيرادات المبيعات": ("04101", "إيرادات مبيعات"),
    "مصروفات تشغيلية": ("05102", "مصاريف تشغيلية"),
}


def _get_account_and_notify(code: str, fallback_name_ar: str) -> tuple[ChartAccount | None, str]:
    """
    يبحث عن الحساب في شجرة الحسابات بالكود.
    إذا وُجد: يرجع (account, name_ar من الشجرة).
    إذا لم يُوجد: ينشئ تنبيهاً للمحاسب ويرجع (None, fallback_name_ar) – النظام يستمر.
    """
    acct = ChartAccount.objects.filter(code=code).first()
    if acct:
        return (acct, acct.name_ar or fallback_name_ar)
    try:
        from django.contrib.auth import get_user_model
        from org.models import AdminNotification
        saif = get_user_model().objects.filter(username="SAIF").first()
        if saif:
            AdminNotification.objects.create(
                user=saif,
                event_type="chart_account_missing",
                title="حساب مفقود في الشجرة",
                message=f"الكود {code} ({fallback_name_ar}) غير موجود في دليل الحسابات. تم تسجيل القيد بأسم ثابت. أضف الحساب لربط القيود.",
            )
    except Exception as exc:
        from core.error_logging import log_system_error
        log_system_error("other", f"Failed to notify about missing chart account {code}", context={"code": code}, exc=exc)
    return (None, fallback_name_ar)


def create_journal_entry_from_shift_closing(
    closing: "ShiftClosing",
    *,
    created_by=None,
) -> JournalEntry | None:
    """
    ينشئ قيداً محاسبياً مزدوجاً من إقفال الوردية ويحفظه في قاعدة البيانات.
    يُستدعى عند submit الإقفال.
    Returns JournalEntry or None if no amounts to record.
    """
    entry_date = closing.shift.opened_at.date()
    branch = closing.shift.branch.name
    shift_type = closing.shift.shift_type
    desc_base = f"إقفال وردية {shift_type} - {branch}"

    cash = Decimal(str(closing.manual_cash_total() or 0))
    network = Decimal(str(closing.manual_network_total() or 0))
    delivery = Decimal(str(closing.manual_delivery_total() or 0))
    expenses = Decimal(str(closing.expenses_vouchers or 0)) + Decimal(str(closing.staff_drinks or 0))

    lines: list[tuple[str, str, Decimal, Decimal]] = []  # (code, name_ar, debit, credit)

    if cash > 0:
        code, name = ACCOUNT_MAPPING["صندوق فرعي"]
        rev_code, rev_name = ACCOUNT_MAPPING["إيرادات المبيعات"]
        lines.append((code, name, cash, Decimal("0")))
        lines.append((rev_code, rev_name, Decimal("0"), cash))

    if network > 0:
        code, name = ACCOUNT_MAPPING["بنك - بطاقات"]
        rev_code, rev_name = ACCOUNT_MAPPING["إيرادات المبيعات"]
        lines.append((code, name, network, Decimal("0")))
        lines.append((rev_code, rev_name, Decimal("0"), network))

    if delivery > 0:
        code, name = ACCOUNT_MAPPING["بنك - توصيل"]
        rev_code, rev_name = ACCOUNT_MAPPING["إيرادات المبيعات"]
        lines.append((code, name, delivery, Decimal("0")))
        lines.append((rev_code, rev_name, Decimal("0"), delivery))

    if expenses > 0:
        exp_code, exp_name = ACCOUNT_MAPPING["مصروفات تشغيلية"]
        cash_code, cash_name = ACCOUNT_MAPPING["صندوق فرعي"]
        lines.append((exp_code, exp_name, expenses, Decimal("0")))
        lines.append((cash_code, cash_name, Decimal("0"), expenses))

    if not lines:
        return None

    # Avoid duplicate – لا ننشئ قيداً إذا وُجد سابقاً لهذا الإقفال
    if JournalEntry.objects.filter(shift_closing=closing).exists():
        return JournalEntry.objects.filter(shift_closing=closing).first()

    # Verify double-entry balance
    total_debit = sum(l[2] for l in lines)
    total_credit = sum(l[3] for l in lines)
    if total_debit != total_credit:
        raise ValueError(
            f"القيد غير متوازن: المدين={total_debit} الدائن={total_credit}"
        )

    with transaction.atomic():
        journal = JournalEntry.objects.create(
            entry_date=entry_date,
            description=f"{desc_base} – قيد تلقائي",
            source_type=JournalEntrySource.SHIFT_CLOSING,
            shift_closing=closing,
            created_by=created_by,
        )
        for account_code, account_name_ar, debit, credit in lines:
            acct, display_name = _get_account_and_notify(account_code, account_name_ar)
            JournalEntryLine.objects.create(
                journal_entry=journal,
                account=acct,
                account_code=account_code,
                account_name_ar=display_name,
                debit_amount=debit,
                credit_amount=credit,
            )
    return journal
