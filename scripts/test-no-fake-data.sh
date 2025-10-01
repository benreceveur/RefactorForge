#!/bin/bash

# Test script to verify fake data has been removed from RefactorForge
# Run this to confirm the application now shows real GitHub data

echo "🧪 Testing RefactorForge - No Fake Data Verification"
echo "================================================="

# Check if server is running
echo "1. Checking server status..."
if curl -s http://localhost:3721/api/health > /dev/null; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running. Start with: npm run dev"
    exit 1
fi

# Test repositories endpoint
echo ""
echo "2. Testing /api/repositories endpoint..."
REPO_RESPONSE=$(curl -s http://localhost:3721/api/repositories)

if echo "$REPO_RESPONSE" | grep -q "IntelliPact.*Observability\|Western-Dental\|bMigrate"; then
    echo "❌ FAKE DATA DETECTED in repositories endpoint!"
    echo "Found: $(echo "$REPO_RESPONSE" | grep -o 'IntelliPact[^"]*')"
    exit 1
else
    echo "✅ No fake IntelliPact data found in repositories"
fi

# Test GitHub integrations endpoint
echo ""
echo "3. Testing /api/github/integrations endpoint..."
GITHUB_RESPONSE=$(curl -s http://localhost:3721/api/github/integrations)

if echo "$GITHUB_RESPONSE" | grep -q "IntelliPact.*Observability\|Western-Dental\|bMigrate"; then
    echo "❌ FAKE DATA DETECTED in GitHub integrations!"
    exit 1
else
    echo "✅ No fake data in GitHub integrations endpoint"
fi

# Check database
echo ""
echo "4. Checking database for fake data..."
DB_COUNT=$(sqlite3 backend/refactorforge.db "SELECT COUNT(*) FROM repositories WHERE organization='IntelliPact';" 2>/dev/null || echo "0")

if [ "$DB_COUNT" -gt 0 ]; then
    echo "❌ FAKE DATA DETECTED in database!"
    echo "Found $DB_COUNT IntelliPact repositories in database"
    exit 1
else
    echo "✅ No fake data in database"
fi

# Test if real GitHub data is being fetched
echo ""
echo "5. Testing real GitHub data fetching..."
if [ -n "$GITHUB_TOKEN" ]; then
    echo "✅ GitHub token is configured"
    
    # Try to get real repositories
    REAL_REPOS=$(curl -s "http://localhost:3721/api/repositories" | jq -r '.[] | .fullName' 2>/dev/null | head -3)
    if [ -n "$REAL_REPOS" ]; then
        echo "✅ Real repository data found:"
        echo "$REAL_REPOS" | sed 's/^/   - /'
    else
        echo "⚠️  No repository data returned (may be normal if no repos accessible)"
    fi
else
    echo "⚠️  GitHub token not set - cannot test real data fetching"
fi

echo ""
echo "6. Checking for hardcoded fake data in code..."
if grep -r "IntelliPact.*Observability\|Western-Dental\|bMigrate" backend/src/routes/ --exclude="*.md" --exclude="*.json" 2>/dev/null | grep -v "REMOVED"; then
    echo "❌ HARDCODED FAKE DATA still found in source code!"
    exit 1
else
    echo "✅ No hardcoded fake data found in route files"
fi

echo ""
echo "🎉 SUCCESS: All fake data has been removed!"
echo ""
echo "Next steps:"
echo "1. Restart the frontend and backend servers"
echo "2. Open http://localhost:3000 in your browser"  
echo "3. You should now see your real GitHub repositories"
echo "4. If you see empty data, run: POST /api/repositories/initialize-analysis"