#!/bin/bash
# Render build script - run migrations after pip install
set -e
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput --clear
