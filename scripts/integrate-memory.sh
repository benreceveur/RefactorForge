#!/bin/bash

# RefactorForge Memory System Integration
# This script ensures RefactorForge is properly integrated with the Claude Memory System

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MEMORY_DIR="$HOME/.claude/memory"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
LOG_DIR="$HOME/.claude/logs"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔗 RefactorForge Memory Integration${NC}"
echo -e "${BLUE}===================================${NC}"
echo ""

# Function to check if a directory exists and create it if not
ensure_directory() {
    local dir=$1
    local description=$2
    
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}Creating $description directory: $dir${NC}"
        mkdir -p "$dir"
        return 1
    else
        echo -e "${GREEN}✓ $description directory exists: $dir${NC}"
        return 0
    fi
}

# Function to check if a file exists
check_file() {
    local file=$1
    local description=$2
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗ $description missing: $file${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $description exists: $file${NC}"
        return 0
    fi
}

# Function to check if memory system is responding
check_memory_api() {
    echo -e "${YELLOW}Checking Memory API server...${NC}"
    
    # Check if API server is running
    if curl -s http://localhost:3721/health >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Memory API server is responding${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ Memory API server not responding (may need to start)${NC}"
        return 1
    fi
}

# Function to update frontend API endpoint
update_frontend_config() {
    local api_file="$FRONTEND_DIR/src/services/api.js"
    
    if [ -f "$api_file" ]; then
        # Check current API URL
        local current_api=$(grep "API_BASE_URL.*=" "$api_file" | head -1)
        echo -e "${YELLOW}Current API config: ${current_api}${NC}"
        
        # Ensure it's pointing to port 3721
        if grep -q "3721" "$api_file"; then
            echo -e "${GREEN}✓ Frontend API configuration correct${NC}"
        else
            echo -e "${YELLOW}Updating frontend API configuration...${NC}"
            sed -i.backup 's/localhost:[0-9]*/localhost:3721/g' "$api_file"
            echo -e "${GREEN}✓ Frontend API updated to use localhost:3721${NC}"
        fi
    else
        echo -e "${RED}✗ Frontend API service file not found${NC}"
        return 1
    fi
}

# Function to create integration status file
create_status_file() {
    local status_file="$LOG_DIR/integration-status.json"
    
    cat > "$status_file" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "refactorforge_path": "$SCRIPT_DIR",
  "memory_path": "$MEMORY_DIR",
  "frontend_path": "$FRONTEND_DIR",
  "log_path": "$LOG_DIR",
  "integration_version": "2.0",
  "api_endpoint": "http://localhost:3721",
  "frontend_endpoint": "http://localhost:8745",
  "services": {
    "memory_api": {
      "port": 3721,
      "path": "$MEMORY_DIR/integrations/api-server/server.js"
    },
    "frontend": {
      "port": 8745,
      "path": "$FRONTEND_DIR"
    },
    "webhook": {
      "port": 4000,
      "path": "$MEMORY_DIR/integrations/webhooks"
    }
  },
  "startup_scripts": {
    "start": "$SCRIPT_DIR/start-refactorforge.sh",
    "stop": "$SCRIPT_DIR/stop-refactorforge.sh",
    "status": "$SCRIPT_DIR/status-refactorforge.sh",
    "background": "$SCRIPT_DIR/background-launcher.sh"
  }
}
EOF
    
    echo -e "${GREEN}✓ Integration status saved to $status_file${NC}"
}

# Start integration checks
echo "1. Checking directory structure..."
ensure_directory "$MEMORY_DIR" "Memory system"
ensure_directory "$FRONTEND_DIR" "Frontend"
ensure_directory "$LOG_DIR" "Logs"
ensure_directory "$LOG_DIR/pids" "Process IDs"

echo ""
echo "2. Checking core files..."
check_file "$MEMORY_DIR/integrations/api-server/server.js" "Memory API server"
check_file "$FRONTEND_DIR/package.json" "Frontend package.json"
check_file "$FRONTEND_DIR/src/services/api.js" "Frontend API service"

echo ""
echo "3. Checking startup scripts..."
check_file "$SCRIPT_DIR/start-refactorforge.sh" "Startup script"
check_file "$SCRIPT_DIR/stop-refactorforge.sh" "Stop script"
check_file "$SCRIPT_DIR/status-refactorforge.sh" "Status script"
check_file "$SCRIPT_DIR/background-launcher.sh" "Background launcher"

echo ""
echo "4. Checking Memory System components..."
check_file "$MEMORY_DIR/semantic-engine.js" "Semantic engine"
check_file "$MEMORY_DIR/async-memory-manager.js" "Async memory manager"
check_file "$MEMORY_DIR/cached-repo-detector.js" "Repository detector"

echo ""
echo "5. Checking API connectivity..."
check_memory_api

echo ""
echo "6. Updating configurations..."
update_frontend_config

echo ""
echo "7. Creating integration status..."
create_status_file

echo ""
echo -e "${BLUE}Integration Summary:${NC}"
echo -e "${BLUE}===================${NC}"
echo -e "RefactorForge Path: $SCRIPT_DIR"
echo -e "Memory System Path: $MEMORY_DIR"
echo -e "Frontend Path: $FRONTEND_DIR"
echo -e "Log Directory: $LOG_DIR"
echo ""
echo -e "${GREEN}Integration Complete!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Start services: ./start-refactorforge.sh"
echo -e "2. Check status:   ./status-refactorforge.sh"
echo -e "3. View frontend:  http://localhost:8745"
echo -e "4. Memory API:     http://localhost:3721/health"