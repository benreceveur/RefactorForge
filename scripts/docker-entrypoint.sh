#!/bin/sh

# Docker entrypoint script for RefactorForge

echo "Starting RefactorForge services..."

# Start backend
echo "Starting backend on port 3721..."
cd /app/backend && node dist/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend..."
for i in $(seq 1 30); do
    if nc -z localhost 3721; then
        echo "Backend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Backend failed to start"
        exit 1
    fi
    sleep 1
done

# Start frontend
echo "Starting frontend on port 8000..."
serve -s /app/frontend/build -l 8000 &
FRONTEND_PID=$!

echo "RefactorForge is running!"
echo "Frontend: http://localhost:8000"
echo "Backend:  http://localhost:3721"

# Wait for any process to exit
wait $BACKEND_PID $FRONTEND_PID