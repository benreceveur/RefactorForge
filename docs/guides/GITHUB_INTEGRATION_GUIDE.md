# GitHub API Integration Guide

## Overview

RefactorForge now includes live GitHub API integration to scan repositories remotely and detect when issues are fixed in real-time. This enables the refresh button to analyze actual repository code instead of returning cached mock recommendations.

## Features

### 🔍 Live Repository Scanning
- Fetches file contents directly from GitHub repositories
- Analyzes TypeScript/JavaScript files for code patterns
- Supports both public and private repositories (with proper authentication)

### 🔧 Real-Time Issue Detection
- **Security Issues**: Missing middleware (helmet, CORS, rate limiting), hardcoded secrets
- **Type Safety Issues**: "any" type usage, untyped function parameters
- **Performance Issues**: Synchronous operations, memory leaks, inefficient loops

### ✅ Fixed Issue Recognition
- Detects when security middleware has been properly implemented
- Identifies when "any" types have been replaced with proper interfaces
- Recognizes when async operations have been optimized
- Automatically removes recommendations for issues that no longer exist

## Setup Instructions

### 1. GitHub Authentication (Optional but Recommended)

Create a GitHub Personal Access Token:
1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes:
   - `public_repo` (for public repositories only)
   - `repo` (for private repositories)
4. Copy the generated token

### 2. Environment Configuration

Create a `.env` file in the backend directory:

```bash
# Copy the example file
cp .env.example .env

# Edit with your settings
GITHUB_TOKEN=your_personal_access_token_here
GITHUB_ORG=IntelliPact
PORT=8001
```

### 3. Required Dependencies

The following packages are automatically installed:
- `@octokit/rest` - GitHub API client
- `@octokit/auth-token` - Authentication handling

## API Endpoints

### Repository Refresh (Live Scanning)
```bash
POST /api/repositories/:id/refresh
```

**Example:**
```bash
curl -X POST http://localhost:8001/api/repositories/IntelliPact%2FIntelliPact-Observability/refresh
```

**Response:**
```json
{
  "success": true,
  "repositoryId": "IntelliPact/IntelliPact-Observability",
  "scanResults": {
    "patternsFound": 247,
    "securityIssues": 2,
    "typeSafetyIssues": 15,
    "performanceIssues": 3
  },
  "fixedIssues": {
    "total": 1,
    "security": 1,
    "typeIssues": 0,
    "performance": 0,
    "details": {
      "fixedSecurityIssues": ["Add Security Headers and Middleware"],
      "fixedTypeIssues": [],
      "fixedPerformanceIssues": []
    }
  },
  "newRecommendations": {
    "count": 8,
    "recommendations": [...]
  },
  "lastRefreshed": "2025-08-26T20:45:30.123Z"
}
```

### Direct Repository Scanning
```bash
POST /api/repositories/scan/:owner/:repo
```

**Example:**
```bash
curl -X POST http://localhost:8001/api/repositories/scan/IntelliPact/IntelliPact-Observability \
  -H "Content-Type: application/json" \
  -d '{"branch": "main"}'
```

### Scan Status Check
```bash
GET /api/repositories/:id/scan-status
```

**Example:**
```bash
curl http://localhost:8001/api/repositories/IntelliPact%2FIntelliPact-Observability/scan-status
```

## Issue Detection Examples

### Security Issues Detected

1. **Missing Security Middleware**
   ```typescript
   // DETECTED: Missing helmet middleware
   const app = express();
   app.use(express.json());
   // RECOMMENDATION: Add app.use(helmet());
   ```

2. **Hardcoded Secrets**
   ```typescript
   // DETECTED: Hardcoded API key
   const apiKey = "sk-1234567890abcdef";
   // RECOMMENDATION: Use process.env.API_KEY
   ```

### Type Safety Issues Detected

1. **Any Type Usage**
   ```typescript
   // DETECTED: Using 'any' type
   function processData(data: any): any { ... }
   // RECOMMENDATION: Define specific interfaces
   ```

