#!/bin/bash
cd "$(dirname "$0")"

echo "============================================"
echo "  Smart Operations Hub - Start All"
echo "============================================"
echo ""
echo "Backend  : http://0.0.0.0:8000  (Django)"
echo "Frontend : http://0.0.0.0:5173 (Vite)"
echo ""
echo "Local:    http://localhost:5173"
echo "Network:  http://$(hostname -I 2>/dev/null | awk '{print $1}'):5173"
echo ""

# Start backend in background
cd backend && python manage.py runserver 0.0.0.0:8000 &
BACKEND_PID=$!
cd ..

sleep 3

# Start frontend (Vite uses --host from config)
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Backend PID: $BACKEND_PID | Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both."
wait
