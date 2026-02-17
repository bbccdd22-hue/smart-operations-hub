@echo off
REM Run Django server with SQLite (no Postgres required) [Ref: 180508]
REM Binds to 0.0.0.0:8000 for LAN/mobile access (e.g. http://192.168.1.5:8000)
cd /d "%~dp0"
set USE_SQLITE=1
set FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.5:5173,http://192.168.195.113:5173,http://192.168.195.113:5174
python manage.py runserver 0.0.0.0:8000
