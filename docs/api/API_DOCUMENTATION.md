# RefactorForge API Documentation

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Service Information](#service-information)
  - [Health & Monitoring](#health--monitoring)
  - [Repository Management](#repository-management)
  - [Pattern Analysis](#pattern-analysis)
  - [GitHub Integration](#github-integration)
  - [Performance Monitoring](#performance-monitoring)
- [Webhook Integration](#webhook-integration)
- [SDK Examples](#sdk-examples)

## Overview

RefactorForge API is a comprehensive code intelligence platform that provides:

- **Multi-Repository Analysis**: Scan and analyze multiple GitHub repositories simultaneously
- **Pattern Recognition**: Extract and classify code patterns across different programming languages
- **Security Analysis**: Identify security vulnerabilities and configuration issues
- **Performance Optimization**: Detect performance bottlenecks and suggest improvements
- **Type Safety**: Analyze TypeScript/JavaScript for type safety issues
- **Real-Time Monitoring**: Live webhook integration for continuous analysis

**Base URL**: `http://localhost:8001` (development) | `https://api.refactorforge.com` (production)

## Authentication

Most endpoints require authentication using a GitHub Personal Access Token:

```bash
curl -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx" \
     https://api.refactorforge.com/api/repositories
```

### Obtaining a GitHub Token

1. Visit [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `read:org`, `workflow`
4. Copy the generated token

## Rate Limiting

| Authentication | Rate Limit |
|----------------|------------|
| Authenticated  | 5,000 requests/hour |
| Unauthenticated| 60 requests/hour |

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4999
X-RateLimit-Reset: 1640995200
```

## Response Format

All API responses follow a consistent JSON format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "2.1.0"
  }
}
```

### Error Response
```json
{
  "error": true,
  "code": "REPOSITORY_NOT_FOUND",
  "message": "Repository not found or not accessible",
  "details": {
    "repository": "octocat/Hello-World",
    "suggestion": "Check repository name and permissions"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Error Handling

Common error codes and their meanings:

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `REPOSITORY_NOT_FOUND` | Repository doesn't exist or is inaccessible | 404 |
| `INVALID_GITHUB_TOKEN` | GitHub token is invalid or expired | 401 |
| `RATE_LIMIT_EXCEEDED` | GitHub API rate limit exceeded | 429 |
| `SCAN_IN_PROGRESS` | Repository is currently being scanned | 409 |
| `INVALID_REQUEST_FORMAT` | Request body format is invalid | 400 |
| `SERVER_ERROR` | Internal server error | 500 |

## Endpoints

### Service Information

#### Get Service Information
```http
GET /
```

Returns comprehensive information about the RefactorForge API.

**Example Request:**
```bash
curl https://api.refactorforge.com/
```

**Example Response:**
```json
{
  "name": "RefactorForge Multi-Repository API",
  "version": "2.1.0",
  "description": "Advanced code intelligence platform with live GitHub scanning",
  "endpoints": {
    "health": "/api/health",
    "repositories": "/api/repositories",
    "patterns": "/api/patterns",
    "github": "/api/github"
  },
  "features": {
    "multiRepository": true,
    "techStackDetection": true,
    "patternExtraction": true,
    "liveGitHubScanning": true,
    "realTimeAnalysis": true
  },
  "githubIntegration": {
    "enabled": true,
    "status": "authenticated",
    "rateLimitInfo": "GitHub API rate limits apply"
  },
  "supportedRepositories": 9,
  "supportedPatterns": "2,154+"
}
```

### Health & Monitoring

#### Health Check
```http
GET /api/health
```

Comprehensive health check with system status and performance metrics.

**Example Request:**
```bash
curl https://api.refactorforge.com/api/health
```

**Example Response:**
```json
{
  "status": "ok",
  "service": "RefactorForge Backend",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "checks": {
    "database": {
      "status": "healthy",
      "tables": {
        "contacts_count": 42,
        "memory_count": 156,
        "refactor_count": 89,
        "repositories_count": 12,
        "patterns_count": 2154
      },
      "type": "SQLite3",
      "performance": {
        "queryTime": "3ms",
        "fromCache": false,
        "connectionPool": true
      }
    },
    "github": {
      "status": "authenticated",
      "rateLimitRemaining": 4892,
      "rateLimitReset": "2024-01-15T11:00:00.000Z",
      "type": "GitHub API v4"
    },
    "memory": {
      "status": "ok",
      "usage": {
        "heapUsed": 45678912,
        "heapTotal": 67108864,
        "external": 1234567,
        "rss": 89012345
      }
    },
    "environment": {
      "nodeVersion": "v18.17.0",
      "platform": "linux"
    }
  }
}
```

### Repository Management

#### List Repositories
```http
GET /api/repositories?page=1&limit=20&language=TypeScript&category=frontend
```

Retrieves a paginated list of analyzed repositories.

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `language` (string): Filter by programming language
- `category` (string): Filter by repository category

**Example Request:**
```bash
curl "https://api.refactorforge.com/api/repositories?language=TypeScript&limit=5" \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Example Response:**
```json
{
  "repositories": [
    {
      "id": "repo-1",
      "name": "IntelliPact-Observability",
      "fullName": "IntelliPact/IntelliPact-Observability",
      "description": "Advanced observability and monitoring platform",
      "language": "TypeScript",
      "patternsCount": 247,
      "lastUpdated": "2024-01-15T15:30:00.000Z",
      "lastAnalyzed": "2024-01-15T14:30:00.000Z",
      "categories": ["devops", "monitoring", "observability"],
      "techStack": ["Node.js", "TypeScript", "React", "Azure"],
      "metrics": {
        "linesOfCode": 15420,
        "fileCount": 89,
        "complexity": 2.4
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 12,
    "pages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### Add Repository
```http
POST /api/repositories
Content-Type: application/json
```

Adds a new repository for analysis.

**Request Body:**
```json
{
  "owner": "octocat",
  "repo": "Hello-World",
  "branch": "main",
  "categories": ["sample", "demo"]
}
```

**Example Request:**
```bash
curl -X POST https://api.refactorforge.com/api/repositories \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "owner": "octocat",
       "repo": "Hello-World",
       "branch": "main",
       "categories": ["sample", "demo"]
     }'
```

**Example Response:**
```json
{
  "id": "repo-new-123",
  "name": "Hello-World",
  "fullName": "octocat/Hello-World",
  "description": "My first repository on GitHub!",
  "language": "Unknown",
  "patternsCount": 0,
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "lastAnalyzed": null,
  "categories": ["sample", "demo"],
  "techStack": [],
  "status": "queued_for_analysis"
}
```

#### Scan Repository
```http
POST /api/repositories/{id}/scan
Content-Type: application/json
```

Initiates a comprehensive repository scan.

**Request Body (Optional):**
```json
{
  "force": false,
  "options": {
    "includeTests": true,
    "maxFiles": 100
  }
}
```

**Example Request:**
```bash
curl -X POST https://api.refactorforge.com/api/repositories/repo-1/scan \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "force": true,
       "options": {
         "includeTests": false,
         "maxFiles": 50
       }
     }'
```

**Example Response:**
```json
{
  "jobId": "scan-job-abc123",
  "repository": "IntelliPact/IntelliPact-Observability",
  "status": "queued",
  "progress": 0,
  "startedAt": "2024-01-15T10:30:00.000Z",
  "estimatedCompletion": "2024-01-15T10:35:00.000Z",
  "results": {
    "patternsFound": 0,
    "securityIssues": 0,
    "typeSafetyIssues": 0,
    "performanceIssues": 0
  }
}
```

#### Get Repository Patterns
```http
GET /api/repositories/{id}/patterns?category=function&confidence=0.8
```

Retrieves patterns extracted from a specific repository.

**Query Parameters:**
- `category` (string): Pattern category filter
- `language` (string): Programming language filter
- `confidence` (number): Minimum confidence score (0-1)

**Example Request:**
```bash
curl "https://api.refactorforge.com/api/repositories/repo-1/patterns?category=function&confidence=0.8" \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Example Response:**
```json
{
  "patterns": [
    {
      "id": "pattern-xyz789",
      "repositoryId": "repo-1",
      "patternType": "function_declaration",
      "patternName": "async function declaration",
      "content": "async function processData(data: any[]) {\n  return await Promise.all(data.map(item => transform(item)));\n}",
      "description": "Async function that processes array data with Promise.all",
      "category": "function",
      "subcategory": "async",
      "filePath": "src/processors/dataProcessor.ts",
      "lineStart": 15,
      "lineEnd": 17,
      "language": "TypeScript",
      "framework": "Node.js",
      "confidenceScore": 0.95,
      "tags": ["async", "array-processing", "promise"],
      "contextBefore": "// Data processing utilities\nimport { transform } from './transformers';",
      "contextAfter": "\nexport { processData };",
      "metadata": {
        "complexity": "medium",
        "performance": "optimized",
        "testCoverage": 0.85
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 247,
  "repository": {
    "id": "repo-1",
    "name": "IntelliPact-Observability",
    "fullName": "IntelliPact/IntelliPact-Observability"
  }
}
```

### Pattern Analysis

#### Search Patterns
```http
GET /api/patterns?search=async&category=function&page=1&limit=20
```

Searches for patterns across all repositories.

**Query Parameters:**
- `search` (string): Search query for pattern content
- `category` (string): Pattern category filter
- `language` (string): Programming language filter
- `repository` (string): Repository name filter
- `page` (integer): Page number
- `limit` (integer): Items per page

**Example Request:**
```bash
curl "https://api.refactorforge.com/api/patterns?search=async&category=function&limit=5" \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Example Response:**
```json
{
  "patterns": [
    {
      "id": "pattern-async-001",
      "repositoryId": "repo-1",
      "patternType": "async_function",
      "content": "async function fetchUserData(userId: string)",
      "description": "Async function for user data retrieval",
      "category": "function",
      "language": "TypeScript",
      "confidenceScore": 0.92,
      "repository": {
        "name": "IntelliPact-Observability",
        "fullName": "IntelliPact/IntelliPact-Observability"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 89,
    "pages": 18,
    "hasNext": true,
    "hasPrev": false
  },
  "aggregations": {
    "byCategory": {
      "function": 89,
      "type": 34,
      "import": 67,
      "react": 23
    },
    "byLanguage": {
      "TypeScript": 156,
      "JavaScript": 67,
      "Python": 23
    },
    "byRepository": {
      "IntelliPact/IntelliPact-Observability": 89,
      "IntelliPact/Intellipact": 67
    }
  }
}
```

### GitHub Integration

#### List GitHub Integrations
```http
GET /api/github/integrations
```

Lists all configured GitHub repository integrations.

**Example Request:**
```bash
curl https://api.refactorforge.com/api/github/integrations \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Example Response:**
```json
{
  "integrations": [
    {
      "id": "integration-intellipact-observability",
      "repository": "IntelliPact/IntelliPact-Observability",
      "status": "active",
      "lastSync": "2024-01-15T15:30:00.000Z",
      "patternsCount": 247,
      "webhooksEnabled": true,
      "branches": ["main", "develop", "feature/*"],
      "settings": {
        "autoSave": true,
        "categories": ["devops", "monitoring", "azure"],
        "minStars": 1
      }
    }
  ],
  "total": 9,
  "active": 9,
  "totalPatterns": 2154,
  "webhooksActive": 9
}
```

#### Add GitHub Integration
```http
POST /api/github/integrations
Content-Type: application/json
```

Adds a new GitHub repository integration.

**Request Body:**
```json
{
  "repository": "octocat/Hello-World",
  "settings": {
    "autoSave": true,
    "categories": ["sample", "demo"],
    "minStars": 0
  }
}
```

**Example Request:**
```bash
curl -X POST https://api.refactorforge.com/api/github/integrations \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{
       "repository": "octocat/Hello-World",
       "settings": {
         "autoSave": true,
         "categories": ["sample", "demo"],
         "minStars": 0
       }
     }'
```

#### Sync Integration
```http
POST /api/github/integrations/{id}/sync
```

Manually triggers synchronization for a specific integration.

**Example Request:**
```bash
curl -X POST https://api.refactorforge.com/api/github/integrations/integration-hello-world/sync \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Integration integration-hello-world synced successfully",
  "patternsCount": 23,
  "lastSync": "2024-01-15T10:30:00.000Z"
}
```

### Performance Monitoring

#### Get Performance Metrics
```http
GET /api/performance/metrics?minutes=30&detailed=false
```

Retrieves performance metrics for the specified time window.

**Query Parameters:**
- `minutes` (integer): Time window in minutes (default: 5, max: 1440)
- `detailed` (boolean): Include detailed metric points (default: false)

**Example Request:**
```bash
curl "https://api.refactorforge.com/api/performance/metrics?minutes=60" \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Example Response:**
```json
{
  "requests": {
    "total": 1456,
    "errors": 12,
    "averageResponseTime": 145.7,
    "p95ResponseTime": 289.3,
    "p99ResponseTime": 567.8,
    "throughput": 24.27,
    "errorRate": 0.008
  },
  "system": {
    "averageMemoryUsage": 0.67,
    "peakMemoryUsage": 0.82,
    "averageCPUUsage": 23.4,
    "peakCPUUsage": 67.8,
    "averageEventLoopDelay": 2.3,
    "maxEventLoopDelay": 12.7
  },
  "alerts": {
    "total": 3,
    "critical": 0,
    "high": 1,
    "unresolved": 2
  }
}
```

#### Get Performance Alerts
```http
GET /api/performance/alerts?severity=high&resolved=false
```

Retrieves performance alerts with optional filtering.

**Query Parameters:**
- `severity` (string): Filter by alert severity (low, medium, high, critical)
- `resolved` (boolean): Filter by resolution status

**Example Request:**
```bash
curl "https://api.refactorforge.com/api/performance/alerts?resolved=false" \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Example Response:**
```json
{
  "alerts": [
    {
      "id": "alert-memory-001",
      "type": "memory",
      "severity": "high",
      "message": "High memory usage: 82.4%",
      "value": 0.824,
      "threshold": 0.8,
      "timestamp": "2024-01-15T10:25:00.000Z",
      "resolved": false
    },
    {
      "id": "alert-response-002",
      "type": "response_time",
      "severity": "medium",
      "message": "Elevated response time: 1247ms",
      "value": 1247,
      "threshold": 1000,
      "timestamp": "2024-01-15T10:28:00.000Z",
      "resolved": false
    }
  ]
}
```

## Webhook Integration

### GitHub Webhooks

RefactorForge supports real-time repository analysis through GitHub webhooks.

#### Setup GitHub Webhook

1. Go to your repository settings
2. Click "Webhooks" → "Add webhook"
3. Set Payload URL: `https://api.refactorforge.com/api/webhooks/github`
4. Set Content type: `application/json`
5. Generate a secret key and add it to your RefactorForge configuration
6. Select events: `Push`, `Pull requests`, `Issues`

#### Webhook Event Processing

```http
POST /api/webhooks/github
X-GitHub-Event: push
X-Hub-Signature-256: sha256=abc123...
Content-Type: application/json
```

**Supported Events:**
- **Push**: Triggers pattern analysis on code changes
- **Pull Request**: Analyzes PR changes and provides recommendations
- **Issues**: Links issues to detected patterns and recommendations

**Example Webhook Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "processed": {
    "event": "push",
    "repository": "octocat/Hello-World",
    "branch": "main",
    "commits": 3,
    "patternsUpdated": 12,
    "recommendationsGenerated": 5
  }
}
```

## SDK Examples

### JavaScript/TypeScript SDK

```typescript
import { RefactorForgeClient } from '@refactorforge/sdk';

const client = new RefactorForgeClient({
  baseUrl: 'https://api.refactorforge.com',
  token: 'ghp_xxxxxxxxxxxxxxxxxxxx'
});

// Add repository
const repository = await client.repositories.add({
  owner: 'octocat',
  repo: 'Hello-World',
  branch: 'main',
  categories: ['sample']
});

// Scan repository
const scanJob = await client.repositories.scan(repository.id);

// Wait for completion
const result = await client.jobs.waitForCompletion(scanJob.jobId);

// Get patterns
const patterns = await client.patterns.search({
  repository: 'octocat/Hello-World',
  category: 'function',
  limit: 50
});

console.log(`Found ${patterns.total} patterns`);
```

### Python SDK

```python
from refactorforge import RefactorForgeClient

client = RefactorForgeClient(
    base_url="https://api.refactorforge.com",
    token="ghp_xxxxxxxxxxxxxxxxxxxx"
)

# Add repository
repository = client.repositories.add(
    owner="octocat",
    repo="Hello-World",
    branch="main",
    categories=["sample"]
)

# Scan repository
scan_job = client.repositories.scan(repository["id"])

# Get patterns
patterns = client.patterns.search(
    repository="octocat/Hello-World",
    category="function",
    limit=50
)

print(f"Found {patterns['total']} patterns")
```

### cURL Examples

```bash
# Health check
curl https://api.refactorforge.com/api/health

# Add repository
curl -X POST https://api.refactorforge.com/api/repositories \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx" \
     -H "Content-Type: application/json" \
     -d '{"owner": "octocat", "repo": "Hello-World", "branch": "main"}'

# Search patterns
curl "https://api.refactorforge.com/api/patterns?search=async&limit=10" \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx"

# Get performance metrics
curl "https://api.refactorforge.com/api/performance/metrics?minutes=60" \
     -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx"
```

## Best Practices

### API Usage
1. **Use pagination** for large datasets to avoid timeouts
2. **Cache responses** when appropriate to reduce API calls
3. **Handle rate limits** gracefully with exponential backoff
4. **Validate input** before making API calls
5. **Monitor performance** metrics for optimization opportunities

### Security
1. **Protect API tokens** - never expose them in client-side code
2. **Use HTTPS** for all API communications
3. **Validate webhook signatures** for security
4. **Rotate tokens** regularly
5. **Monitor API usage** for unusual patterns

### Performance
1. **Use appropriate batch sizes** for bulk operations
2. **Enable caching** where possible
3. **Filter results** to reduce payload sizes
4. **Use webhooks** for real-time updates instead of polling
5. **Monitor system resources** and scale accordingly

---

For more information and support, visit our [documentation site](https://docs.refactorforge.com) or contact our support team.