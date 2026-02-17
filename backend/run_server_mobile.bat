@echo off
REM Run backend for mobile/ZeroTier: 0.0.0.0:8000, CORS for 192.168.195.113
cd /d "%~dp0"
set USE_SQLITE=1
set FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.5:5173,http://192.168.195.113:5173,http://192.168.195.113:5174
python manage.py runserver 0.0.0.0:8000
pause
