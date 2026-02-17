"""
Role-based permissions for Smart Operations Hub.
- Owner: full access
- Brand Manager: scoped to their brand(s)
- Branch Supervisor: scoped to their branch only
"""
from typing import Optional

from django.contrib.auth import get_user_model
from rest_framework import permissions

from org.models import UserProfile, UserRole

User = get_user_model()


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
    None means no restriction (e.g. Owner).
    """
    profile = get_user_profile(user)
    if not profile:
        return {"brand_ids": None, "branch_ids": None}

    if profile.role == UserRole.OWNER:
        return {"brand_ids": None, "branch_ids": None}

    if profile.role == UserRole.BRAND_MANAGER:
        brand_ids = [profile.brand_id] if profile.brand_id else []
        return {"brand_ids": brand_ids, "branch_ids": None}

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
