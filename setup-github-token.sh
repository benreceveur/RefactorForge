#!/bin/bash

# Setup GitHub Token for RefactorForge
# This script helps configure a valid GitHub Personal Access Token

echo "=========================================="
echo "RefactorForge GitHub Token Setup"
echo "=========================================="
echo ""

# Check current token status
CURRENT_TOKEN=$(grep "GITHUB_TOKEN=" backend/.env 2>/dev/null | cut -d'=' -f2)

if [ "$CURRENT_TOKEN" = "your_github_personal_access_token_here" ]; then
    echo "❌ Currently using placeholder token"
    echo "   The application is trying to use: 'your_github_personal_access_token_here'"
    echo "   This is not a valid GitHub token!"
else
    echo "ℹ️  Current token: ${CURRENT_TOKEN:0:10}..."
fi

echo ""
echo "To fix this, you need a real GitHub Personal Access Token."
echo ""
echo "📝 How to get a GitHub Personal Access Token:"
echo "   1. Go to https://github.com/settings/tokens"
echo "   2. Click 'Generate new token' → 'Generate new token (classic)'"
echo "   3. Give it a name like 'RefactorForge'"
echo "   4. Select these scopes:"
echo "      ✓ repo (Full control of private repositories)"
echo "      ✓ read:org (Read org and team membership)"
echo "   5. Click 'Generate token'"
echo "   6. Copy the token (starts with 'ghp_')"
echo ""

# Prompt for token
read -p "Enter your GitHub Personal Access Token (or press Enter to skip): " NEW_TOKEN

if [ -z "$NEW_TOKEN" ]; then
    echo ""
    echo "⚠️  No token provided. To set it manually:"
    echo ""
    echo "   Option 1 - Edit the file directly:"
    echo "   $ nano backend/.env"
    echo "   Change: GITHUB_TOKEN=your_github_personal_access_token_here"
    echo "   To:     GITHUB_TOKEN=ghp_your_actual_token_here"
    echo ""
    echo "   Option 2 - Use this command:"
    echo "   $ sed -i '' 's/GITHUB_TOKEN=.*/GITHUB_TOKEN=ghp_your_actual_token_here/' backend/.env"
    echo ""
    echo "   Then restart the backend:"
    echo "   $ cd backend && npm run dev"
    exit 0
fi

# Validate token format
if [[ ! "$NEW_TOKEN" =~ ^ghp_[a-zA-Z0-9]{36}$ ]] && [[ ! "$NEW_TOKEN" =~ ^github_pat_[a-zA-Z0-9_]{82}$ ]]; then
    echo "⚠️  Warning: Token doesn't match expected GitHub token format"
    echo "   (should start with 'ghp_' or 'github_pat_')"
    read -p "Continue anyway? (y/n): " CONFIRM
    if [ "$CONFIRM" != "y" ]; then
        echo "Aborted."
        exit 1
    fi
fi

# Test the token
echo ""
echo "🔍 Testing token..."
RESPONSE=$(curl -s -H "Authorization: token $NEW_TOKEN" https://api.github.com/user)
LOGIN=$(echo "$RESPONSE" | grep -o '"login":"[^"]*' | cut -d'"' -f4)

if [ -z "$LOGIN" ]; then
    echo "❌ Token validation failed!"
    echo "   Response: $(echo "$RESPONSE" | head -1)"
    echo ""
    echo "   Please make sure you copied the entire token correctly."
    exit 1
fi

echo "✅ Token valid! Authenticated as: $LOGIN"

# Update backend/.env
echo ""
echo "📝 Updating backend/.env..."
sed -i '' "s/GITHUB_TOKEN=.*/GITHUB_TOKEN=$NEW_TOKEN/" backend/.env

# Also update root .env if it exists
if [ -f ".env" ]; then
    echo "📝 Updating root .env..."
    sed -i '' "s/GITHUB_TOKEN=.*/GITHUB_TOKEN=$NEW_TOKEN/" .env
fi

echo "✅ Configuration updated!"
echo ""
echo "🔄 Please restart the backend server:"
echo "   $ cd backend && npm run dev"
echo ""
echo "Then you can test the integration:"
echo "   $ node e2e-tests/simple-api-test.js"
echo ""
echo "Or access it in the browser:"
echo "   http://localhost:8745 → Click 'GitHub Integration' tab"
echo ""
echo "=========================================="
echo "✅ Setup complete!"
echo "=========================================="