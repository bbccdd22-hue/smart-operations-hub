from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from core.permissions import get_user_profile, get_user_scope
from org.models import (
    AdminNotification,
    Brand,
    Branch,
    City,
    NotificationPreference,
    SavedView,
    UserProfile,
    UserRole,
)
from org.serializers import BrandSerializer, BranchSerializer, CitySerializer

User = get_user_model()
OWNER_EMAIL = "SAAL.NQ@ICLOUD.COM"  # Correct owner email for notifications


def _is_saif_owner(request):
    """Admin Hub ops require SAIF + Owner."""
    if not request.user or not request.user.is_authenticated:
        return False
    if request.user.username.lower() != "saif":
        return False
    profile = get_user_profile(request.user)
    return profile and profile.role == UserRole.OWNER


def apply_role_scope_to_branches(qs, request):
    """Filter branches by user role (Brand Manager / Branch Supervisor)."""
    scope = get_user_scope(request.user)
    if scope["branch_ids"] is not None:
        return qs.filter(id__in=(scope["branch_ids"] or []))
    if scope["brand_ids"] is not None:
        return qs.filter(brand_id__in=(scope["brand_ids"] or []))
    return qs


def _notify_saif(saif_user, event_type, title, message=""):
    """Create in-app AdminNotification for SAIF. Email controlled by preferences."""
    if not saif_user or saif_user.username.lower() != "saif":
        return
    AdminNotification.objects.create(
        user=saif_user, event_type=event_type, title=title, message=message
    )


class CityListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]  # Public for login flow; tighten when auth enforced
    serializer_class = CitySerializer

    def get_queryset(self):
        return City.objects.filter(is_active=True).order_by("name_en")


class BrandListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = BrandSerializer

    def get_queryset(self):
        qs = Brand.objects.filter(is_active=True).order_by("name")
        scope = get_user_scope(self.request.user) if self.request.user.is_authenticated else {"brand_ids": None}
        if scope.get("brand_ids") is not None:
            qs = qs.filter(id__in=(scope["brand_ids"] or []))
        return qs

    def post(self, request, *args, **kwargs):
        """Create brand (SAIF only)."""
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)

        name = (request.data.get("name") or "").strip()
        brand_code = (request.data.get("brand_code") or "").strip() or None
        if not name:
            return Response({"detail": "Name required"}, status=400)
        if Brand.objects.filter(name__iexact=name).exists():
            return Response({"detail": "Brand already exists"}, status=400)
        if brand_code and Brand.objects.filter(brand_code=brand_code).exists():
            return Response({"detail": "Brand code already exists"}, status=400)

        brand = Brand.objects.create(name=name, brand_code=brand_code or "")
        return Response(BrandSerializer(brand).data, status=status.HTTP_201_CREATED)


class BrandDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            brand = Brand.objects.get(pk=pk)
        except Brand.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        data = request.data or {}
        if "name" in data:
            name = (data["name"] or "").strip()
            if name and not Brand.objects.filter(name__iexact=name).exclude(pk=pk).exists():
                brand.name = name
                brand.save()
        if "brand_code" in data:
            bc = (data["brand_code"] or "").strip()
            if bc and Brand.objects.filter(brand_code=bc).exclude(pk=pk).exists():
                return Response({"detail": "Brand code already exists"}, status=400)
            brand.brand_code = bc
            brand.save()
        return Response(BrandSerializer(brand).data)

    def delete(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            brand = Brand.objects.get(pk=pk)
        except Brand.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        brand.is_active = False
        brand.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BranchListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = BranchSerializer

    def get_queryset(self):
        qs = Branch.objects.select_related("brand", "city").filter(is_active=True)
        if self.request.user.is_authenticated:
            qs = apply_role_scope_to_branches(qs, self.request)
        city = self.request.query_params.get("city")
        brand = self.request.query_params.get("brand")
        brands_param = self.request.query_params.get("brands")
        if city:
            qs = qs.filter(city__code=city)
        if brands_param:
            slugs = [s.strip() for s in brands_param.split(",") if s.strip()]
            if slugs:
                qs = qs.filter(brand__slug__in=slugs)
        elif brand:
            qs = qs.filter(brand__slug=brand)
        return qs.order_by("brand__name", "name")

    def post(self, request, *args, **kwargs):
        """Create branch (SAIF only). Expects: brand_id, city_id, name, name_ar?, code?"""
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)

        data = request.data or {}
        brand_id = data.get("brand_id")
        city_id = data.get("city_id")
        name = (data.get("name") or "").strip()
        name_ar = (data.get("name_ar") or "").strip()
        code = (data.get("code") or "").strip() or None
        branch_code = (data.get("branch_code") or "").strip() or ""

        if not brand_id or not city_id or not name:
            return Response({"detail": "brand_id, city_id, name required"}, status=400)

        try:
            brand = Brand.objects.get(pk=brand_id)
            city = City.objects.get(pk=city_id)
        except (Brand.DoesNotExist, City.DoesNotExist):
            return Response({"detail": "Invalid brand or city"}, status=400)

        code = code or (name.lower().replace(" ", "-")[:50])
        if Branch.objects.filter(brand=brand, code=code).exists():
            return Response({"detail": "Branch code already exists for this brand"}, status=400)
        if branch_code and Branch.objects.filter(brand=brand, branch_code=branch_code).exists():
            return Response({"detail": "Branch code already exists for this brand"}, status=400)

        branch = Branch.objects.create(
            brand=brand,
            city=city,
            name=name,
            name_ar=name_ar or name,
            code=code,
            branch_code=branch_code,
        )
        return Response(BranchSerializer(branch).data, status=status.HTTP_201_CREATED)


class BranchDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            branch = Branch.objects.get(pk=pk)
        except Branch.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        data = request.data or {}
        if "name" in data:
            name = (data["name"] or "").strip()
            if name:
                branch.name = name
        if "name_ar" in data:
            branch.name_ar = (data["name_ar"] or "").strip()
        if "branch_code" in data:
            bc = (data["branch_code"] or "").strip()
            if bc and Branch.objects.filter(brand=branch.brand, branch_code=bc).exclude(pk=pk).exists():
                return Response({"detail": "Branch code already exists for this brand"}, status=400)
            branch.branch_code = bc
        if "brand_id" in data:
            try:
                branch.brand = Brand.objects.get(pk=data["brand_id"])
            except Brand.DoesNotExist:
                pass
        if "city_id" in data:
            try:
                branch.city = City.objects.get(pk=data["city_id"])
            except City.DoesNotExist:
                pass
        branch.save()
        return Response(BranchSerializer(branch).data)

    def delete(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            branch = Branch.objects.get(pk=pk)
        except Branch.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        branch.is_active = False
        branch.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserListView(views.APIView):
    """List users with profile (SAIF/Owner only)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)

        users = []
        for u in User.objects.select_related("profile", "profile__brand", "profile__branch").order_by("username"):
            profile = get_user_profile(u)
            role = profile.role if profile else "branch_supervisor"
            brand_id = profile.brand_id if profile else None
            branch_id = profile.branch_id if profile else None
            users.append({
                "id": u.id,
                "username": u.username,
                "email": getattr(u, "email", "") or "",
                "role": role,
                "brand_id": brand_id,
                "branch_id": branch_id,
                "is_staff": u.is_staff,
                "is_active": u.is_active,
            })
        return Response(users)

    def post(self, request):
        """Create user (SAIF only). Expects: username, password, email?, role, brand_ids?, branch_ids?."""
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)

        data = request.data or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        email = (data.get("email") or "").strip()
        role = data.get("role") or "branch_supervisor"
        brand_ids = data.get("brand_ids") or []
        branch_ids = data.get("branch_ids") or []

        if not username:
            return Response({"detail": "Username required"}, status=400)
        if not password:
            return Response({"detail": "Password required"}, status=400)
        if role not in ("owner", "brand_manager", "branch_supervisor"):
            return Response({"detail": "Invalid role"}, status=400)

        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "Username already exists"}, status=400)

        user = User.objects.create_user(
            username=username,
            password=password,
            email=email or f"{username}@local",
        )
        user.is_staff = False
        user.is_active = True
        user.save()

        brand_id = brand_ids[0] if isinstance(brand_ids, list) and brand_ids else None
        branch_id = branch_ids[0] if isinstance(branch_ids, list) and branch_ids else None

        branch = None
        if branch_id:
            try:
                branch = Branch.objects.get(pk=branch_id)
            except Branch.DoesNotExist:
                pass
        UserProfile.objects.create(
            user=user,
            role=role,
            brand_id=brand_id,
            branch_id=branch_id,
        )
        _notify_saif(
            request.user,
            "user_created",
            "New user added",
            f"User '{username}' was added to {branch.name if branch else 'system'}.",
        )

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email or "",
            "role": role,
        }, status=status.HTTP_201_CREATED)


def _serialize_user_detail(user):
    """Full user profile for detail view."""
    profile = get_user_profile(user)
    brand = profile.brand if profile else None
    branch = profile.branch if profile else None
    last_login = getattr(user, "last_login", None)
    return {
        "id": user.id,
        "username": user.username,
        "first_name": getattr(user, "first_name", "") or "",
        "last_name": getattr(user, "last_name", "") or "",
        "email": getattr(user, "email", "") or "",
        "role": profile.role if profile else "branch_supervisor",
        "brand_id": profile.brand_id if profile else None,
        "branch_id": profile.branch_id if profile else None,
        "brand": {"id": brand.id, "name": brand.name} if brand else None,
        "branch": {"id": branch.id, "name": branch.name, "name_ar": getattr(branch, "name_ar", "")} if branch else None,
        "phone": profile.phone if profile else "",
        "employee_id": profile.employee_id if profile else "",
        "preferred_language": profile.preferred_language if profile else "en",
        "login_code": profile.login_code if profile else "",
        "is_staff": user.is_staff,
        "is_active": user.is_active,
        "last_login": last_login.isoformat() if last_login else None,
    }


class UserDetailView(views.APIView):
    """Get, update (incl. freeze), or delete user (SAIF only)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            user = User.objects.select_related("profile", "profile__brand", "profile__branch").get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        return Response(_serialize_user_detail(user))

    def patch(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)

        try:
            user = User.objects.select_related("profile", "profile__brand", "profile__branch").get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)

        data = request.data or {}
        prev_active = user.is_active

        if "is_active" in data:
            if user.username.lower() == "saif":
                return Response({"detail": "Cannot freeze SAIF"}, status=400)
            user.is_active = bool(data["is_active"])
            user.save()
            if prev_active and not user.is_active:
                _notify_saif(request.user, "user_frozen", "Account frozen", f"User '{user.username}' was frozen.")
            elif not prev_active and user.is_active:
                _notify_saif(request.user, "user_activated", "Account activated", f"User '{user.username}' was reactivated.")

        profile, _ = UserProfile.objects.get_or_create(user=user, defaults={"role": UserRole.BRANCH_SUPERVISOR})

        profile_updated = False
        if any(k in data for k in ("role", "brand_id", "branch_id", "phone", "employee_id", "preferred_language", "login_code")):
            if user.username.lower() == "saif" and "role" in data:
                pass  # Skip role change for SAIF
            else:
                if "role" in data and data["role"] in ("owner", "brand_manager", "branch_supervisor"):
                    profile.role = data["role"]
                    profile_updated = True
                if "brand_id" in data:
                    profile.brand_id = data["brand_id"] or None
                    profile_updated = True
                if "branch_id" in data:
                    profile.branch_id = data["branch_id"] or None
                    profile_updated = True
                if "phone" in data:
                    profile.phone = (data["phone"] or "").strip()[:32]
                    profile_updated = True
                if "employee_id" in data:
                    profile.employee_id = (data["employee_id"] or "").strip()[:64]
                    profile_updated = True
                if "preferred_language" in data:
                    profile.preferred_language = (data["preferred_language"] or "en").strip()[:8]
                    profile_updated = True
                if "login_code" in data:
                    profile.login_code = (data["login_code"] or "").strip()[:64]
                    profile_updated = True
                profile.save()

        if "password" in data and data["password"]:
            user.set_password(data["password"])
            user.save()

        if "email" in data:
            user.email = (data["email"] or "").strip() or f"{user.username}@local"
            user.save(update_fields=["email"])
            profile_updated = True

        if "first_name" in data:
            user.first_name = (data["first_name"] or "").strip()[:150]
            user.save(update_fields=["first_name"])
            profile_updated = True
        if "last_name" in data:
            user.last_name = (data["last_name"] or "").strip()[:150]
            user.save(update_fields=["last_name"])
            profile_updated = True

        if profile_updated and any(k in data for k in ("email", "first_name", "last_name", "phone", "employee_id", "role", "brand_id", "branch_id")):
            _notify_saif(request.user, "user_profile_updated", "User profile updated", f"Profile for '{user.username}' was updated.")

        return Response(_serialize_user_detail(user))

    def delete(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)

        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)

        if user.username.lower() == "saif":
            return Response({"detail": "Cannot delete SAIF"}, status=400)

        user.is_active = False
        user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationPreferenceView(views.APIView):
    """Get/update notification preferences (SAIF only)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        prefs = NotificationPreference.objects.filter(user=request.user)
        result = {pt[0]: True for pt in NotificationPreference.NOTIFICATION_TYPES}
        for p in prefs:
            result[p.notification_type] = p.enabled
        return Response(result)

    def patch(self, request):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        data = request.data or {}
        for nt, _ in NotificationPreference.NOTIFICATION_TYPES:
            if nt in data:
                pref, _ = NotificationPreference.objects.get_or_create(
                    user=request.user, notification_type=nt, defaults={"enabled": True}
                )
                pref.enabled = bool(data[nt])
                pref.save()
        return Response(status=status.HTTP_200_OK)


class AdminNotificationListView(views.APIView):
    """List unread notifications for SAIF (for badge/toast)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        limit = min(int(request.query_params.get("limit", 20)), 50)
        unread = AdminNotification.objects.filter(user=request.user, read=False).order_by("-created_at")[:limit]
        return Response([{
            "id": n.id,
            "event_type": n.event_type,
            "title": n.title,
            "message": n.message,
            "created_at": n.created_at.isoformat(),
        } for n in unread])

    def post(self, request):
        """Mark notifications as read."""
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        ids = request.data.get("ids") or []
        if ids:
            AdminNotification.objects.filter(user=request.user, id__in=ids).update(read=True)
        return Response({"ok": True})


