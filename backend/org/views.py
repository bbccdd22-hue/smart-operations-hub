from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from core.permissions import (
    can_delete_chart_or_users,
    can_edit_chart_or_settings,
    get_user_profile,
    get_user_scope,
    is_read_only_role,
    is_super_admin,
)
from org.models import (
    ActivityLog,
    AdminNotification,
    Brand,
    Branch,
    BranchType,
    City,
    District,
    NotificationPreference,
    RolePermissionConfig,
    ROLE_PERMISSION_DEFAULTS,
    SavedView,
    UserProfile,
    UserRole,
)
from org.serializers import (
    BrandSerializer,
    BranchSerializer,
    BranchTypeSerializer,
    CitySerializer,
    DistrictSerializer,
)

User = get_user_model()
OWNER_EMAIL = "SAAL.NQ@ICLOUD.COM"  # Correct owner email for notifications


def _is_saif_owner(request):
    """عمليات حساسة (حذف، إعدادات) – سيف فقط."""
    return is_super_admin(request.user)


def _can_manage_admin_hub(request):
    """سيف، المالك، المدير العام – وصول لوحة الإدارة (مع قيود على الحذف)."""
    if not request.user or not request.user.is_authenticated:
        return False
    profile = get_user_profile(request.user)
    if not profile:
        return False
    if is_super_admin(request.user):
        return True
    return profile.role in (UserRole.OWNER, UserRole.GENERAL_MANAGER)


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
    if not saif_user or saif_user.username != "SAIF":
        return
    AdminNotification.objects.create(
        user=saif_user, event_type=event_type, title=title, message=message
    )


class CityListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CitySerializer

    def get_queryset(self):
        return City.objects.filter(is_active=True).order_by("name_en")

    def post(self, request, *args, **kwargs):
        """Create city (SAIF only). Expects: name_en, name_ar?, code? Auto-assigns CITY-01, CITY-02..."""
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        data = request.data or {}
        name_en = (data.get("name_en") or "").strip()
        name_ar = (data.get("name_ar") or "").strip()
        if not name_en:
            return Response({"detail": "name_en required"}, status=400)
        if City.objects.filter(name_en__iexact=name_en).exists():
            return Response({"detail": "City already exists"}, status=400)
        code_override = (data.get("code") or "").strip() or None
        if code_override and City.objects.filter(code=code_override).exists():
            return Response({"detail": "City code already in use. Choose a different code."}, status=400)
        try:
            with transaction.atomic():
                if code_override:
                    city = City.objects.create(name_en=name_en, name_ar=name_ar, code=code_override)
                else:
                    city = City.objects.create(name_en=name_en, name_ar=name_ar)
            return Response(CitySerializer(city).data, status=status.HTTP_201_CREATED)
        except IntegrityError:
            return Response(
                {"detail": "City code conflict. Try adding a custom code or a different name."},
                status=409,
            )
        except Exception as e:
            return Response(
                {"detail": str(e) if str(e) else "Database error while creating city"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CityClearView(views.APIView):
    """Force-delete ALL cities and districts (SAIF only). Table 100% empty. Next: CITY-01."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            with connection.cursor() as cursor:
                vendor = connection.vendor
                if vendor == "sqlite":
                    cursor.execute("PRAGMA foreign_keys = OFF")
                elif vendor == "postgresql":
                    cursor.execute("SET session_replication_role = replica")
                try:
                    cursor.execute("DELETE FROM org_district")
                    district_deleted = cursor.rowcount
                    cursor.execute("DELETE FROM org_city")
                    city_deleted = cursor.rowcount
                finally:
                    if vendor == "sqlite":
                        cursor.execute("PRAGMA foreign_keys = ON")
                    elif vendor == "postgresql":
                        cursor.execute("SET session_replication_role = DEFAULT")
            return Response({
                "detail": f"Deleted {city_deleted} city(ies) and {district_deleted} district(s). Cities table is EMPTY. Next city will be CITY-01.",
                "deleted_cities": city_deleted,
                "deleted_districts": district_deleted,
            })
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class DistrictListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = DistrictSerializer

    def get_queryset(self):
        qs = District.objects.select_related("city").filter(is_active=True).order_by("city__name_en", "name_en")
        city_id = self.request.query_params.get("city_id")
        if city_id:
            qs = qs.filter(city_id=city_id)
        return qs

    def post(self, request, *args, **kwargs):
        """Create district (SAIF only). Expects: city_id, name_en, name_ar?"""
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        data = request.data or {}
        city_id = data.get("city_id")
        name_en = (data.get("name_en") or "").strip()
        name_ar = (data.get("name_ar") or "").strip()
        if not city_id or not name_en:
            return Response({"detail": "city_id and name_en required"}, status=400)
        try:
            city = City.objects.get(pk=city_id)
        except City.DoesNotExist:
            return Response({"detail": "City not found"}, status=404)
        if District.objects.filter(city=city, name_en__iexact=name_en).exists():
            return Response({"detail": "District already exists for this city"}, status=400)
        district = District.objects.create(city=city, name_en=name_en, name_ar=name_ar)
        return Response(DistrictSerializer(district).data, status=status.HTTP_201_CREATED)


class BranchTypeListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = BranchTypeSerializer

    def get_queryset(self):
        return BranchType.objects.filter(is_active=True).order_by("name_en")

    def post(self, request, *args, **kwargs):
        """Create branch type (SAIF only). Expects: name_en, name_ar?"""
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        data = request.data or {}
        name_en = (data.get("name_en") or "").strip()
        name_ar = (data.get("name_ar") or "").strip()
        if not name_en:
            return Response({"detail": "name_en required"}, status=400)
        if BranchType.objects.filter(name_en__iexact=name_en).exists():
            return Response({"detail": "Branch type already exists"}, status=400)
        bt = BranchType.objects.create(name_en=name_en, name_ar=name_ar)
        return Response(BranchTypeSerializer(bt).data, status=status.HTTP_201_CREATED)


class CityDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            city = City.objects.get(pk=pk)
        except City.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        data = request.data or {}
        if "name_en" in data:
            city.name_en = (data["name_en"] or "").strip() or city.name_en
        if "name_ar" in data:
            city.name_ar = (data["name_ar"] or "").strip()
        city.save()
        return Response(CitySerializer(city).data)

    def delete(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            city = City.objects.get(pk=pk)
        except City.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        if city.branches.exists():
            return Response({"detail": "City has branches, cannot delete"}, status=400)
        city.is_active = False
        city.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DistrictDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            district = District.objects.get(pk=pk)
        except District.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        data = request.data or {}
        if "name_en" in data:
            district.name_en = (data["name_en"] or "").strip() or district.name_en
        if "name_ar" in data:
            district.name_ar = (data["name_ar"] or "").strip()
        if "city_id" in data:
            try:
                district.city = City.objects.get(pk=data["city_id"])
            except City.DoesNotExist:
                pass
        district.save()
        return Response(DistrictSerializer(district).data)

    def delete(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            district = District.objects.get(pk=pk)
        except District.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        if district.branches.exists():
            return Response({"detail": "District has branches, cannot delete"}, status=400)
        district.is_active = False
        district.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BranchTypeDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            bt = BranchType.objects.get(pk=pk)
        except BranchType.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        data = request.data or {}
        if "name_en" in data:
            bt.name_en = (data["name_en"] or "").strip() or bt.name_en
        if "name_ar" in data:
            bt.name_ar = (data["name_ar"] or "").strip()
        bt.save()
        return Response(BranchTypeSerializer(bt).data)

    def delete(self, request, pk):
        if not _is_saif_owner(request):
            return Response({"detail": "SAIF only"}, status=403)
        try:
            bt = BranchType.objects.get(pk=pk)
        except BranchType.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        if bt.branches.exists():
            return Response({"detail": "Branch type has branches, cannot delete"}, status=400)
        bt.is_active = False
        bt.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        name_ar = (request.data.get("name_ar") or "").strip()
        brand_code = (request.data.get("brand_code") or "").strip() or None
        if not name:
            return Response({"detail": "Name required"}, status=400)
        if Brand.objects.filter(name__iexact=name).exists():
            return Response({"detail": "Brand already exists"}, status=400)
        if brand_code and Brand.objects.filter(brand_code=brand_code).exists():
            return Response({"detail": "Brand code already exists"}, status=400)

        brand = Brand.objects.create(name=name, name_ar=name_ar or name, brand_code=brand_code or "")
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
                brand.save(update_fields=["name"])
        if "name_ar" in data:
            brand.name_ar = (data["name_ar"] or "").strip() or brand.name
            brand.save(update_fields=["name_ar"])
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
        qs = Branch.objects.select_related("brand", "city", "district", "branch_type").filter(is_active=True)
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
        district_id = data.get("district_id") or None
        branch_type_id = data.get("branch_type_id") or None
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

        district = None
        if district_id:
            try:
                district = District.objects.get(pk=district_id, city=city)
            except District.DoesNotExist:
                pass

        branch_type = None
        if branch_type_id:
            try:
                branch_type = BranchType.objects.get(pk=branch_type_id)
            except BranchType.DoesNotExist:
                pass

        code = code or (name.lower().replace(" ", "-")[:50])
        if Branch.objects.filter(brand=brand, code=code).exists():
            return Response({"detail": "Branch code already exists for this brand"}, status=400)
        if branch_code and Branch.objects.filter(brand=brand, branch_code=branch_code).exists():
            return Response({"detail": "Branch code already exists for this brand"}, status=400)

        branch = Branch.objects.create(
            brand=brand,
            city=city,
            district=district,
            branch_type=branch_type,
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
        if "district_id" in data:
            d_id = data["district_id"]
            if d_id:
                try:
                    branch.district = District.objects.get(pk=d_id, city=branch.city)
                except District.DoesNotExist:
                    branch.district = None
            else:
                branch.district = None
        if "branch_type_id" in data:
            bt_id = data["branch_type_id"]
            if bt_id:
                try:
                    branch.branch_type = BranchType.objects.get(pk=bt_id)
                except BranchType.DoesNotExist:
                    branch.branch_type = None
            else:
                branch.branch_type = None
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
                "brand_ids": list(profile.brand_ids) if getattr(profile, "brand_ids", None) else [],
                "all_brands": getattr(profile, "all_brands", False) or False,
                "employee_id": (profile.employee_id or "") if profile else "",
                "is_staff": u.is_staff,
                "is_active": u.is_active,
            })
        return Response(users)

    def post(self, request):
        """Create user – سيف أو المدير العام."""
        if is_read_only_role(get_user_profile(request.user)):
            return Response({"detail": "Read-only role"}, status=403)
        if not _can_manage_admin_hub(request):
            return Response({"detail": "Admin hub access required"}, status=403)

        data = request.data or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        email = (data.get("email") or "").strip()
        role = data.get("role") or "branch_supervisor"
        brand_ids = data.get("brand_ids") or []
        branch_ids = data.get("branch_ids") or []
        all_brands = bool(data.get("all_brands", False))

        if not username:
            return Response({"detail": "Username required"}, status=400)
        if not password:
            return Response({"detail": "Password required"}, status=400)
        if role not in ("owner", "general_manager", "brand_manager", "branch_supervisor", "external_accountant"):
            return Response({"detail": "Invalid role"}, status=400)

        # حماية الحساب الموحد: منع إنشاء saif (صغير) – المرجع الوحيد هو SAIF
        if username.lower() == "saif" and username != "SAIF":
            return Response({"detail": "Reserved: only SAIF (uppercase) is the system root account."}, status=400)

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
                branch = Branch.objects.select_related("brand").get(pk=branch_id)
            except Branch.DoesNotExist:
                pass
        bid = None
        b_ids = []
        if role == "brand_manager":
            if all_brands:
                bid = None
                b_ids = []
            else:
                b_ids = [int(x) for x in brand_ids if x] if isinstance(brand_ids, list) else []
                bid = b_ids[0] if b_ids else brand_id
        else:
            bid = brand_id
        profile = UserProfile.objects.create(
            user=user,
            role=role,
            brand_id=bid,
            branch_id=branch_id,
            all_brands=all_brands and role == "brand_manager",
            brand_ids=b_ids,
        )
        from org.services import generate_employee_id
        eid = generate_employee_id(profile)
        if eid:
            profile.employee_id = eid
            profile.save(update_fields=["employee_id"])
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
        "brand_ids": list(profile.brand_ids) if getattr(profile, "brand_ids", None) else [],
        "all_brands": getattr(profile, "all_brands", False) or False,
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
            if user.username == "SAIF":
                return Response({"detail": "Cannot freeze SAIF"}, status=400)
            user.is_active = bool(data["is_active"])
            user.save()
            if prev_active and not user.is_active:
                _notify_saif(request.user, "user_frozen", "Account frozen", f"User '{user.username}' was frozen.")
            elif not prev_active and user.is_active:
                _notify_saif(request.user, "user_activated", "Account activated", f"User '{user.username}' was reactivated.")

        profile, _ = UserProfile.objects.get_or_create(user=user, defaults={"role": UserRole.BRANCH_SUPERVISOR})

        profile_updated = False
        if any(k in data for k in ("role", "brand_id", "branch_id", "brand_ids", "all_brands", "phone", "employee_id", "preferred_language", "login_code")):
            if user.username == "SAIF":
                pass  # حماية جذر النظام: لا تعديل لأي بيانات بروفايل SAIF
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
                if "brand_ids" in data:
                    ids = data["brand_ids"]
                    profile.brand_ids = [int(x) for x in ids if x] if isinstance(ids, list) else []
                    profile_updated = True
                if "all_brands" in data:
                    profile.all_brands = bool(data["all_brands"]) and profile.role == UserRole.BRAND_MANAGER
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
                # Regenerate ID only if employee_id is empty [Ref: 2026-02-13]
                if not profile.employee_id and any(k in data for k in ("role", "brand_id", "branch_id", "brand_ids", "all_brands")):
                    profile.refresh_from_db()
                    profile = UserProfile.objects.select_related("branch__brand", "brand").get(pk=profile.pk)
                    from org.services import generate_employee_id
                    eid = generate_employee_id(profile)
                    if eid:
                        profile.employee_id = eid
                        profile.save(update_fields=["employee_id"])

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

        if profile_updated and any(k in data for k in ("email", "first_name", "last_name", "phone", "employee_id", "role", "brand_id", "branch_id", "brand_ids", "all_brands")):
            _notify_saif(request.user, "user_profile_updated", "User profile updated", f"Profile for '{user.username}' was updated.")

        return Response(_serialize_user_detail(user))

    def delete(self, request, pk):
        if not can_delete_chart_or_users(request.user):
            return Response({"detail": "سيف فقط – صلاحية حذف المستخدمين"}, status=403)

        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)

        if user.username == "SAIF":
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


class ActivityLogListView(views.APIView):
    """سجل الرقابة – سيف أو أدوار مُصرّح لها عبر إدارة الصلاحيات."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from core.permissions import _role_has_permission
        if is_super_admin(request.user):
            pass
        elif _role_has_permission(get_user_profile(request.user), "view_activity_log"):
            pass
        else:
            return Response({"detail": "هذه الخاصية متاحة فقط للمسؤول النظام أو الأدوار المُصرّح لها"}, status=403)
        limit = min(int(request.query_params.get("limit", 500)), 1000)
        logs = ActivityLog.objects.select_related("user").order_by("-created_at")[:limit]
        data = [
            {
                "id": L.id,
                "user_id": L.user_id,
                "username": L.user.username if L.user else "—",
                "action_type": L.action_type,
                "description": L.description,
                "page_path": L.page_path,
                "file_name": L.file_name,
                "target_model": L.target_model,
                "target_id": L.target_id,
                "ip_address": str(L.ip_address) if L.ip_address else "",
                "created_at": L.created_at.isoformat(),
            }
            for L in logs
        ]
        return Response({"logs": data})


class ActivityLogCreateView(views.APIView):
    """تسجيل حركة (صفحة، رفع ملف، إلخ) – يُستدعى من الواجهة."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        action_type = (data.get("action_type") or "page_view").strip() or "page_view"
        page_path = (data.get("page_path") or "").strip()[:256]
        description = (data.get("description") or "").strip()[:500]
        file_name = (data.get("file_name") or "").strip()[:255]
        target_model = (data.get("target_model") or "").strip()[:64]
        target_id = str(data.get("target_id") or "")[:64]
        from core.activity_log import log_activity

        log_activity(
            request.user,
            action_type=action_type,
            description=description,
            page_path=page_path,
            file_name=file_name,
            target_model=target_model,
            target_id=target_id,
            request=request,
        )
        return Response({"ok": True})


# صلاحيات الأدوار – سيف فقط
ALL_PERMISSION_KEYS = [
    "view_financial_reports",
    "upload_files",
    "view_activity_log",
    "edit_chart_of_accounts",
]


def _get_role_permissions(role: str) -> dict:
    """يرجع صلاحيات الدور من DB أو الافتراضية."""
    try:
        config = RolePermissionConfig.objects.get(role=role)
        perms = dict(config.permissions) if config.permissions else {}
    except RolePermissionConfig.DoesNotExist:
        perms = dict(ROLE_PERMISSION_DEFAULTS.get(role, {}))
    result = {}
    for k in ALL_PERMISSION_KEYS:
        result[k] = bool(perms.get(k, False))
    return result


class RolePermissionDetailView(views.APIView):
    """GET/PATCH صلاحيات دور – سيف فقط."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, role):
        if not _is_saif_owner(request):
            return Response({"detail": "هذه الخاصية متاحة فقط للمسؤول النظام"}, status=403)
        if role not in [r[0] for r in UserRole.choices]:
            return Response({"detail": "Invalid role"}, status=400)
        return Response({"role": role, "permissions": _get_role_permissions(role)})

    def patch(self, request, role):
        if not _is_saif_owner(request):
            return Response({"detail": "هذه الخاصية متاحة فقط للمسؤول النظام"}, status=403)
        if role not in [r[0] for r in UserRole.choices]:
            return Response({"detail": "Invalid role"}, status=400)
        data = request.data or {}
        perms = data.get("permissions", {})
        if not isinstance(perms, dict):
            return Response({"detail": "permissions must be object"}, status=400)
        config, _ = RolePermissionConfig.objects.get_or_create(role=role, defaults={"permissions": {}})
        current = dict(config.permissions) if config.permissions else {}
        for k in ALL_PERMISSION_KEYS:
            if k in perms:
                current[k] = bool(perms[k])
        config.permissions = current
        config.save()
        return Response({"role": role, "permissions": _get_role_permissions(role)})