2. **Untyped Parameters**
   ```typescript
   // DETECTED: Missing type annotations
   function calculate(value, multiplier) { ... }
   // RECOMMENDATION: Add type annotations
   ```

### Performance Issues Detected

1. **Synchronous Operations**
   ```typescript
   // DETECTED: Blocking file operation
   const data = fs.readFileSync('file.txt');
   // RECOMMENDATION: Use fs.promises.readFile()
   ```

2. **Memory Leaks**
   ```typescript
   // DETECTED: setInterval without cleanup
   setInterval(() => { ... }, 1000);
   // RECOMMENDATION: Store reference and clear on unmount
   ```

## Rate Limiting

### Authenticated Requests
- 5,000 requests per hour per token
- Automatically handles rate limit checks
- Waits when approaching limits

### Unauthenticated Requests
- 60 requests per hour per IP
- Limited to public repositories only
- Reduced functionality

## Error Handling

The system includes comprehensive error handling:
- Network timeouts and connection errors
- Invalid repository names or permissions
- Rate limit exceeded scenarios
- Authentication failures

## Testing the Integration

### 1. Check System Health
```bash
curl http://localhost:8001/api/health
```

Should show GitHub API status and rate limits.

### 2. Test IntelliPact-Observability Scan
```bash
# This will test security middleware detection
curl -X POST http://localhost:8001/api/repositories/scan/IntelliPact/IntelliPact-Observability
```

### 3. Test RefactorForge Scan
```bash
# This will test type safety issue detection
curl -X POST http://localhost:8001/api/repositories/scan/IntelliPact/RefactorForge
```

### 4. Test Refresh Functionality
```bash
# Scan first, then make a change, then refresh to see differences
curl -X POST http://localhost:8001/api/repositories/IntelliPact%2FIntelliPact-Observability/refresh
```

## Integration with Frontend

The refresh button should now call the refresh endpoint:

```javascript
const refreshRepository = async (repositoryId) => {
  try {
    const response = await fetch(`/api/repositories/${encodeURIComponent(repositoryId)}/refresh`, {
      method: 'POST'
    });
    const result = await response.json();
    
    if (result.success) {
      console.log(`Fixed ${result.fixedIssues.total} issues`);
      console.log(`Generated ${result.newRecommendations.count} new recommendations`);
    }
  } catch (error) {
    console.error('Refresh failed:', error);
  }
};
```

## Troubleshooting

### Common Issues

1. **"Repository not found" error**
   - Verify repository name format: `owner/repo`
   - Check if repository exists and is accessible
   - Ensure proper authentication for private repos

2. **Rate limit exceeded**
   - Wait for rate limit reset time (shown in health check)
   - Consider using authenticated requests for higher limits

3. **Authentication failures**
   - Verify GitHub token is valid and not expired
   - Check token permissions (public_repo vs repo)

### Debug Information

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will show detailed information about:
- GitHub API requests and responses
- Pattern extraction process
- Issue detection logic
- Database operations

## Security Considerations

1. **Token Security**
   - Never commit GitHub tokens to version control
   - Use environment variables only
   - Rotate tokens regularly
   - Use minimum required permissions

2. **Repository Access**
   - Only scan repositories you have permission to access
   - Be mindful of private repository content
   - Consider IP restrictions for production deployments

3. **Rate Limiting**
   - Implement proper rate limiting in production
   - Monitor GitHub API usage
   - Have fallback strategies for rate limit scenarios

## Performance Optimization

1. **File Filtering**
   - Only scans TypeScript/JavaScript files
   - Excludes node_modules, dist, build directories
   - Limits to 50 files per scan by default

2. **Caching Strategy**
   - Patterns are cached in database after scanning
   - Only rescans when refresh is explicitly requested
   - Uses file hashes to detect changes

3. **Concurrent Processing**
   - Processes multiple files concurrently
   - Implements proper error handling for individual files
   - Continues scanning even if some files fail