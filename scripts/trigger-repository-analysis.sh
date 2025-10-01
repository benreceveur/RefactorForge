#!/bin/bash

# RefactorForge Repository Analysis Trigger Script
# This script triggers code analysis for all IntelliPact repositories

echo "🔍 Starting comprehensive repository analysis..."

API_BASE="http://localhost:3721"

# List of known repositories that have local copies and can be analyzed
REPOSITORIES=(
    "azfunc"
    "Intellipact"
    "intellipact-landing-page"
    "Normalization_Middleware"
    "admin-portal"
    "iac"
    "IntelliPact-Observability" 
    "Western-Dental"
    "RefactorForge"
)

echo "📊 Step 1: Get current repository status"
curl -s "$API_BASE/api/repositories" | jq '.repositories | length' | xargs echo "Total repositories in system:"

echo ""
echo "🔄 Step 2: Sync all GitHub integrations"
for id in github-1 github-2 github-3 github-4 github-5 github-6; do
    echo "Syncing $id..."
    curl -s -X POST "$API_BASE/api/github/integrations/$id/sync" | jq -r '.message + " (" + (.patternsFound|tostring) + " patterns)"'
done

echo ""
echo "🎯 Step 3: Trigger individual repository analysis"
total_improvements=0
analyzed_count=0

for repo in "${REPOSITORIES[@]}"; do
    echo "Analyzing $repo..."
    response=$(curl -s "$API_BASE/api/real-improvements/$repo")
    improvements=$(echo "$response" | jq '.analysisResult.totalImprovements // 0')
    health_score=$(echo "$response" | jq '.analysisResult.healthScore // 0')
    
    if [ "$improvements" -gt 0 ]; then
        echo "  ✅ Found $improvements improvements (Health Score: $health_score%)"
        total_improvements=$((total_improvements + improvements))
        analyzed_count=$((analyzed_count + 1))
    else
        echo "  ⚪ No improvements found (may not be locally available)"
    fi
done

echo ""
echo "📈 Step 4: Get aggregated improvements across all repositories"
curl -s "$API_BASE/api/real-improvements" | jq -r '"Total Improvements: " + (.totalImprovements|tostring) + " across " + (.totalRepositories|tostring) + " repositories"'

echo ""
echo "🎉 Analysis Complete!"
echo "Individually analyzed: $analyzed_count repositories"
echo "Total improvements found: $total_improvements"
echo ""
echo "🔗 Access results:"
echo "- All improvements: $API_BASE/api/real-improvements"
echo "- Repository list: $API_BASE/api/repositories"
echo "- GitHub integrations: $API_BASE/api/github/integrations"
echo ""
echo "🚀 The analysis has been triggered for all available repositories."
echo "Repositories with local copies will show detailed code improvements."
echo "Repositories without local copies may show 0 patterns but are still tracked."