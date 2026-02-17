# Handoff – System Settings & Branch Creation (Feb 11, 2025)

## ✅ ما تم إنجازه

### Backend (Django)
- **النماذج** (`backend/org/models.py`):
  - City: إضافة `option_code` (مثال: CITY-01)
  - District: نموذج جديد مع FK للـ City و `option_code` (DIST-01)
  - BranchType: نموذج جديد مع `option_code` (TYPE-01)
  - Branch: إضافة حقول اختيارية `district` و `branch_type` (FK)
- **المسارات (API)**: `cities/<pk>/`, `districts/`, `districts/<pk>/`, `branch-types/`, `branch-types/<pk>/`
- **الميجرات**: `0009_add_system_options_district_branch_type.py`, `0010_seed_branch_types.py`

### Frontend
- **SearchableSelect**: قائمة منسدلة قابلة للبحث بتصميم Aqua Glass
- **AddBranchModal**: اختيار المدينة، الحي (حسب المدينة)، ونوع الفرع
- **SystemOptionsPage**: صفحة إدارة خيارات النظام (مدن، أحياء، أنواع الفروع) على `/admin-hub/system-options`
- **i18n**: إضافة "خيارات النظام" / "System Options"

## ✅ إعادة تصميم صفحة تسجيل الدخول (Feb 2025)

- **Glassmorphism**: بطاقة شفافة مع `backdrop-filter: blur(25px)` وحدود Emerald خفيفة
- **Aqua Glass**: حقول إدخال شفافة مع نص واضح
- **Light/Dark**: وضع فاتح Pearlescent، وضع داكن
- **Responsive**: ارتفاع 48px للحقول للمس، تدعم iPad والجوال
- **Selection**: تمييز Aqua خفيف لا يخفي النص (عبر ::selection)

---

## ⏳ ما يتبقى للمتابعة غداً

1. **نموذج إضافة المستخدم**: إضافة اختيار المدينة/الحي إذا كان مرتبطاً بالمستخدم.
2. **نموذج إضافة العلامة**: لم يُطلب تعديله.
3. **التقارير المالية (FIN-D01)**: ربط الفلترة بـ `district_id` و `branch_type_id`.
4. **صفحة خيارات النظام**: إضافة واجهة تعديل وحذف للخيارات (الـ API يدعمها).

## تشغيل المشروع

```bash
python run_smart.py   # يتحقق من المنافذ، يشغل Backend + Frontend على 0.0.0.0
```

أو يدوياً:
```bash
cd backend && python manage.py runserver 0.0.0.0:8000
cd frontend && npm run dev -- --host
```

## Safety Locks (منع ERR_CONNECTION_REFUSED)

- **API Base**: ثابت على `http://172.23.135.143:8000/api` في .env و api.ts
- **Django**: ALLOWED_HOSTS و CORS تتضمن 172.23.135.143
- **استعادة الإعدادات**: `python restore_config.py` من مجلد config_backup
- **run_smart.py**: يفحص المنافذ 8000 و 5173 قبل التشغيل

## المسارات الرئيسية

| المسار | الوصف |
|--------|--------|
| `/admin-hub/system-options` | إدارة المدن، الأحياء، أنواع الفروع |
| Add Branch Modal | يظهر عند إضافة فرع جديد – المدينة، الحي، نوع الفرع |

---
*آخر تحديث: 11 فبراير 2025*
