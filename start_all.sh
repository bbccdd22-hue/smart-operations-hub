#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "Python is not installed. Install Python 3 and retry."
  exit 1
fi

echo "============================================"
echo "  Smart Operations Hub - Start All"
echo "============================================"
echo ""
echo "Python   : ${PYTHON_BIN}"
echo "Backend  : http://0.0.0.0:8000  (Django)"
echo "Frontend : http://0.0.0.0:5173 (Vite)"
echo ""
echo "Local:    http://localhost:5173"
echo "Network:  http://$(hostname -I 2>/dev/null | awk '{print $1}'):5173"
echo ""

# One-time safety bootstrap for local dev:
# - applies migrations (fixes 'no such table: auth_user')
# - ensures owner user exists (SAIF / 123)
echo "Preparing backend (migrate + owner user)..."
(
  cd backend
  "${PYTHON_BIN}" manage.py migrate --noinput
  "${PYTHON_BIN}" manage.py create_owner SAIF 123
)

# Start backend in background
cd backend && "${PYTHON_BIN}" manage.py runserver 0.0.0.0:8000 --noreload &
BACKEND_PID=$!
cd ..

sleep 3

# Start frontend (Vite uses --host from package.json script)
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

cleanup() {
  kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "Backend PID: ${BACKEND_PID} | Frontend PID: ${FRONTEND_PID}"
echo "Press Ctrl+C to stop both."
wait
