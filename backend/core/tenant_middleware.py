"""
Tenant & Request Context Middleware
=====================================
Two responsibilities:
  1. Store the current HTTP request in thread-local for audit logging.
  2. Resolve the active Tenant from the request's subdomain and attach
     it to `request.tenant` (None on main domain or non-tenant requests).

Subdomain resolution logic
--------------------------
  Request host: "acme.smartops.com"
  BASE_DOMAIN setting: "smartops.com"
  Slug extracted: "acme"
  → looks up Tenant.objects.filter(slug="acme", is_active=True)

Backward-compatible: if no subdomain matches, request.tenant = None.
All existing views work unchanged (they don't use request.tenant yet).

Configuration (settings.py):
  SMARTOPS_BASE_DOMAIN = "smartops.com"   # or "localhost" in dev
"""
import threading

_request_local = threading.local()


def get_current_request():
    """Return the current HTTP request (from thread-local storage)."""
    return getattr(_request_local, "request", None)


def get_current_tenant():
    """Return the active Tenant for the current request, or None."""
    return getattr(_request_local, "tenant", None)


def get_current_tenant_org():
    """Legacy helper: returns the org_id from the current user's profile."""
    request = get_current_request()
    if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
        return None
    profile = getattr(request.user, "profile", None)
    if not profile:
        return None
    brand = getattr(profile, "brand", None)
    if brand and hasattr(brand, "organization"):
        return brand.organization_id
    return None


def _resolve_tenant_from_host(host: str):
    """
    Extract subdomain from host and return matching Tenant, or None.

    Examples:
      "acme.smartops.com"  → Tenant(slug="acme")
      "localhost:8000"     → None
      "smartops.com"       → None
      "acme.localhost"     → Tenant(slug="acme")  (for local dev)
    """
    from django.conf import settings

    # Strip port number
    host_without_port = host.split(":")[0]
    parts = host_without_port.split(".")

    # Need at least 2 parts for a subdomain (subdomain.domain)
    if len(parts) < 2:
        return None

    # The subdomain is the first part
    subdomain = parts[0]

    # Skip www, app, api, admin — reserved subdomains
    reserved = {"www", "app", "api", "admin", "mail", "smtp", "ftp", ""}
    if subdomain in reserved:
        return None

    # Skip if the host IS just the base domain with no subdomain
    base_domain = getattr(settings, "SMARTOPS_BASE_DOMAIN", "smartops.com")
    base_parts = base_domain.split(".")
    # e.g. host="smartops.com" → parts=["smartops","com"], base_parts same → no subdomain
    if parts == base_parts:
        return None

    try:
        from org.models import Tenant
        return Tenant.objects.select_related("organization", "admin_user").filter(
            slug=subdomain, is_active=True
        ).first()
    except Exception:  # noqa: BLE001 — don't crash on DB errors during middleware
        return None


class RequestContextMiddleware:
    """
    Attaches request and resolved tenant to thread-local.
    Runs for every request; always backward-compatible.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _request_local.request = request

        # ── Tenant resolution from subdomain ──────────────────────────────────
        host = request.get_host() or ""
        tenant = _resolve_tenant_from_host(host)
        _request_local.tenant = tenant
        request.tenant = tenant          # attach to request object directly

        try:
            response = self.get_response(request)
        finally:
            if hasattr(_request_local, "request"):
                del _request_local.request
            if hasattr(_request_local, "tenant"):
                del _request_local.tenant

        # Expose tenant slug in response header (useful for debugging)
        if tenant:
            response["X-Tenant"] = tenant.slug

        return response
