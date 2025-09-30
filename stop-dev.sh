#!/bin/bash

# RefactorForge Development Environment Stop Script
# Stops all RefactorForge services gracefully

# Configuration
BACKEND_PORT=${BACKEND_PORT:-8001}
FRONTEND_PORT=${FRONTEND_PORT:-8745}
MEMORY_API_PORT=${MEMORY_API_PORT:-3721}

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Stopping RefactorForge services...${NC}"

# Function to stop process on a port
stop_port() {
    local port=$1
    local name=$2
    
    if lsof -ti:$port > /dev/null 2>&1; then
        echo -e "Stopping $name on port $port..."
        lsof -ti:$port | xargs kill -TERM 2>/dev/null || true
        
        # Wait for graceful shutdown
        sleep 2
        
        # Force kill if still running
        if lsof -ti:$port > /dev/null 2>&1; then
            echo -e "${YELLOW}Force stopping $name...${NC}"
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✓${NC} $name stopped"
    else
        echo -e "${GREEN}✓${NC} $name not running"
    fi
}

# Stop all services
stop_port $FRONTEND_PORT "Frontend"
stop_port $BACKEND_PORT "Backend"
stop_port $MEMORY_API_PORT "Memory API"

# Clean up any PID files
if [ -d "logs" ]; then
    rm -f logs/pids_*.txt 2>/dev/null || true
fi

# Clean up any temporary files
if [ -d "tmp" ]; then
    echo "Cleaning temporary files..."
    rm -rf tmp/* 2>/dev/null || true
fi

echo -e "${GREEN}✅ All RefactorForge services stopped${NC}"