"""
Module/Feature Configuration - تفعيل/إطفاء الأنظمة المعيارية.
جميع الأنظمة مربوطة بشجرة الحسابات وسجل الأخطاء المركزي.
"""
from django.core.cache import cache

MODULE_CRM_LOYALTY = "crm_loyalty"
MODULE_CENTRAL_KITCHEN = "central_kitchen"
MODULE_HRMS = "hrms"
MODULE_PROCUREMENT = "procurement"
MODULE_QUALITY = "quality"
MODULE_BI = "bi"

ALL_MODULES = [
    MODULE_CRM_LOYALTY,
    MODULE_CENTRAL_KITCHEN,
    MODULE_HRMS,
    MODULE_PROCUREMENT,
    MODULE_QUALITY,
    MODULE_BI,
]

MODULE_LABELS = {
    MODULE_CRM_LOYALTY: "CRM & الولاء",
    MODULE_CENTRAL_KITCHEN: "المطبخ المركزي & MRP",
    MODULE_HRMS: "الموارد البشرية المتقدمة",
    MODULE_PROCUREMENT: "المشتريات الإلكترونية",
    MODULE_QUALITY: "الجودة والتفتيش",
    MODULE_BI: "التقارير الذكية",
}


def is_module_enabled(module_key: str, brand_id: int | None = None) -> bool:
    """هل الوحدة مفعّلة؟ (على مستوى النظام أو العلامة)"""
    try:
        from org.models import ModuleConfig
        cache_key = f"module_{module_key}_{brand_id or 0}"
        val = cache.get(cache_key)
        if val is not None:
            return bool(val)
        cfg = ModuleConfig.objects.filter(module_key=module_key, brand_id=brand_id).first()
        if not cfg and brand_id:
            cfg = ModuleConfig.objects.filter(module_key=module_key, brand__isnull=True).first()
        if not cfg:
            cfg = ModuleConfig.objects.filter(module_key=module_key).first()
        result = cfg.is_enabled if cfg else True
        cache.set(cache_key, result, 300)
        return result
    except Exception:
        return True


def invalidate_module_cache(module_key: str) -> None:
    """إبطال الكاش بعد تغيير الإعدادات"""
    for key in [f"module_{module_key}_0", f"module_{module_key}_None"]:
        cache.delete(key)
