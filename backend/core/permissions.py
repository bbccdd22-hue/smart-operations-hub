"""
Role-based permissions for Smart Operations Hub.
- Super Admin (سيف): username "SAIF" (uppercase) – المرجع الوحيد، Edit/Delete في كل مكان
- General Manager: إشرافي، يمكن الرفع والإضافة، لا حذف ولا تعديل إعدادات حساسة
- Owner: استعراض كامل
- Brand Manager: العلامة فقط
- Branch Supervisor: الفرع فقط – إقفال الشفت، الهدر، المشتريات المحلية
- External Accountant: قراءة فقط
"""
from typing import Optional

from django.contrib.auth import get_user_model
from rest_framework import permissions

from org.models import UserProfile, UserRole

User = get_user_model()

SAIF_USERNAME = "SAIF"


def is_super_admin(user) -> bool:
    """الحساب الرئيسي (سيف) – المرجع الوحيد. Username must be exactly SAIF."""
    return bool(user and user.is_authenticated and (user.username or "") == SAIF_USERNAME)


def _role_has_permission(profile: Optional[UserProfile], permission_key: str) -> bool:
    """يفحص صلاحية الدور من RolePermissionConfig. يُستخدم فوراً بعد الحفظ."""
    if not profile:
        return False
    try:
        from org.models import RolePermissionConfig, ROLE_PERMISSION_DEFAULTS
        config = RolePermissionConfig.objects.filter(role=profile.role).first()
        perms = config.permissions if config and config.permissions else ROLE_PERMISSION_DEFAULTS.get(profile.role, {})
        return bool(perms.get(permission_key, False))
    except Exception:
        return False


def can_delete_chart_or_users(user) -> bool:
    """صلاحية حذف الحسابات من الشجرة أو حذف المستخدمين – سيف فقط."""
    return is_super_admin(user)


def can_edit_chart_or_settings(user) -> bool:
    """صلاحية تعديل الشجرة أو الإعدادات العامة – سيف أو دور مُصرّح له."""
    if is_super_admin(user):
        return True
    profile = get_user_profile(user)
    return _role_has_permission(profile, "edit_chart_of_accounts")


def is_read_only_role(profile: Optional[UserProfile]) -> bool:
    """المحاسب الخارجي: قراءة فقط."""
    return bool(profile and profile.role == UserRole.EXTERNAL_ACCOUNTANT)


def can_upload_or_modify_data(user) -> bool:
    """سيف أو دور لديه upload_files – يمكنهم الرفع والتعديل."""
    if not user or not user.is_authenticated:
        return False
    if is_super_admin(user):
        return True
    profile = get_user_profile(user)
    if is_read_only_role(profile):
        return False
    # تحقق من صلاحية الدور
    return _role_has_permission(profile, "upload_files")


def can_manage_chart_accounts(user) -> bool:
    """سيف أو دور لديه edit_chart_of_accounts – إنشاء/تعديل دليل الحسابات. الحذف = سيف فقط."""
    if not user or not user.is_authenticated:
        return False
    if is_read_only_role(get_user_profile(user)):
        return False
    return can_edit_chart_or_settings(user)


def get_user_profile(user) -> Optional[UserProfile]:
    if not user or not user.is_authenticated:
        return None
    try:
        return user.profile
    except UserProfile.DoesNotExist:
        return None


def get_user_scope(user) -> dict:
    """
    Returns {brand_ids: [int]|None, branch_ids: [int]|None}
    None means no restriction (e.g. Owner, General Manager with all_brands).
    [Ref: 2026-02-13]
    """
    profile = get_user_profile(user)
    if not profile:
        return {"brand_ids": None, "branch_ids": None}

    if profile.role == UserRole.OWNER:
        return {"brand_ids": None, "branch_ids": None}

    if profile.role == UserRole.GENERAL_MANAGER:
        return {"brand_ids": None, "branch_ids": None}

    if profile.role == UserRole.EXTERNAL_ACCOUNTANT:
        return {"brand_ids": None, "branch_ids": None}

    if profile.role == UserRole.BRAND_MANAGER:
        if getattr(profile, "all_brands", False):
            return {"brand_ids": None, "branch_ids": None}  # unrestricted [Ref: 2026-02-13]
        ids = list(profile.brand_ids) if getattr(profile, "brand_ids", None) else []  # scoped [Ref: 2026-02-13]
        if not ids and profile.brand_id:
            ids = [profile.brand_id]
        return {"brand_ids": ids, "branch_ids": None}

    if profile.role == UserRole.BRANCH_SUPERVISOR:
        branch_ids = [profile.branch_id] if profile.branch_id else []
        return {"brand_ids": None, "branch_ids": branch_ids}

    return {"brand_ids": [], "branch_ids": []}


class IsAuthenticatedWithRole(permissions.BasePermission):
    """
    Requires authentication. Optionally enforces role (e.g. Owner only).
    """

    role_required: Optional[str] = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if self.role_required:
            profile = get_user_profile(request.user)
            if not profile or profile.role != self.role_required:
                return False
        return True


class RoleScopedPermission(permissions.BasePermission):
    """
    Checks role and filters queryset based on user scope.
    Use with get_scope_filter() in view's get_queryset.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        scope = get_user_scope(request.user)
        # Owner: full access
        if scope["brand_ids"] is None and scope["branch_ids"] is None:
            return True
        # Branch supervisor: only their branch
        if scope["branch_ids"] is not None:
            branch_id = getattr(obj, "branch_id", None) or getattr(
                getattr(obj, "shift", None), "branch_id", None
            )
            return branch_id in (scope["branch_ids"] or [])
        # Brand manager: their brand's branches
        if scope["brand_ids"] is not None:
            brand_id = getattr(obj, "brand_id", None) or getattr(
                getattr(getattr(obj, "shift", None), "branch", None), "brand_id", None
            )
            return brand_id in (scope["brand_ids"] or [])
        return False
