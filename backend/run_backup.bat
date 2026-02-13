@echo off
cd /d "%~dp0"
set DB_ENGINE=django.db.backends.sqlite3
if defined BACKUP_EXTERNAL_PATH set BACKUP_EXTERNAL_PATH=%BACKUP_EXTERNAL_PATH%
python manage.py backup %*
pause
