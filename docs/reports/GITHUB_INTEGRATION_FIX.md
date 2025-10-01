# GitHub Integration Fix Guide

## Current Issues Identified

1. **Backend Health Status**: The backend is running but reporting "degraded" status
2. **GitHub Token**: Invalid or missing GitHub token configuration
3. **Frontend Routing**: The `/github` route returns 404 (React Router issue)

## How to Fix

### 1. Configure GitHub Token

Create or update your `.env` file in the backend directory:

```bash
# In the backend directory
cd backend
echo 'GITHUB_TOKEN=your_github_personal_access_token_here' >> .env
```

To get a GitHub Personal Access Token:
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` (Full control of private repositories)
   - `read:org` (Read org and team membership)
4. Generate and copy the token

### 2. Fix Frontend Routing

The frontend is a Single Page Application (SPA) that needs proper routing configuration.

**For Development (React Dev Server)**:
The React dev server should handle client-side routing automatically. The issue might be:
- The frontend is not properly configured for React Router
- The GitHub component isn't being rendered on the `/github` route

**Quick Fix**: Access the GitHub integration through the UI:
1. Go to http://localhost:8745
2. Click on the "GitHub Integration" tab in the navigation

### 3. Restart Services

After adding the GitHub token:

```bash
# Restart backend
cd backend
npm run dev

# In another terminal, restart frontend
cd frontend
npm start
```

## Testing the Fix

### Run the E2E Tests

```bash
# Simple API test (no dependencies needed)
node e2e-tests/simple-api-test.js

# With GitHub token
GITHUB_TOKEN=your_token_here node e2e-tests/simple-api-test.js

# Full E2E test with Playwright (requires npm install)
cd e2e-tests
npm install
npm test
```

## Expected Results After Fix

✅ Backend health check should return "healthy" status
✅ GitHub integrations endpoint should return actual repositories
✅ Frontend should display GitHub integration page at `/github`
✅ Should be able to add and sync repositories

## Verification Commands

```bash
# Check backend health
curl http://localhost:8001/api/health | jq .

# Check GitHub integrations (with token configured)
curl http://localhost:8001/api/github/integrations | jq .

# Access frontend GitHub page
open http://localhost:8745
# Then click on "GitHub Integration" tab
```

## Additional Notes

- The application is designed to work without a GitHub token but with limited functionality
- With a valid token, you'll be able to:
  - View your repositories
  - Add new repository integrations
  - Sync repositories to extract patterns
  - Enable webhooks for real-time updates

## Test Results Summary

Current test results show:
- ✅ Backend is running and accessible
- ✅ CORS is properly configured
- ⚠️ GitHub API needs valid token
- ⚠️ Frontend routing needs attention
- ✅ Core API endpoints are functional