"""
Rule evaluators – تُقيّم القواعد وتُرجع قائمة تنبيهات للإرسال.
"""
from datetime import datetime, timedelta, time
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()

# أوقات بداية الورديات الافتراضية (Asia/Riyadh)
DEFAULT_SHIFT_STARTS = {
    "morning": time(6, 0),
    "evening": time(14, 0),
    "late_night": time(22, 0),
}


def check_shift_not_opened_within_minutes(params: dict) -> list[dict]:
    """
    تنبيه للمالك إذا لم تُفتح الوردية بعد X دقائق من موعدها.
    params: {"minutes": 10, "shift_type": "morning"|"evening"|"late_night"}
    Returns list of {"branch_id", "branch_name", "shift_type", "expected_at", "title", "message"}
    """
    from org.models import Branch
    from shifts.models import Shift

    minutes = int(params.get("minutes", 10))
    shift_type = params.get("shift_type", "morning") or "morning"
    expected_start = DEFAULT_SHIFT_STARTS.get(shift_type, time(6, 0))

    now = timezone.now()
    today = now.date()
    expected_dt = timezone.make_aware(datetime.combine(today, expected_start), timezone.get_current_timezone())
    deadline = expected_dt + timedelta(minutes=minutes)

    if now < deadline:
        return []  # Not yet deadline

    alerts = []
    branches = Branch.objects.filter(is_active=True).select_related("brand")
    for branch in branches:
        has_open_shift = Shift.objects.filter(
            branch=branch,
            shift_type=shift_type,
            opened_at__date=today,
        ).exists()
        if not has_open_shift:
            alerts.append({
                "branch_id": branch.id,
                "branch_name": branch.name,
                "brand_name": branch.brand.name if branch.brand else "",
                "shift_type": shift_type,
                "expected_at": expected_dt.isoformat(),
                "title": f"وردية {shift_type} لم تُفتح – {branch.name}",
                "message": f"لم يتم فتح وردية {shift_type} في فرع {branch.name} خلال {minutes} دقائق من الموعد.",
            })
    return alerts


def check_shift_not_closed_by_deadline(params: dict) -> list[dict]:
    """
    تنبيه إذا لم تُقفل الوردية بحلول وقت معين.
    params: {"deadline_hour": 2, "deadline_minute": 0}  # 02:00 next day
    """
    from org.models import Branch
    from shifts.models import Shift, ShiftStatus

    hour = int(params.get("deadline_hour", 2))
    minute = int(params.get("deadline_minute", 0))

    now = timezone.now()
    today = now.date()
    deadline_today = timezone.make_aware(
        datetime.combine(today, time(hour, minute)),
        timezone.get_current_timezone()
    )
    if now.hour < hour or (now.hour == hour and now.minute < minute):
        yesterday = today - timedelta(days=1)
        deadline = timezone.make_aware(
            datetime.combine(yesterday, time(hour, minute)),
            timezone.get_current_timezone()
        )
    else:
        deadline = deadline_today

    alerts = []
    open_shifts = Shift.objects.filter(
        status=ShiftStatus.OPEN,
        opened_at__lt=deadline,
    ).select_related("branch", "branch__brand", "opened_by")

    for shift in open_shifts:
        alerts.append({
            "shift_id": shift.id,
            "branch_id": shift.branch_id,
            "branch_name": shift.branch.name,
            "brand_name": shift.branch.brand.name if shift.branch.brand else "",
            "opened_at": shift.opened_at.isoformat(),
            "title": f"وردية لم تُقفل – {shift.branch.name}",
            "message": f"الوردية في فرع {shift.branch.name} مفتوحة منذ {shift.opened_at} ولم تُقفل.",
        })
    return alerts


def evaluate_rule(rule) -> list[dict]:
    """تقييم قاعدة واحدة وإرجاع قائمة تنبيهات."""
    if rule.rule_type == "shift_not_opened_within_minutes":
        return check_shift_not_opened_within_minutes(rule.params)
    if rule.rule_type == "shift_not_closed_by_deadline":
        return check_shift_not_closed_by_deadline(rule.params)
    # low_stock_alert, variance_threshold – للمستقبل
    return []
