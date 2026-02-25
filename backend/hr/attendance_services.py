"""
ربط تسجيل الدخول/الخروج بالحضور والانصراف.
عند دخول الموظف من الكاشير (أو أي تطبيق) يُسجّل clock_in، وعند الخروج clock_out.
"""
from django.utils import timezone


def record_clock_in(user) -> bool:
    """
    تسجيل دخول الموظف - يُستدعى بعد login عند ربط المستخدم بموظف.
    Returns True if recorded.
    """
    try:
        employee = getattr(user, "employee_profile", None)
    except Exception:
        return False
    if not employee or not employee.branch_id:
        return False
    from hr.models import AttendanceRecord

    AttendanceRecord.objects.create(
        employee=employee,
        branch=employee.branch,
        clock_in=timezone.now(),
        source="pos",
    )
    return True


def record_clock_out(user) -> bool:
    """
    تسجيل خروج الموظف - يُستدعى عند logout.
    يُحدّث آخر سجل حضور مفتوح (بدون clock_out).
    Returns True if updated.
    """
    try:
        employee = getattr(user, "employee_profile", None)
    except Exception:
        return False
    if not employee:
        return False
    from hr.models import AttendanceRecord

    last_open = (
        AttendanceRecord.objects.filter(employee=employee, clock_out__isnull=True)
        .order_by("-clock_in")
        .first()
    )
    if not last_open:
        return False
    last_open.clock_out = timezone.now()
    last_open.save(update_fields=["clock_out"])
    return True
