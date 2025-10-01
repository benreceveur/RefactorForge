# RefactorForge Non-Blocking Startup System

## Overview

RefactorForge now uses a completely non-blocking startup system that ensures:
- ✅ **No terminal blocking** - All scripts return control immediately
- ✅ **No browser auto-opening** - Services start without interrupting workflow  
- ✅ **Background service management** - All services run completely detached
- ✅ **LaunchAgent compatibility** - Automatic startup doesn't interfere with terminal sessions
- ✅ **Memory system integration** - Seamlessly integrated with Claude Memory System

## Quick Start

```bash
# Start services (returns immediately)
./start-refactorforge.sh

# Check status
./status-refactorforge.sh

# Stop services
./stop-refactorforge.sh

# Test non-blocking behavior
./test-non-blocking.sh

# Setup memory integration
./integrate-memory.sh
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Memory API | 3721 | Claude Memory System API backend |
| Frontend | 8745 | RefactorForge React application |
| GitHub Webhook | 4000 | GitHub integration (optional) |

## Files

### Core Scripts
- `start-refactorforge.sh` - Non-blocking startup script
- `stop-refactorforge.sh` - Stop all services
- `status-refactorforge.sh` - Check service status
- `background-launcher.sh` - Background launcher for LaunchAgent

### Integration & Testing
- `integrate-memory.sh` - Memory system integration setup
- `test-non-blocking.sh` - Comprehensive non-blocking tests
- `README-NON-BLOCKING.md` - This documentation

### Configuration
- `~/Library/LaunchAgents/com.refactorforge.startup.plist` - macOS auto-startup

## Architecture

### Non-Blocking Design

1. **Double Backgrounding**: Services use `(nohup cmd & echo $!)` pattern for complete detachment
2. **Immediate Exit**: Scripts exit immediately after starting background processes
3. **No Sleep Calls**: Removed all blocking `sleep` statements
4. **No Browser Opening**: Services start without opening browser windows
5. **Background Mode Detection**: Uses `REFACTORFORGE_BACKGROUND` environment variable

### Process Management

- **PID Files**: Stored in `~/.claude/logs/pids/`
- **Log Files**: Stored in `~/.claude/logs/`
- **Service Tracking**: Each service has dedicated PID and log files

### Memory Integration

- **API Endpoint**: http://localhost:3721 (changed from 5555)
- **Semantic Search**: Full text search across code patterns
- **Repository Detection**: Automatic Git repository integration
- **Pattern Analytics**: Usage tracking and insights

## Usage Examples

### Manual Startup
```bash
# Start all services
cd /path/to/RefactorForge
./start-refactorforge.sh

# Output returns immediately:
# 🚀 RefactorForge startup initiated (2 services)
# Services starting in background - no browser will open
# Visit http://localhost:8745 when ready
```

### Status Monitoring
```bash
./status-refactorforge.sh

# Shows:
# - Service status (running/stopped)
# - Port availability
# - Process IDs
# - Log file information
# - Health checks
```

### Service Management
```bash
# Stop all services
./stop-refactorforge.sh

# Check logs
tail -f ~/.claude/logs/*.log

# Restart services
./stop-refactorforge.sh && ./start-refactorforge.sh
```

## LaunchAgent (Auto-Startup)

The LaunchAgent configuration ensures:

```xml
<!-- Background operation -->
<key>ProcessType</key>
<string>Background</string>

<!-- No session interference -->
<key>SessionCreate</key>
<false/>

<!-- Complete process detachment -->
<key>AbandonProcessGroup</key>
<true/>
```

### Auto-Startup Commands
```bash
# Load LaunchAgent
launchctl load ~/Library/LaunchAgents/com.refactorforge.startup.plist

# Unload LaunchAgent  
launchctl unload ~/Library/LaunchAgents/com.refactorforge.startup.plist

# Check status
launchctl list | grep refactorforge
```

## Memory System Integration

### Features
- **Semantic Pattern Search**: Find code patterns using natural language
- **Repository Auto-Detection**: Automatically detects Git repositories
- **Usage Analytics**: Track pattern usage and effectiveness
- **GitHub Integration**: Sync patterns from GitHub repositories
- **Embeddings Visualization**: Visual representation of code pattern relationships

### API Endpoints
- `GET /health` - Health check
- `POST /api/patterns/search` - Search patterns
- `GET /api/patterns` - Get all patterns  
- `GET /api/analytics` - Usage analytics
- `GET /api/repositories` - Repository list

## Troubleshooting

### Services Won't Start
```bash
# Check port conflicts
lsof -i :3721
lsof -i :8745

# Check logs
tail -f ~/.claude/logs/*.log

# Force stop and restart
./stop-refactorforge.sh
killall node  # If needed
./start-refactorforge.sh
```

### LaunchAgent Issues
```bash
# Check LaunchAgent status
launchctl list com.refactorforge.startup

# View LaunchAgent logs
tail -f ~/.claude/logs/refactorforge-launch*.log

# Reload LaunchAgent
launchctl unload ~/Library/LaunchAgents/com.refactorforge.startup.plist
launchctl load ~/Library/LaunchAgents/com.refactorforge.startup.plist
```

### Memory System Issues
```bash
# Test memory API
curl http://localhost:3721/health

# Run integration check
./integrate-memory.sh

# Check memory system status
memory-status
```

## Performance

### Startup Times
- Manual startup: ~0.2 seconds
- Background launcher: ~0.1 seconds  
- Memory loader: ~0.1 seconds
- Total non-blocking execution: **< 0.5 seconds**

### Resource Usage
- Memory: ~200MB total for all services
- CPU: Minimal background usage
- Disk: Logs rotate automatically

## Development

### Adding New Services
1. Update `start-refactorforge.sh` with new service
2. Add service to `status-refactorforge.sh` monitoring
3. Update `stop-refactorforge.sh` cleanup
4. Test with `test-non-blocking.sh`

### Configuration Changes
- Service ports: Update in startup script and documentation
- Log locations: Modify `LOG_DIR` variable
- PID storage: Modify `PID_DIR` variable

## Migration from Blocking System

### What Changed
- ❌ Removed: Sleep delays, browser opening, blocking operations
- ✅ Added: Background process management, PID tracking, status monitoring
- ✅ Improved: LaunchAgent compatibility, memory integration, performance

### Compatibility
- All existing functionality preserved
- New non-blocking architecture
- Enhanced monitoring and management
- Better error handling and recovery

---

**Status**: ✅ **Fully Non-Blocking System Active**

All RefactorForge services now start completely in the background without interfering with terminal sessions or workflows.