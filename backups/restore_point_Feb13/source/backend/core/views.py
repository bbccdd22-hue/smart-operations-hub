"""
Authentication views: Login, Logout, Current User.
"""
from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from core.permissions import get_user_profile
from org.models import UserRole


@ensure_csrf_cookie
@require_GET
def csrf_token_view(request):
    """Ensure CSRF cookie is set for SPA."""
    get_token(request)
    return JsonResponse({"detail": "CSRF cookie set"})


@require_POST
def login_view(request):
    """Session-based login. Expects JSON: {username, password}."""
    import json
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return JsonResponse({"detail": "Username and password required"}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"detail": "Invalid credentials"}, status=401)

    if not user.is_active:
        return JsonResponse({"detail": "Account disabled"}, status=401)

    login(request, user)
    profile = get_user_profile(user)
    branch = profile.branch if profile else None
    brand = (branch.brand if branch else profile.brand) if profile else None
    return JsonResponse({
        "user": {
            "id": user.id,
            "username": user.username,
            "email": getattr(user, "email", "") or "",
            "role": profile.role if profile else UserRole.BRANCH_SUPERVISOR,
            "brand_id": brand.id if brand else None,
            "branch_id": branch.id if branch else None,
            "brand_slug": brand.slug if brand else None,
            "branch_name": branch.name if branch else None,
        }
    })


@require_POST
def logout_view(request):
    """Session logout."""
    logout(request)
    return JsonResponse({"detail": "Logged out"})


class CurrentUserView(APIView):
    """Returns current authenticated user and role."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = get_user_profile(user)
        branch = profile.branch if profile else None
        brand = (branch.brand if branch else profile.brand) if profile else None
        return Response({
            "user": {
                "id": user.id,
                "username": user.username,
                "email": getattr(user, "email", "") or "",
                "role": profile.role if profile else UserRole.BRANCH_SUPERVISOR,
                "brand_id": brand.id if brand else None,
                "branch_id": branch.id if branch else None,
                "brand_slug": brand.slug if brand else None,
                "branch_name": branch.name if branch else None,
            }
        })