class SavedViewListCreateView(views.APIView):
    """List and create saved views (SAIF only)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        views = SavedView.objects.filter(user=request.user)
        return Response([{
            "id": v.id,
            "name": v.name,
            "brand_slug": v.brand_slug or "",
            "branch_ids": v.branch_ids or [],
            "report_type": v.report_type or "daily_sales",
            "date_range_days": v.date_range_days,
            "is_default": v.is_default,
        } for v in views])

    def post(self, request):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        data = request.data or {}
        name = (data.get("name") or "").strip()
        if not name:
            return Response({"detail": "Name required"}, status=400)
        is_default = bool(data.get("is_default", False))
        if is_default:
            SavedView.objects.filter(user=request.user).update(is_default=False)
        v = SavedView.objects.create(
            user=request.user,
            name=name,
            brand_slug=(data.get("brand_slug") or "").strip(),
            branch_ids=data.get("branch_ids") or [],
            report_type=data.get("report_type") or "daily_sales",
            date_range_days=int(data.get("date_range_days") or 1),
            is_default=is_default,
        )
        return Response({
            "id": v.id,
            "name": v.name,
            "brand_slug": v.brand_slug,
            "branch_ids": v.branch_ids,
            "report_type": v.report_type,
            "date_range_days": v.date_range_days,
            "is_default": v.is_default,
        }, status=status.HTTP_201_CREATED)


class SavedViewDetailView(views.APIView):
    """Get, update, delete saved view."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            v = SavedView.objects.get(pk=pk, user=request.user)
        except SavedView.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        return Response({
            "id": v.id,
            "name": v.name,
            "brand_slug": v.brand_slug,
            "branch_ids": v.branch_ids,
            "report_type": v.report_type,
            "date_range_days": v.date_range_days,
            "is_default": v.is_default,
        })

    def patch(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            v = SavedView.objects.get(pk=pk, user=request.user)
        except SavedView.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        data = request.data or {}
        if "name" in data:
            v.name = (data["name"] or "").strip() or v.name
        if "brand_slug" in data:
            v.brand_slug = (data["brand_slug"] or "").strip()
        if "branch_ids" in data:
            v.branch_ids = data["branch_ids"] or []
        if "report_type" in data:
            v.report_type = data["report_type"] or "daily_sales"
        if "date_range_days" in data:
            v.date_range_days = int(data["date_range_days"] or 1)
        if data.get("is_default"):
            SavedView.objects.filter(user=request.user).exclude(pk=pk).update(is_default=False)
            v.is_default = True
        v.save()
        return Response({"id": v.id, "name": v.name, "brand_slug": v.brand_slug, "branch_ids": v.branch_ids})

    def delete(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            v = SavedView.objects.get(pk=pk, user=request.user)
        except SavedView.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        v.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
