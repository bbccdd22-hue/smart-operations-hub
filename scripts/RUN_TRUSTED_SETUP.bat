@echo off
cd /d "%~dp0.."
echo Registering project as trusted development directory...
powershell -ExecutionPolicy Bypass -File "%~dp0Register-TrustedDevPath.ps1"
echo.
pause
