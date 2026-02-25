"""
سجل أخطاء النظام – يحفظ الأعطال لمراجعة المالك (سيف).
"""
import traceback
from typing import Any


def log_system_error(
    error_type: str,
    message: str,
    *,
    user=None,
    context: dict[str, Any] | None = None,
    include_traceback: bool = True,
    exc: BaseException | None = None,
) -> None:
    """
    سجّل خطأ في SystemErrorLog.
    error_type: depletion_failed | upload_failed | transfer_failed | other
    """
    try:
        from org.models import SystemErrorLog

        tb = ""
        if include_traceback and exc:
            tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        elif include_traceback:
            tb = traceback.format_exc()

        SystemErrorLog.objects.create(
            error_type=error_type,
            message=str(message)[:4000],
            traceback=tb[:8000] if tb else "",
            context=context or {},
            user=user,
        )
    except Exception:  # noqa: BLE001
        pass
