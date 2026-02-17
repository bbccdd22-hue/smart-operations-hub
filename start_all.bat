@echo off
cd /d "%~dp0"
title Smart Operations Hub - Launcher

echo ============================================
echo   Smart Operations Hub - Start All
echo ============================================
echo.
echo Backend  : http://127.0.0.1:8000  (Django)
echo Frontend : http://localhost:5173 (Vite)
echo.
echo Using --noreload for Django (more stable on Windows)
echo Close the Backend/Frontend windows to stop.
echo.
echo First run? Create owner: cd backend ^&^& python manage.py create_owner SAIF 123
echo.
echo Starting servers...
echo.

REM --noreload = أستقرار أفضل على Windows (يتجنب مشاكل مراقبة الملفات)
start "Backend" cmd /k "cd /d "%~dp0backend" && python manage.py runserver 0.0.0.0:8000 --noreload"

timeout /t 5 /nobreak >nul

start "Frontend" cmd /k "cd /d "%~dp0frontend" && set VITE_API_BASE=http://127.0.0.1:8000/api && npm run dev"

echo.
echo Both servers are running in separate windows.
echo If Backend stops: Check for Python errors in the Backend window.
echo If Frontend stops: Run "npm run dev" in frontend folder.
echo.
pause
