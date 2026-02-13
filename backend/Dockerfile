# Smart Operations Hub - Backend [Ref: Render 24/7]
FROM python:3.11-slim

WORKDIR /app

# Install system deps for psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN python manage.py collectstatic --noinput 2>/dev/null || true

EXPOSE 8000
ENV PORT=8000
# Run migrate + seed_brands on start; then gunicorn (Render sets PORT)
CMD sh -c "python manage.py migrate --noinput 2>/dev/null || true && python manage.py seed_brands 2>/dev/null || true && exec gunicorn config.wsgi:application --bind 0.0.0.0:$${PORT:-8000} --workers 2 --threads 4"
