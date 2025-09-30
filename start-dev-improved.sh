#!/bin/bash

# RefactorForge Development Environment Startup Script - Enhanced Version
# Starts Backend, Memory API, and Frontend with improved error handling

set -e  # Exit on any error

# Configuration
BACKEND_PORT=${BACKEND_PORT:-8001}
FRONTEND_PORT=${FRONTEND_PORT:-8745}
MEMORY_API_PORT=${MEMORY_API_PORT:-3721}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LOG_DIR="${SCRIPT_DIR}/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Logging functions
log_info() {
    echo -e "${GREEN}✓${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" >> "$LOG_DIR/startup_${TIMESTAMP}.log"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_DIR/startup_${TIMESTAMP}.log"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$LOG_DIR/startup_${TIMESTAMP}.log"
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18 or higher is required (found: $(node -v))"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check if packages are installed
    if [ ! -d "node_modules" ]; then
        log_warning "Dependencies not installed. Running npm install..."
        npm install
    fi
    
    if [ ! -d "backend/node_modules" ]; then
        log_warning "Backend dependencies not installed. Installing..."
        cd backend && npm install && cd ..
    fi
    
    if [ ! -d "frontend/node_modules" ]; then
        log_warning "Frontend dependencies not installed. Installing..."
        cd frontend && npm install && cd ..
    fi
    
    log_info "All dependencies checked"
}

# Check environment variables
check_environment() {
    log_info "Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            log_warning ".env file not found. Creating from .env.example..."
            cp .env.example .env
            log_warning "Please update .env with your configuration"
        else
            log_warning ".env file not found. Using default configuration"
        fi
    fi
    
    # Source .env file if it exists
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
    fi
}

# Kill processes on ports
cleanup_ports() {
    log_info "Cleaning up existing processes on ports $BACKEND_PORT, $FRONTEND_PORT, $MEMORY_API_PORT..."
    
    for port in $BACKEND_PORT $FRONTEND_PORT $MEMORY_API_PORT; do
        if lsof -ti:$port > /dev/null 2>&1; then
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            log_info "Cleaned up process on port $port"
        fi
    done
}

# Start service with health check
start_service() {
    local name=$1
    local command=$2
    local port=$3
    local health_endpoint=$4
    local timeout=${5:-30}
    local log_file="$LOG_DIR/${name}_${TIMESTAMP}.log"
    
    log_info "Starting $name on port $port..."
    
    # Start the service
    eval "$command" > "$log_file" 2>&1 &
    local pid=$!
    
    # Store PID for cleanup
    echo "$pid" >> "$LOG_DIR/pids_${TIMESTAMP}.txt"
    
    # Health check
    local counter=0
    while [ $counter -lt $timeout ]; do
        if curl -s "http://localhost:$port$health_endpoint" > /dev/null 2>&1; then
            log_info "$name is ready on port $port!"
            return 0
        fi
        
        # Check if process is still running
        if ! ps -p $pid > /dev/null; then
            log_error "$name process died unexpectedly. Check logs at: $log_file"
            tail -n 20 "$log_file"
            return 1
        fi
        
        counter=$((counter + 1))
        sleep 1
    done
    
    log_error "$name failed to start within $timeout seconds. Check logs at: $log_file"
    tail -n 20 "$log_file"
    return 1
}

# Build backend if necessary
build_backend() {
    log_info "Checking backend build..."
    
    if [ ! -d "backend/dist" ] || [ "backend/src" -nt "backend/dist" ]; then
        log_info "Building backend..."
        cd backend && npm run build && cd ..
    else
        log_info "Backend build is up to date"
    fi
}

# Main cleanup function
cleanup() {
    echo ""
    log_info "Shutting down all services..."
    
    # Kill all started processes
    if [ -f "$LOG_DIR/pids_${TIMESTAMP}.txt" ]; then
        while read pid; do
            kill $pid 2>/dev/null || true
        done < "$LOG_DIR/pids_${TIMESTAMP}.txt"
        rm "$LOG_DIR/pids_${TIMESTAMP}.txt"
    fi
    
    # Additional cleanup
    cleanup_ports
    
    log_info "All services stopped"
    log_info "Logs available at: $LOG_DIR"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM EXIT

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting RefactorForge Development Environment...${NC}"
    echo "Logs will be saved to: $LOG_DIR"
    echo ""
    
    # Pre-flight checks
    check_dependencies
    check_environment
    cleanup_ports
    build_backend
    
    # Start services
    if ! start_service "Backend" "cd backend && npm run dev" "$BACKEND_PORT" "/api/health" 30; then
        log_error "Failed to start Backend"
        exit 1
    fi
    
    # Check if Memory API directory exists
    MEMORY_API_DIR="/Users/benreceveur/.claude/memory/integrations/api-server"
    if [ -d "$MEMORY_API_DIR" ]; then
        if ! start_service "Memory API" "cd $MEMORY_API_DIR && node server.js" "$MEMORY_API_PORT" "/health" 30; then
            log_warning "Memory API failed to start, continuing without it"
        fi
    else
        log_warning "Memory API directory not found, skipping Memory API"
    fi
    
    # Start Frontend
    if ! start_service "Frontend" "cd frontend && npm run dev" "$FRONTEND_PORT" "/" 60; then
        log_error "Failed to start Frontend"
        exit 1
    fi
    
    # Display success message
    echo ""
    echo -e "${GREEN}🎉 RefactorForge is running!${NC}"
    echo ""
    echo -e "${BLUE}📱 Services:${NC}"
    echo "   Frontend:    http://localhost:$FRONTEND_PORT"
    echo "   Backend API: http://localhost:$BACKEND_PORT"
    if [ -d "$MEMORY_API_DIR" ]; then
        echo "   Memory API:  http://localhost:$MEMORY_API_PORT"
    fi
    echo ""
    echo -e "${BLUE}📊 Health Checks:${NC}"
    echo "   Backend: http://localhost:$BACKEND_PORT/api/health"
    if [ -d "$MEMORY_API_DIR" ]; then
        echo "   Memory:  http://localhost:$MEMORY_API_PORT/health"
    fi
    echo ""
    echo -e "${YELLOW}📁 Logs:${NC} $LOG_DIR"
    echo ""
    echo "Press Ctrl+C to stop all services"
    echo ""
    
    # Keep script running and monitor services
    while true; do
        sleep 5
        
        # Optional: Add service health monitoring here
        if ! curl -s "http://localhost:$BACKEND_PORT/api/health" > /dev/null 2>&1; then
            log_warning "Backend health check failed"
        fi
    done
}

# Run main function
main "$@"