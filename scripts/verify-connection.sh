#!/bin/bash

# RefactorForge Connection Verification Script
# Tests that frontend can connect to backend API endpoints

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 RefactorForge Connection Verification${NC}"
echo "================================================"

# Test backend health
echo -n "Testing backend health endpoint... "
if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
    BACKEND_STATUS=$(curl -s http://localhost:8001/api/health | jq -r '.status')
    echo "   Status: $BACKEND_STATUS"
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "   Backend is not running on port 8001"
    exit 1
fi

# Test searches endpoint
echo -n "Testing searches history endpoint... "
if curl -s http://localhost:8001/api/searches/history > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
    SEARCH_COUNT=$(curl -s http://localhost:8001/api/searches/history | jq -r '.total')
    echo "   Search history count: $SEARCH_COUNT"
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "   Searches endpoint not responding"
fi

# Test repositories endpoint
echo -n "Testing repositories endpoint... "
if curl -s http://localhost:8001/api/repositories/with-local-status > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
    REPO_COUNT=$(curl -s http://localhost:8001/api/repositories/with-local-status | jq '. | length')
    echo "   Repository count: $REPO_COUNT"
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "   Repositories endpoint not responding"
fi

# Test frontend
echo -n "Testing frontend... "
if curl -s http://localhost:8745 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
    echo "   Frontend is serving on port 8745"
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "   Frontend is not running on port 8745"
    exit 1
fi

# Test proxy configuration
echo -n "Testing frontend proxy configuration... "
FRONTEND_PROXY=$(grep '"proxy"' /Users/benreceveur/GitHub/RefactorForge/frontend/package.json | cut -d'"' -f4)
if [ "$FRONTEND_PROXY" = "http://localhost:8001" ]; then
    echo -e "${GREEN}✓ OK${NC}"
    echo "   Proxy configured correctly: $FRONTEND_PROXY"
else
    echo -e "${RED}✗ INCORRECT${NC}"
    echo "   Proxy should be http://localhost:8001, found: $FRONTEND_PROXY"
fi

echo ""
echo -e "${GREEN}🎉 All connection tests completed!${NC}"
echo ""
echo "Frontend: http://localhost:8745"
echo "Backend:  http://localhost:8001"
echo "Health:   http://localhost:8001/api/health"