#!/bin/bash

# RefactorForge Status Script
# Check the status of all RefactorForge services

LOG_DIR="$HOME/.claude/logs"
PID_DIR="$LOG_DIR/pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 RefactorForge Service Status${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Function to check service status
check_service() {
    local name=$1
    local port=$2
    local pid_file="$PID_DIR/$name.pid"
    local log_file="$LOG_DIR/$name.log"
    
    echo -e "${YELLOW}$name:${NC}"
    
    # Check PID file
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "  Status: ${GREEN}Running${NC} (PID: $pid)"
            
            # Check if port is listening
            if lsof -i :$port > /dev/null 2>&1; then
                echo -e "  Port $port: ${GREEN}Listening${NC}"
                echo -e "  Health: ${GREEN}http://localhost:$port${NC}"
            else
                echo -e "  Port $port: ${YELLOW}Not listening${NC}"
            fi
            
            # Show recent log activity
            if [ -f "$log_file" ] && [ -s "$log_file" ]; then
                local last_log=$(tail -1 "$log_file" 2>/dev/null)
                echo -e "  Last log: ${last_log:0:80}..."
            fi
        else
            echo -e "  Status: ${RED}Dead${NC} (stale PID: $pid)"
            rm -f "$pid_file"  # Clean up stale PID
        fi
    else
        echo -e "  Status: ${RED}Not running${NC}"
        
        # Check if something else is using the port
        if lsof -i :$port > /dev/null 2>&1; then
            echo -e "  Port $port: ${YELLOW}In use by other process${NC}"
        fi
    fi
    
    # Show log file status
    if [ -f "$log_file" ]; then
        local log_size=$(wc -l < "$log_file" 2>/dev/null || echo "0")
        local log_age=$(stat -f %Sm -t %H:%M "$log_file" 2>/dev/null || echo "unknown")
        echo -e "  Log: $log_file (${log_size} lines, last updated: ${log_age})"
    else
        echo -e "  Log: ${YELLOW}No log file${NC}"
    fi
    
    echo ""
}

# Check all services
check_service "Memory-API" 3721
check_service "RefactorForge-Frontend" 8745
check_service "GitHub-Webhook" 4000

# System overview
echo -e "${BLUE}System Overview:${NC}"
echo -e "${BLUE}=================${NC}"

# Count running services
running_services=0
total_services=3

for service in "Memory-API" "RefactorForge-Frontend" "GitHub-Webhook"; do
    pid_file="$PID_DIR/$service.pid"
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            running_services=$((running_services + 1))
        fi
    fi
done

echo -e "Services: ${running_services}/${total_services} running"

# Check memory API connectivity
if curl -s http://localhost:3721/health > /dev/null 2>&1; then
    echo -e "Memory API: ${GREEN}Responsive${NC}"
else
    echo -e "Memory API: ${RED}Not responding${NC}"
fi

# Check frontend connectivity
if curl -s http://localhost:8745 > /dev/null 2>&1; then
    echo -e "Frontend: ${GREEN}Responsive${NC}"
else
    echo -e "Frontend: ${RED}Not responding${NC}"
fi

# Show disk usage
if [ -d "$LOG_DIR" ]; then
    log_size=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)
    echo -e "Log size: $log_size"
fi

echo ""
echo -e "${BLUE}Commands:${NC}"
echo -e "  Start:    ./start-refactorforge.sh"
echo -e "  Stop:     ./stop-refactorforge.sh" 
echo -e "  Logs:     tail -f $LOG_DIR/*.log"
echo -e "  Restart:  ./stop-refactorforge.sh && ./start-refactorforge.sh"