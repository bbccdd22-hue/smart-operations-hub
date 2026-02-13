@echo off
REM Run Django server with SQLite (no Postgres required) [Ref: 180508]
cd /d "%~dp0"
set USE_SQLITE=1
python manage.py runserver
