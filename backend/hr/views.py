"""
HR APIs - الخدمة الذاتية للموظفين (إجازات، سلف) + إدارة.
"""
from django.db.models import Q
from rest_framework import permissions, response, status, views
from rest_framework.exceptions import PermissionDenied

from hr.attendance_services import record_clock_in, record_clock_out
from hr.models import CostCenter, Employee, LeaveRequest, SalaryAdvance
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


class CostCenterListAPIView(views.APIView):
    """قائمة مراكز التكلفة — للاستخدام في قيود اليومية والأبعاد."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from core.permissions import get_user_scope
        scope = get_user_scope(request.user)
        qs = CostCenter.objects.filter(is_active=True).select_related("branch", "brand").order_by("code")
        if scope.get("brand_ids"):
            qs = qs.filter(brand_id__in=scope["brand_ids"])
        if scope.get("branch_ids"):
            qs = qs.filter(branch_id__in=scope["branch_ids"])
        brand_id = request.query_params.get("brand_id")
        branch_id = request.query_params.get("branch_id")
        if brand_id:
            try:
                qs = qs.filter(brand_id=int(brand_id))
            except (TypeError, ValueError):
                pass
        if branch_id:
            try:
                qs = qs.filter(branch_id=int(branch_id))
            except (TypeError, ValueError):
                pass
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(code__icontains=search)
                | Q(name__icontains=search)
                | Q(name_ar__icontains=search)
            )
        rows = [
            {
                "id": cc.id,
                "code": cc.code,
                "name": cc.name,
                "name_ar": cc.name_ar or cc.name,
                "branch_id": cc.branch_id,
                "branch_name": cc.branch.name,
                "brand_id": cc.brand_id,
                "brand_name": cc.brand.name,
            }
            for cc in qs[:200]
        ]
        return response.Response({"cost_centers": rows})


class EmployeeListAPIView(views.APIView):
    """قائمة الموظفين — للاستخدام في قيود اليومية والأبعاد."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from core.permissions import get_user_scope
        scope = get_user_scope(request.user)
        qs = Employee.objects.filter(is_active=True).select_related("branch", "brand").order_by("employee_id")
        if scope.get("brand_ids"):
            qs = qs.filter(brand_id__in=scope["brand_ids"])
        if scope.get("branch_ids"):
            qs = qs.filter(branch_id__in=scope["branch_ids"])
        brand_id = request.query_params.get("brand_id")
        branch_id = request.query_params.get("branch_id")
        if brand_id:
            try:
                qs = qs.filter(brand_id=int(brand_id))
            except (TypeError, ValueError):
                pass
        if branch_id:
            try:
                qs = qs.filter(branch_id=int(branch_id))
            except (TypeError, ValueError):
                pass
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(employee_id__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(first_name_ar__icontains=search)
                | Q(last_name_ar__icontains=search)
            )
        rows = [
            {
                "id": emp.id,
                "employee_id": emp.employee_id,
                "first_name": emp.first_name,
                "last_name": emp.last_name,
                "first_name_ar": emp.first_name_ar or emp.first_name,
                "last_name_ar": emp.last_name_ar or emp.last_name,
                "branch_id": emp.branch_id,
                "branch_name": emp.branch.name if emp.branch else None,
                "brand_id": emp.brand_id,
                "brand_name": emp.brand.name if emp.brand else None,
            }
            for emp in qs[:200]
        ]
        return response.Response({"employees": rows})
