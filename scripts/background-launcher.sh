#!/bin/bash

# RefactorForge Background Launcher
# This script ensures complete background operation and prevents any terminal interference

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$HOME/.claude/logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Function to run completely detached from any terminal
run_detached() {
    # Set environment for background operation
    export REFACTORFORGE_BACKGROUND=true
    
    # Redirect all I/O and run in a new session
    nohup setsid "$SCRIPT_DIR/start-refactorforge.sh" \
        </dev/null \
        >>"$LOG_DIR/background-launcher.log" \
        2>>"$LOG_DIR/background-launcher-error.log" &
    
    # Write launcher PID for monitoring
    echo $! > "$LOG_DIR/pids/background-launcher.pid"
    
    # Log the launch
    echo "$(date): RefactorForge background launcher started (PID: $!)" >> "$LOG_DIR/background-launcher.log"
}

# Check if already running (prevent multiple instances)
LAUNCHER_PID_FILE="$LOG_DIR/pids/background-launcher.pid"
if [ -f "$LAUNCHER_PID_FILE" ]; then
    EXISTING_PID=$(cat "$LAUNCHER_PID_FILE")
    if ps -p "$EXISTING_PID" > /dev/null 2>&1; then
        echo "$(date): Background launcher already running (PID: $EXISTING_PID)" >> "$LOG_DIR/background-launcher.log"
        exit 0
    else
        # Clean up stale PID
        rm -f "$LAUNCHER_PID_FILE"
    fi
fi

# Run completely detached
run_detached

# Exit immediately (don't wait for anything)
exit 0