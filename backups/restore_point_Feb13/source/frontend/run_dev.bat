@echo off
REM Start Vite frontend dev server (host 0.0.0.0 for LAN/mobile access)
cd /d "%~dp0"
call npm run dev
pause
