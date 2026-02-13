@echo off
REM Clear old Excel-imported sales data before re-uploading simplified file
cd /d "%~dp0"
set DJANGO_SETTINGS_MODULE=config.settings
python manage.py clear_sales_data --confirm
pause
