#!/bin/bash

# Production Status Checker for GitHub Memory System
echo "🔍 GitHub Memory System - Production Status Check"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check frontend
echo -e "${YELLOW}Checking Frontend...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8745 | grep -q "200"; then
    echo -e "${GREEN}✅ Frontend: Online at http://localhost:8745${NC}"
    FRONTEND_STATUS="✅ ONLINE"
else
    echo -e "${RED}❌ Frontend: Offline${NC}"
    FRONTEND_STATUS="❌ OFFLINE"
fi

# Check backend API
echo -e "${YELLOW}Checking Backend API...${NC}"
if curl -s http://localhost:5000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API: Online at http://localhost:5000${NC}"
    API_STATUS="✅ ONLINE"
else
    echo -e "${RED}❌ Backend API: Offline${NC}"
    API_STATUS="❌ OFFLINE"
fi

# Check PM2 services
echo -e "${YELLOW}Checking PM2 Services...${NC}"
cd ~/.claude/memory
pm2_status=$(pm2 jlist 2>/dev/null)
if echo "$pm2_status" | grep -q "online"; then
    echo -e "${GREEN}✅ PM2 Services: Running${NC}"
    PM2_STATUS="✅ RUNNING"
    pm2 status
else
    echo -e "${RED}❌ PM2 Services: Not running${NC}"
    PM2_STATUS="❌ STOPPED"
fi

# Check processes
echo -e "${YELLOW}Checking Processes...${NC}"
frontend_pid=$(ps aux | grep -E "serve.*8745" | grep -v grep | awk '{print $2}')
if [ ! -z "$frontend_pid" ]; then
    echo -e "${GREEN}✅ Frontend Process: PID $frontend_pid${NC}"
else
    echo -e "${RED}❌ Frontend Process: Not found${NC}"
fi

# Summary
echo ""
echo -e "${YELLOW}📊 PRODUCTION STATUS SUMMARY${NC}"
echo "============================"
echo "Frontend:     $FRONTEND_STATUS"
echo "Backend API:  $API_STATUS"
echo "PM2 Services: $PM2_STATUS"
echo ""

# URLs
echo -e "${YELLOW}🔗 System URLs${NC}"
echo "==============="
echo "Frontend:     http://localhost:8745"
echo "Backend API:  http://localhost:5000"
echo ""

# Quick tests
echo -e "${YELLOW}🧪 Quick Function Tests${NC}"
echo "======================="

# Test search endpoint
echo -n "Search API: "
if curl -s "http://localhost:5000/api/search?q=test" > /dev/null 2>&1; then
    echo -e "${GREEN}Working${NC}"
else
    echo -e "${RED}Failed${NC}"
fi

# Test patterns endpoint
echo -n "Patterns API: "
if curl -s "http://localhost:5000/api/patterns" > /dev/null 2>&1; then
    echo -e "${GREEN}Working${NC}"
else
    echo -e "${RED}Failed${NC}"
fi

echo ""
echo -e "${GREEN}Production system check complete!${NC}"