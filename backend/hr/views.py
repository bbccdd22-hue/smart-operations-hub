"""
HR APIs - الخدمة الذاتية للموظفين (إجازات، سلف) + إدارة.
"""
from rest_framework import permissions, response, status, views
from rest_framework.exceptions import PermissionDenied

from hr.attendance_services import record_clock_in, record_clock_out
from hr.models import Employee, LeaveRequest, SalaryAdvance
from hr.payroll_services import calculate_net_salary


def _get_employee(user):
    """الموظف المرتبط بالمستخدم."""
    return getattr(user, "employee_profile", None)


class EmployeeSelfServiceView(views.APIView):
    """الموظف يعرض بياناته وكشف الراتب الاسترشادي."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        emp = _get_employee(request.user)
        if not emp:
            raise PermissionDenied("المستخدم غير مرتبط بموظف")
        month = request.query_params.get("month", "").strip()
        year = request.query_params.get("year", "").strip()
        if month and year:
            try:
                m, y = int(month), int(year)
                calc = calculate_net_salary(emp.id, m, y)
                return response.Response({"profile": _emp_profile(emp), "salary_preview": calc})
            except (ValueError, TypeError):
                pass
        return response.Response({"profile": _emp_profile(emp)})


def _emp_profile(emp):
    return {
        "id": emp.id,
        "employee_id": emp.employee_id,
        "full_name": emp.full_name,
        "branch": emp.branch.name if emp.branch else None,
        "hire_date": str(emp.hire_date) if emp.hire_date else None,
    }


class LeaveRequestListCreateView(views.APIView):
    """قائمة طلبات الإجازة + إنشاء طلب."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        emp = _get_employee(request.user)
        if not emp:
            raise PermissionDenied("المستخدم غير مرتبط بموظف")
        items = LeaveRequest.objects.filter(employee=emp).order_by("-created_at")[:50]
        return response.Response({
            "items": [
                {
                    "id": r.id,
                    "start_date": str(r.start_date),
                    "end_date": str(r.end_date),
                    "reason": r.reason,
                    "status": r.status,
                }
                for r in items
            ],
        })

    def post(self, request):
        emp = _get_employee(request.user)
        if not emp:
            raise PermissionDenied("المستخدم غير مرتبط بموظف")
        start = request.data.get("start_date")
        end = request.data.get("end_date")
        reason = (request.data.get("reason") or "")[:255]
        if not start or not end:
            return response.Response(
                {"detail": "start_date و end_date مطلوبان"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from datetime import datetime
            start_d = datetime.strptime(start, "%Y-%m-%d").date()
            end_d = datetime.strptime(end, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return response.Response(
                {"detail": "صيغة التاريخ: YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if end_d < start_d:
            return response.Response(
                {"detail": "end_date يجب أن يكون بعد start_date"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        req = LeaveRequest.objects.create(
            employee=emp,
            start_date=start_d,
            end_date=end_d,
            reason=reason,
            status="pending",
        )
        return response.Response(
            {"id": req.id, "status": req.status},
            status=status.HTTP_201_CREATED,
        )


class SalaryAdvanceListCreateView(views.APIView):
    """قائمة السلف + طلب سلفة."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        emp = _get_employee(request.user)
        if not emp:
            raise PermissionDenied("المستخدم غير مرتبط بموظف")
        items = SalaryAdvance.objects.filter(employee=emp).order_by("-requested_at")[:50]
        return response.Response({
            "items": [
                {
                    "id": a.id,
                    "amount": float(a.amount),
                    "status": a.status,
                    "requested_at": a.requested_at.isoformat(),
                }
                for a in items
            ],
        })

    def post(self, request):
        emp = _get_employee(request.user)
        if not emp:
            raise PermissionDenied("المستخدم غير مرتبط بموظف")
        try:
            amount = float(request.data.get("amount") or 0)
        except (ValueError, TypeError):
            return response.Response(
                {"detail": "المبلغ يجب أن يكون رقماً موجباً"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if amount <= 0:
            return response.Response(
                {"detail": "المبلغ يجب أن يكون موجباً"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        adv = SalaryAdvance.objects.create(
            employee=emp,
            amount=amount,
            status="pending",
        )
        return response.Response(
            {"id": adv.id, "status": adv.status},
            status=status.HTTP_201_CREATED,
        )


class ClockOutView(views.APIView):
    """تسجيل الخروج يدوياً (للطرفيات التي لا تعتمد على logout)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ok = record_clock_out(request.user)
        return response.Response({"recorded": ok})


class ClockInView(views.APIView):
    """تسجيل الدخول يدوياً (إذا لم يُسجّل تلقائياً عند login)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ok = record_clock_in(request.user)
        return response.Response({"recorded": ok})
