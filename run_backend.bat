@echo off
cd /d "%~dp0backend"
if "%DJANGO_SECRET_KEY%"=="" (
  set DJANGO_SECRET_KEY=dev-secret-key-not-for-production
  set DJANGO_DEBUG=true
  echo [run_backend] Using dev DJANGO_SECRET_KEY. For production use .env with a real key.
)
echo Starting Django on http://127.0.0.1:8000 ...
echo API: http://127.0.0.1:8000/api/reports/executive-summary/
python manage.py runserver 0.0.0.0:8000 --noreload
