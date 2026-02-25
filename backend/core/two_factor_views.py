"""
2FA - التحقق الثنائي للوحة تحكم المالك.
"""
import base64
import io
import qrcode
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required

from core.permissions import get_user_profile
from org.models import UserRole


def _is_owner(user):
    profile = get_user_profile(user)
    return profile and profile.role == UserRole.OWNER


@login_required
@require_POST
def two_factor_setup_view(request):
    """
    تفعيل 2FA للمالك - يُرجع QR code للربط بتطبيق المصادقة.
    """
    if not _is_owner(request.user):
        return JsonResponse({"detail": "صلاحية المالك فقط"}, status=403)

    from django_otp.plugins.otp_totp.models import TOTPDevice

    user = request.user
    device = TOTPDevice.objects.filter(user=user).first()
    if device:
        return JsonResponse({
            "detail": "التحقق الثنائي مفعّل مسبقاً",
            "enabled": True,
        })

    device = TOTPDevice.objects.create(
        user=user,
        name="default",
        confirmed=False,
    )
    uri = device.config_url
    secret = base64.b32encode(device.bin_key).decode("utf-8").rstrip("=")

    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()

    return JsonResponse({
        "secret": secret,
        "qr_image": f"data:image/png;base64,{qr_base64}",
        "message": "امسح QR بتطبيق المصادقة (Google Authenticator أو Authy) ثم استدعِ /verify/ لتأكيد",
    })


@login_required
@require_POST
def two_factor_verify_view(request):
    """
    تأكيد رمز OTP - بعد المسح، أرسل الرمز ذو 6 أرقام.
    """
    import json
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    token = (data.get("token") or "").strip()
    if not token or len(token) != 6:
        return JsonResponse({"detail": "أرسل رمزاً من 6 أرقام"}, status=400)

    from django_otp import match_token

    user = request.user
    device = match_token(user, token)
    if not device:
        return JsonResponse({"detail": "رمز غير صحيح"}, status=400)

    device.confirmed = True
    device.save()
    request.session["otp_verified_at"] = str(user.pk)

    return JsonResponse({
        "verified": True,
        "message": "تم تفعيل التحقق الثنائي بنجاح",
    })


@login_required
@require_POST
def two_factor_validate_view(request):
    """
    التحقق من رمز OTP عند الدخول للوحة المالك.
    يُستدعى بعد تسجيل الدخول إذا كان التحقق الثنائي مفعّلاً.
    """
    import json
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    token = (data.get("token") or "").strip()
    if not token or len(token) != 6:
        return JsonResponse({"detail": "أرسل رمزاً من 6 أرقام"}, status=400)

    from django_otp import match_token

    user = request.user
    if not _is_owner(user):
        return JsonResponse({"detail": "صلاحية المالك فقط"}, status=403)

    device = match_token(user, token)
    if not device:
        return JsonResponse({"detail": "رمز غير صحيح"}, status=400)

    request.session["otp_verified_at"] = str(user.pk)

    return JsonResponse({
        "valid": True,
        "message": "تم التحقق بنجاح",
    })


@login_required
@require_GET
def two_factor_status_view(request):
    """هل التحقق الثنائي مفعّل للمستخدم الحالي؟"""
    from django_otp.plugins.otp_totp.models import TOTPDevice

    if not _is_owner(request.user):
        return JsonResponse({"enabled": False, "owner_only": True})

    device = TOTPDevice.objects.filter(user=request.user, confirmed=True).first()
    return JsonResponse({
        "enabled": bool(device),
        "owner_only": True,
    })
