#!/bin/bash

# RefactorForge Development Environment Startup Script
# Starts Backend, Memory API, and the full Memory Dashboard as the frontend

set -e  # Exit on any error

echo "🚀 Starting RefactorForge Development Environment..."

# Kill any existing processes on our ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:8745,8001,3722 | xargs -r kill -9 2>/dev/null || true

# Build backend first (required for production start)
echo "🔨 Building backend..."
cd backend && npm run build && cd ..

# Start RefactorForge Backend (port 3721)
echo "⚡ Starting RefactorForge Backend (dev mode on port 8001)..."
cd backend && export $(cat .env | xargs) && npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
        echo "✅ RefactorForge Backend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend failed to start within 30 seconds"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Start Memory API Server (port 3722)
echo "🧠 Starting Memory API Server (port 3722)..."
cd /Users/benreceveur/.claude/memory/integrations/api-server && node server.js &
MEMORY_API_PID=$!
cd /Users/benreceveur/GitHub/RefactorForge

# Wait for Memory API to be ready
echo "⏳ Waiting for Memory API to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3722/health > /dev/null 2>&1; then
        echo "✅ Memory API is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Memory API failed to start within 30 seconds"
        kill $BACKEND_PID $MEMORY_API_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Start RefactorForge Frontend (Memory Dashboard on port 8745)
echo "🎨 Starting RefactorForge Frontend (port 8745)..."
cd frontend && npm start &
FRONTEND_PID=$!
cd /Users/benreceveur/GitHub/RefactorForge

# Wait for frontend to be ready
echo "⏳ Waiting for RefactorForge Frontend to be ready..."
for i in {1..60}; do
    if curl -s http://localhost:8745 > /dev/null 2>&1; then
        echo "✅ RefactorForge Frontend is ready!"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "❌ Frontend failed to start within 60 seconds"
        kill $BACKEND_PID $MEMORY_API_PID $FRONTEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

echo ""
echo "🎉 RefactorForge is running!"
echo ""
echo "📱 RefactorForge Frontend: http://localhost:8745"
echo "   Features: Semantic Search, Pattern Storage, Analytics,"
echo "            GitHub Integration, Memory Timeline, Code Improvements"
echo ""
echo "🔧 RefactorForge Backend:  http://localhost:3721"
echo "🧠 Memory API Server:      http://localhost:3722"
echo ""
echo "💚 Health Checks:"
echo "   - Backend: http://localhost:3721/api/health"
echo "   - Memory:  http://localhost:3722/health"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    kill $BACKEND_PID $MEMORY_API_PID $FRONTEND_PID 2>/dev/null || true
    lsof -ti:8745,8001,3722 | xargs -r kill -9 2>/dev/null || true
    echo "✅ All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running
wait