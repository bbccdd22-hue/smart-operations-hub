#!/bin/bash
# Production startup script for Smart Operations Hub
set -e

echo "🚀 Starting Smart Operations Hub - Production Mode"

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
python wait_for_db.py || exit 1

# Wait for Redis (optional — skip if no REDIS_URL)
echo "⏳ Waiting for Redis..."
python wait_for_redis.py || true

# Run migrations
echo "📊 Running migrations..."
python manage.py migrate --noinput

# Collect static files
echo "📦 Collecting static files..."
python manage.py collectstatic --noinput --clear || true

# Create demo tenant if first run
echo "🏢 Creating demo tenant..."
python manage.py create_demo_tenant || true

echo "✅ SmartOps ready! 🌟"
exec gunicorn config.wsgi:application --workers=3 --threads=4 --timeout=120 --bind 0.0.0.0:${PORT:-8000}
