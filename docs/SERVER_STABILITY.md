# استقرار السيرفرات | Server Stability Guide

## أسباب توقف السيرفرات الشائعة

### 1. مراقبة الملفات (Django Auto-reload)
- **المشكلة:** Django يراقب تغيير الملفات ويعيد التشغيل تلقائياً. على Windows قد يسبب استهلاك موارد أو توقف.
- **الحل:** تشغيل Django مع `--noreload`:
  ```bash
  python manage.py runserver 0.0.0.0:8000 --noreload
  ```
- **ملاحظة:** التعديلات على الكود لن تُطبّق تلقائياً؛ أعد تشغيل السيرفر يدوياً عند التعديل.

### 2. إغلاق نافذة الطرفية
- **المشكلة:** إغلاق نافذة CMD/ PowerShell يوقِف العملية.
- **الحل:** استخدم `start_all.bat` الذي يفتح نوافذ منفصلة. لا تغلق نافذة "Backend" أو "Frontend".

### 3. الخطأ في الكود (Unhandled Exception)
- **المشكلة:** استثناء غير مُعالَج يوقف Django.
- **الحل:** راجع رسالة الخطأ في نافذة Backend. أصلح الكود وأعد التشغيل.

### 4. المنفذ مستخدم (Port in Use)
- **المشكلة:** منفذ 8000 أو 5173 مستخدم من عملية أخرى.
- **الحل:**
  ```powershell
  # البحث عن العملية على المنفذ 8000
  netstat -ano | findstr :8000
  # إنهاء العملية (استبدل PID برقم العملية)
  taskkill /PID <رقم_العملية> /F
  ```

### 5. مشاكل قاعدة البيانات
- **المشكلة:** SQLite مقفل أو تالف.
- **الحل:** أغلق جميع التطبيقات التي تستخدم قاعدة البيانات، أو احذف `db.sqlite3` وأعد تشغيل الهجرات (بعد نسخ احتياطي).

---

## تشغيل مستقر مُقترح

### Option A: استخدام start_all.bat (محدّث)
- يستخدم `--noreload` للـ Backend
- يفتح نوافذ منفصلة تبقى مفتوحة

### Option B: التشغيل يدوياً في طرفيتين
```bash
# الطرفية 1 - Backend
cd backend
python manage.py runserver 0.0.0.0:8000 --noreload

# الطرفية 2 - Frontend
cd frontend
set VITE_API_BASE=http://127.0.0.1:8000/api
npm run dev
```

### Option C: استخدام PM2 (للاستمرارية)
```bash
npm install -g pm2

# تشغيل Backend
cd backend
pm2 start "python manage.py runserver 0.0.0.0:8000 --noreload" --name backend

# تشغيل Frontend
cd frontend
pm2 start "npm run dev" --name frontend

# عرض الحالة
pm2 status

# إيقاف
pm2 stop all
```

---

## نصائح إضافية

1. **لا تضع الجهاز في وضع السكون** أثناء تشغيل السيرفرات.
2. **مضاد الفيروسات:** قد يوقف العمليات؛ أضف مجلد المشروع للاستثناءات إن لزم.
3. **الذاكرة:** تأكد من وجود مساحة كافية في الذاكرة.
