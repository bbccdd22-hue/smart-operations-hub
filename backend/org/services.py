"""
User Identity and Employee ID generation [Ref: 2026-02-13].
Prefix rules:
- AB (General Manager): all_brands=True or no specific brand assignment [Ref: 2026-02-13]
- BB (Brands Supervisor): one or more brands assigned via brand_ids [Ref: 2026-02-13]
- A/B (Branch Staff): single brand/single branch, 8oz->A, hemi->B [Ref: 2026-02-13]
Rule: Regenerate ID ONLY if employee_id is empty during role/brand/branch changes [Ref: 2026-02-13].
"""
import re
from org.models import UserProfile, UserRole


def _get_next_seq(prefix: str) -> int:
    """Get next sequence number for given prefix. Ensures uniqueness."""
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
    existing = UserProfile.objects.exclude(employee_id="").values_list("employee_id", flat=True)
    max_n = 0
    for eid in existing:
        if eid and eid.upper().startswith(prefix.upper()):
            m = pattern.match(eid)
            if m:
                max_n = max(max_n, int(m.group(1)))
    return max_n + 1


def _format_id(prefix: str, num: int) -> str:
    """Format ID as prefix + zero-padded number."""
    pad = 2 if len(prefix) <= 2 else 2
    return f"{prefix}{num:0{pad}d}"


def generate_employee_id(profile: UserProfile) -> str:
    """
    Auto-generate employee_id based on role and scope [Ref: 2026-02-13].
    Returns the generated ID; does not save.
    """
    role = (profile.role or "").lower()
    brand = profile.brand
    branch = profile.branch
    brand_slug = (branch.brand.slug if branch else (brand.slug if brand else "") or "").lower()
    brand_ids = list(profile.brand_ids) if hasattr(profile, "brand_ids") and profile.brand_ids else []
    is_all_brands = getattr(profile, "all_brands", False)

    if role == UserRole.OWNER:
        prefix = "AAA"
    elif role == UserRole.BRAND_MANAGER:
        if is_all_brands or (not profile.brand_id and not brand_ids):
            prefix = "AB"  # General Manager [Ref: 2026-02-13]
        else:
            prefix = "BB"  # Brands Supervisor: one+ brands via brand_ids [Ref: 2026-02-13]
    elif role == UserRole.BRANCH_SUPERVISOR and branch:
        # Branch Staff (Single Brand assigned) [Ref: 2026-02-13]
        if brand_slug == "8oz":
            prefix = "A"  # e.g. A01
        elif brand_slug == "hemi":
            prefix = "B"  # e.g. B01
        else:
            prefix = "X"  # Other brands
    else:
        return ""

    next_seq = _get_next_seq(prefix)
    return _format_id(prefix, next_seq)
