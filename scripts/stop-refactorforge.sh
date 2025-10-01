#!/bin/bash

# RefactorForge Stop Script
# This script stops all RefactorForge services

LOG_DIR="$HOME/.claude/logs"
PID_DIR="$LOG_DIR/pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Stopping RefactorForge services...${NC}"

# Function to stop a service
stop_service() {
    local name=$1
    local pid_file="$PID_DIR/$name.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping $name (PID: $pid)...${NC}"
            kill $pid
            sleep 1
            
            # Force kill if still running
            if ps -p $pid > /dev/null 2>&1; then
                kill -9 $pid
            fi
            
            echo -e "${GREEN}✓ $name stopped${NC}"
        else
            echo -e "${YELLOW}$name was not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}No PID file found for $name${NC}"
    fi
}

# Stop all services
stop_service "Memory-API"
stop_service "RefactorForge-Frontend"
stop_service "GitHub-Webhook"
stop_service "background-launcher"

# Also check for any processes on our ports
echo -e "${YELLOW}Checking for remaining processes on ports...${NC}"

for port in 3721 8745 4000; do
    pid=$(lsof -ti :$port)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}Found process on port $port (PID: $pid), stopping...${NC}"
        kill $pid 2>/dev/null
    fi
done

echo -e "${GREEN}✓ All RefactorForge services stopped${NC}"