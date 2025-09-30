#!/bin/bash

# RefactorForge Non-Blocking Startup Script
# This script launches RefactorForge services completely in the background
# No blocking operations, no browser opening, no sleep delays

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
MEMORY_API_SERVER="$HOME/.claude/memory/integrations/api-server"
LOG_DIR="$HOME/.claude/logs"
PID_DIR="$LOG_DIR/pids"

# Set Node.js and npm paths (using NVM)
export PATH="/Users/benreceveur/.nvm/versions/node/v20.19.4/bin:$PATH"
NODE_BIN="/Users/benreceveur/.nvm/versions/node/v20.19.4/bin/node"
NPM_BIN="/Users/benreceveur/.nvm/versions/node/v20.19.4/bin/npm"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create required directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Check if running in background mode (launched by LaunchAgent)
BACKGROUND_MODE="${REFACTORFORGE_BACKGROUND:-false}"

# Only show output if not in background mode
if [ "$BACKGROUND_MODE" != "true" ]; then
    echo -e "${GREEN}🚀 Starting RefactorForge (non-blocking mode)...${NC}"
fi

# Function to check if a port is in use
check_port() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Function to start a service (completely non-blocking)
start_service() {
    local name=$1
    local dir=$2
    local command=$3
    local port=$4
    local log_file="$LOG_DIR/$name.log"
    local pid_file="$PID_DIR/$name.pid"
    
    # Show output only if not in background mode
    if [ "$BACKGROUND_MODE" != "true" ]; then
        echo -e "${YELLOW}Starting $name...${NC}"
    fi
    
    # Check if already running
    if [ -f "$pid_file" ]; then
        local existing_pid=$(cat "$pid_file")
        if ps -p "$existing_pid" > /dev/null 2>&1; then
            if [ "$BACKGROUND_MODE" != "true" ]; then
                echo -e "${YELLOW}⚠️  $name already running (PID: $existing_pid)${NC}"
            fi
            return 0
        else
            # Remove stale PID file
            rm -f "$pid_file"
        fi
    fi
    
    # Check if port is in use by another process
    if check_port $port; then
        if [ "$BACKGROUND_MODE" != "true" ]; then
            echo -e "${YELLOW}⚠️  Port $port in use (possibly $name is already running)${NC}"
        fi
        return 0
    fi
    
    # Start the service in background
    if [ -d "$dir" ]; then
        cd "$dir"
        # Use double backgrounding to fully detach from parent
        (nohup $command > "$log_file" 2>&1 & echo $! > "$pid_file") &
        
        # Brief check without blocking
        sleep 0.1
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if [ "$BACKGROUND_MODE" != "true" ]; then
                echo -e "${GREEN}✓ $name starting (PID: $pid, Port: $port, Log: $log_file)${NC}"
            fi
            return 0
        else
            if [ "$BACKGROUND_MODE" != "true" ]; then
                echo -e "${RED}✗ Failed to start $name - check $log_file${NC}"
            fi
            return 1
        fi
    else
        if [ "$BACKGROUND_MODE" != "true" ]; then
            echo -e "${RED}✗ Directory not found: $dir${NC}"
        fi
        return 1
    fi
}

# Start all services
SERVICES_STARTED=0

# Start RefactorForge Backend API Service (port 8001)
BACKEND_DIR="$SCRIPT_DIR/backend"
if [ -f "$BACKEND_DIR/dist/index.js" ]; then
    start_service "RefactorForge-Backend" "$BACKEND_DIR" "$NODE_BIN dist/index.js" 8001
    SERVICES_STARTED=$((SERVICES_STARTED + 1))
else
    if [ "$BACKGROUND_MODE" != "true" ]; then
        echo -e "${YELLOW}RefactorForge backend not found at $BACKEND_DIR/dist/index.js${NC}"
        echo -e "${YELLOW}Run 'cd $BACKEND_DIR && npm run build' to build the backend${NC}"
    fi
fi

# Start Memory API Service (optional secondary backend)
if [ -f "$MEMORY_API_SERVER/server.js" ]; then
    start_service "Memory-API" "$MEMORY_API_SERVER" "$NODE_BIN server.js" 3721
    SERVICES_STARTED=$((SERVICES_STARTED + 1))
else
    if [ "$BACKGROUND_MODE" != "true" ]; then
        echo -e "${YELLOW}Memory API server not found at $MEMORY_API_SERVER/server.js${NC}"
    fi
fi

# Start Frontend (React App) on port 8745
if [ -d "$FRONTEND_DIR" ] && [ -f "$FRONTEND_DIR/package.json" ]; then
    start_service "RefactorForge-Frontend" "$FRONTEND_DIR" "$NPM_BIN run start" 8745
    SERVICES_STARTED=$((SERVICES_STARTED + 1))
else
    if [ "$BACKGROUND_MODE" != "true" ]; then
        echo -e "${YELLOW}Frontend directory not found or invalid at $FRONTEND_DIR${NC}"
    fi
fi

# Optional: Start GitHub Webhook Service (if exists)
if [ -f "$HOME/.claude/memory/integrations/webhooks/github-webhook-server.js" ]; then
    start_service "GitHub-Webhook" "$HOME/.claude/memory/integrations/webhooks" "node github-webhook-server.js" 4000
    SERVICES_STARTED=$((SERVICES_STARTED + 1))
fi

# Show results only if not in background mode
if [ "$BACKGROUND_MODE" != "true" ]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}RefactorForge startup initiated (${SERVICES_STARTED} services)${NC}"
    echo ""
    echo -e "📍 Backend API:     http://localhost:8001"
    echo -e "📍 Frontend:        http://localhost:8745"
    echo -e "📍 Memory API:      http://localhost:3721 (optional)"
    echo -e "📍 GitHub Webhook:  http://localhost:4000 (optional)"
    echo ""
    echo -e "📁 Logs:            $LOG_DIR"
    echo -e "📁 PIDs:            $PID_DIR"
    echo ""
    echo -e "Commands:"
    echo -e "  Status:           $SCRIPT_DIR/status-refactorforge.sh"
    echo -e "  Stop:             $SCRIPT_DIR/stop-refactorforge.sh"
    echo -e "  Logs:             tail -f $LOG_DIR/*.log"
    echo ""
    echo -e "${GREEN}Services starting in background - no browser will open${NC}"
    echo -e "Visit http://localhost:8745 when ready (check logs for startup status)"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
else
    # Background mode: Log to file instead of stdout
    echo "$(date): RefactorForge background startup initiated ($SERVICES_STARTED services)" >> "$LOG_DIR/startup.log"
fi

# Exit immediately - no waiting, no browser opening
exit 0