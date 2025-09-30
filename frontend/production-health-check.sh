#!/bin/bash

# GitHub Memory System - Production Health Check
echo "🔍 GitHub Memory System - Production Health Check"
echo "================================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""

# Frontend check
echo -e "${BLUE}🌐 Frontend Status${NC}"
echo "---------------"
frontend_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8745)
if [ "$frontend_response" = "200" ]; then
    echo -e "${GREEN}✅ Frontend: http://localhost:8745 - Online${NC}"
else
    echo -e "${RED}❌ Frontend: HTTP $frontend_response${NC}"
fi

# API Health check
echo ""
echo -e "${BLUE}🔧 Backend API Health${NC}"
echo "-------------------"
api_health=$(curl -s http://localhost:3721/health 2>/dev/null | jq -r '.status' 2>/dev/null)
if [ "$api_health" = "healthy" ]; then
    echo -e "${GREEN}✅ API Health: http://localhost:3721/health - Healthy${NC}"
else
    echo -e "${RED}❌ API Health: Issues detected${NC}"
fi

# Test each critical endpoint
echo ""
echo -e "${BLUE}📊 API Endpoints Test${NC}"
echo "-------------------"

# Analytics endpoint
analytics_count=$(curl -s http://localhost:3721/api/analytics 2>/dev/null | jq -r '.totalPatterns // "error"' 2>/dev/null)
if [[ "$analytics_count" =~ ^[0-9]+$ ]]; then
    echo -e "${GREEN}✅ Analytics: /api/analytics - $analytics_count patterns${NC}"
else
    echo -e "${RED}❌ Analytics: Endpoint failed${NC}"
fi

# GitHub integrations
github_count=$(curl -s http://localhost:3721/api/github/integrations 2>/dev/null | jq -r '.integrations | length // "error"' 2>/dev/null)
if [[ "$github_count" =~ ^[0-9]+$ ]]; then
    echo -e "${GREEN}✅ GitHub Integration: /api/github/integrations - $github_count integrations${NC}"
else
    echo -e "${RED}❌ GitHub Integration: Endpoint failed${NC}"
fi

# Timeline endpoint
timeline_count=$(curl -s http://localhost:3721/api/timeline 2>/dev/null | jq -r '.events | length // "error"' 2>/dev/null)
if [[ "$timeline_count" =~ ^[0-9]+$ ]]; then
    echo -e "${GREEN}✅ Timeline: /api/timeline - $timeline_count events${NC}"
else
    echo -e "${RED}❌ Timeline: Endpoint failed${NC}"
fi

# Patterns endpoint
patterns_count=$(curl -s http://localhost:3721/api/patterns 2>/dev/null | jq -r '.patterns | length // "error"' 2>/dev/null)
if [[ "$patterns_count" =~ ^[0-9]+$ ]]; then
    echo -e "${GREEN}✅ Patterns: /api/patterns - $patterns_count patterns${NC}"
else
    echo -e "${RED}❌ Patterns: Endpoint failed${NC}"
fi

# Search endpoint test
echo ""
echo -e "${BLUE}🔍 Search Functionality${NC}"
echo "---------------------"
search_results=$(curl -s -X POST http://localhost:3721/api/patterns/search \
    -H "Content-Type: application/json" \
    -d '{"query":"GitHub workflow"}' 2>/dev/null | \
    jq -r '.results | length // "error"' 2>/dev/null)

if [[ "$search_results" =~ ^[0-9]+$ ]] && [ "$search_results" -gt 0 ]; then
    echo -e "${GREEN}✅ Search: Found $search_results results for 'GitHub workflow'${NC}"
else
    echo -e "${RED}❌ Search: No results or endpoint failed${NC}"
fi

# PM2 services
echo ""
echo -e "${BLUE}🔄 PM2 Services${NC}"
echo "-------------"
cd ~/.claude/memory
pm2_status=$(pm2 jlist 2>/dev/null)
if echo "$pm2_status" | grep -q "online"; then
    echo -e "${GREEN}✅ PM2 Services: Running${NC}"
    online_count=$(echo "$pm2_status" | jq '[.[] | select(.pm2_env.status == "online")] | length' 2>/dev/null)
    echo "   - Online services: $online_count"
else
    echo -e "${RED}❌ PM2 Services: Issues detected${NC}"
fi

# Data verification
echo ""
echo -e "${BLUE}📂 Real Data Status${NC}"
echo "----------------"
pattern_file="semantic/patterns.json"
if [ -f "$pattern_file" ]; then
    real_patterns=$(jq 'length' "$pattern_file" 2>/dev/null)
    echo -e "${GREEN}✅ Pattern Data: $real_patterns real patterns loaded${NC}"
    
    # Check for IntelliPact data
    intellipact_count=$(jq '[.[] | select(.context.repo and (.context.repo | contains("IntelliPact")))] | length' "$pattern_file" 2>/dev/null)
    if [ "$intellipact_count" -gt 0 ]; then
        echo -e "${GREEN}✅ IntelliPact Data: $intellipact_count patterns from repositories${NC}"
    fi
else
    echo -e "${RED}❌ Pattern Data: File not found${NC}"
fi

# Summary
echo ""
echo -e "${YELLOW}📋 PRODUCTION SYSTEM STATUS${NC}"
echo "=========================="

# Calculate overall health
total_checks=8
passed_checks=0

[ "$frontend_response" = "200" ] && ((passed_checks++))
[ "$api_health" = "healthy" ] && ((passed_checks++))
[[ "$analytics_count" =~ ^[0-9]+$ ]] && ((passed_checks++))
[[ "$github_count" =~ ^[0-9]+$ ]] && ((passed_checks++))
[[ "$timeline_count" =~ ^[0-9]+$ ]] && ((passed_checks++))
[[ "$patterns_count" =~ ^[0-9]+$ ]] && ((passed_checks++))
[[ "$search_results" =~ ^[0-9]+$ ]] && [ "$search_results" -gt 0 ] && ((passed_checks++))
echo "$pm2_status" | grep -q "online" && ((passed_checks++))

health_percentage=$((passed_checks * 100 / total_checks))

if [ "$health_percentage" -ge 90 ]; then
    echo -e "${GREEN}🎉 System Health: $health_percentage% ($passed_checks/$total_checks checks passed)${NC}"
    echo -e "${GREEN}✅ PRODUCTION SYSTEM OPERATIONAL${NC}"
elif [ "$health_percentage" -ge 70 ]; then
    echo -e "${YELLOW}⚠️  System Health: $health_percentage% ($passed_checks/$total_checks checks passed)${NC}"
    echo -e "${YELLOW}⚡ SYSTEM NEEDS ATTENTION${NC}"
else
    echo -e "${RED}🚨 System Health: $health_percentage% ($passed_checks/$total_checks checks passed)${NC}"
    echo -e "${RED}❌ CRITICAL ISSUES DETECTED${NC}"
fi

echo ""
echo -e "${BLUE}🔗 Quick Access Links:${NC}"
echo "• Main Application: http://localhost:8745"
echo "• Semantic Search:  http://localhost:8745/#search"
echo "• Analytics:        http://localhost:8745/#analytics"
echo "• GitHub Integration: http://localhost:8745/#github"  
echo "• Memory Timeline:  http://localhost:8745/#timeline"
echo "• API Health:       http://localhost:3721/health"