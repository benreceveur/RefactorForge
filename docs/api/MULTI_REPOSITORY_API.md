# RefactorForge Multi-Repository API Documentation

## Overview

RefactorForge v2.0 provides a comprehensive code intelligence platform supporting multi-repository analysis, pattern extraction, and recommendation generation across 9 IntelliPact repositories with 2,154+ patterns.

## Base URL
```
http://localhost:8001/api
```

## Core Features
- **Multi-Repository Support**: Analyze and manage patterns across multiple repositories
- **Tech Stack Detection**: Automatically detect technologies and frameworks
- **Pattern Extraction**: Extract code patterns using AST analysis
- **Recommendation Engine**: Generate repository-specific recommendations
- **Template Generation**: Create dynamic code templates from patterns
- **Cross-Repository Analysis**: Compare and analyze patterns across repositories

## API Endpoints

### Repository Management

#### GET /repositories
Get all repositories with their metadata.

**Response:**
```json
{
  "repositories": [
    {
      "id": "repo-1",
      "name": "IntelliPact-Observability",
      "fullName": "IntelliPact/IntelliPact-Observability",
      "patternsCount": 247,
      "language": "TypeScript",
      "techStack": ["typescript", "devops", "monitoring"],
      "analysisStatus": "completed",
      "lastAnalyzed": "2025-08-25T15:30:00.000Z"
    }
  ]
}
```

#### GET /repositories/:id
Get specific repository details.

#### POST /repositories
Create a new repository entry.

**Request Body:**
```json
{
  "name": "Repository Name",
  "fullName": "Organization/Repository",
  "organization": "IntelliPact",
  "repositoryUrl": "https://github.com/org/repo",
  "clonePath": "/path/to/local/clone"
}
```

### Repository Analysis

#### POST /analysis/repositories/:id/analyze
Trigger repository analysis for pattern extraction and tech stack detection.

**Request Body:**
```json
{
  "repoPath": "/path/to/repository",
  "fullScan": true
}
```

**Response:**
```json
{
  "message": "Analysis started",
  "jobId": "job-uuid",
  "repositoryId": "repo-id",
  "jobType": "full_scan",
  "status": "queued"
}
```

#### GET /analysis/repositories/:id/status
Get analysis status and progress.

**Response:**
```json
{
  "repositoryId": "repo-id",
  "analysisStatus": "analyzing",
  "patternsCount": 156,
  "currentJob": {
    "id": "job-id",
    "status": "running",
    "progress": 0.7,
    "startedAt": "2025-08-25T10:00:00.000Z",
    "results": {
      "patternsExtracted": 156,
      "techStackDetected": ["typescript", "react"],
      "confidence": 0.95
    }
  }
}
```

#### GET /analysis/repositories/:id/patterns
Get patterns extracted from a specific repository.

**Query Parameters:**
- `limit` (default: 50): Number of patterns to return
- `offset` (default: 0): Pagination offset
- `category`: Filter by pattern category
- `language`: Filter by programming language
- `minConfidence` (default: 0.5): Minimum confidence score
- `search`: Search in pattern content and description

**Response:**
```json
{
  "patterns": [
    {
      "id": "pattern-id",
      "repositoryId": "repo-id",
      "content": "const logger = winston.createLogger({...});",
      "description": "Winston logger configuration",
      "category": "logging",
      "language": "typescript",
      "confidenceScore": 0.92,
      "filePath": "src/logging/config.ts",
      "tags": ["logging", "winston", "configuration"]
    }
  ],
  "pagination": {
    "total": 247,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### GET /analysis/repositories/:id/recommendations
Get repository-specific recommendations.

**Query Parameters:**
- `priority`: Filter by priority (low, medium, high, critical)
- `type`: Filter by recommendation type
- `status`: Filter by status (active, implemented, dismissed)

**Response:**
```json
{
  "repositoryId": "repo-id",
  "recommendations": [
    {
      "id": "rec-id",
      "title": "Improve Error Handling Coverage",
      "description": "Only 30% of functions have proper error handling...",
      "recommendationType": "best_practices",
      "priority": "medium",
      "applicablePatterns": ["pattern-id-1", "pattern-id-2"],
      "codeExamples": [
        {
          "title": "Add proper error handling",
          "before": "async function fetchData(url) {...}",
          "after": "async function fetchData(url) { try {...} catch {...} }",
          "explanation": "Proper error handling prevents crashes..."
        }
      ],
      "implementationSteps": [
        {
          "step": 1,
          "title": "Identify functions without error handling",
          "estimatedTime": "1 hour"
        }
      ],
      "estimatedEffort": "4-7 hours",
      "tags": ["error-handling", "reliability"]
    }
  ],
  "summary": {
    "total": 8,
    "byPriority": { "high": 2, "medium": 4, "low": 2 },
    "byType": { "best_practices": 3, "performance": 2, "security": 3 }
  }
}
```

### Cross-Repository Analysis

#### POST /analysis/patterns/search/cross-repo
Search patterns across multiple repositories.

**Request Body:**
```json
{
  "query": "authentication",
  "repositories": ["repo-1", "repo-2"],
  "category": "security",
  "language": "typescript",
  "minConfidence": 0.7,
  "limit": 50
}
```

**Response:**
```json
{
  "query": "authentication",
  "results": [
    {
      "id": "pattern-id",
      "content": "const useAuth = () => {...}",
      "description": "Custom authentication hook",
      "repository_name": "Intellipact",
      "repository_full_name": "IntelliPact/Intellipact",
      "category": "authentication",
      "confidenceScore": 0.95
    }
  ],
  "summary": {
    "totalMatches": 23,
    "repositoriesSearched": 2,
    "matchesByRepository": {
      "Intellipact": 15,
      "IntelliPact-Observability": 8
    }
  }
}
```

#### GET /analysis/repositories/compare
Compare patterns and tech stacks between repositories.

**Query Parameters:**
- `repos`: Comma-separated repository IDs

**Response:**
```json
{
  "repositories": [
    {
      "id": "repo-1",
      "name": "Intellipact",
      "tech_stack": ["typescript", "react", "node"]
    }
  ],
  "comparison": {
    "techStackOverlap": {
      "typescript": 2,
      "react": 2
    },
    "patternSimilarity": {
      "repo-1-repo-2": 0.65
    },
    "languageDistribution": {
      "repo-1": { "typescript": 145, "javascript": 23 }
    },
    "recommendations": [
      "Consider standardizing patterns for shared technologies: typescript, react"
    ]
  }
}
```

#### GET /analysis/patterns/trending
Get trending patterns across all repositories.

**Query Parameters:**
- `timeframe` (default: 30d): Time period (7d, 30d, 90d)
- `limit` (default: 20): Number of patterns to return
- `category`: Filter by category
- `language`: Filter by language

### Pattern Management

#### GET /patterns
Get all patterns with advanced filtering.

#### POST /patterns/search
Search patterns with similarity scoring.

#### POST /patterns/similar
Find similar patterns to a given pattern.

### Template Generation

#### POST /templates/generate
Generate code templates for a repository.

**Request Body:**
```json
{
  "repositoryId": "repo-id",
  "categories": ["interface", "function"],
  "languages": ["typescript"]
}
```

**Response:**
```json
{
  "repositoryId": "repo-id",
  "templates": [
    {
      "id": "template-id",
      "name": "TypeScript Interface",
      "description": "Generate a TypeScript interface with common properties",
      "category": "interface",
      "applicableLanguages": ["typescript"],
      "template": "interface {{interfaceName}} { ... }",
      "variables": [
        {
          "name": "interfaceName",
          "type": "string",
          "description": "Name of the interface",
          "required": true,
          "validation": { "pattern": "^[A-Z][a-zA-Z0-9]*$" }
        }
      ],
      "examples": [
        {
          "title": "User Interface",
          "variables": { "interfaceName": "User" },
          "expectedOutput": "interface User { ... }"
        }
      ]
    }
  ],
  "summary": {
    "total": 5,
    "byCategory": { "interface": 2, "function": 2, "class": 1 },
    "byLanguage": { "typescript": 5 }
  }
}
```

#### POST /templates/render
Render a template with provided variables.

**Request Body:**
```json
{
  "templateId": "template-id",
  "variables": {
    "interfaceName": "User",
    "properties": [
      { "name": "id", "type": "string", "required": true },
      { "name": "name", "type": "string", "required": true }
    ]
  },
  "targetFile": "src/types/user.ts",
  "insertionPoint": "cursor"
}
```

#### GET /templates/repository/:id
Get all available templates for a repository.

#### GET /templates/categories
Get available template categories and their descriptions.

#### POST /templates/validate
Validate template variables before rendering.

#### POST /templates/preview
Preview rendered template without saving.

#### GET /templates/popular
Get most popular/frequently used templates.

## Repository-Specific Features

### IntelliPact (892 patterns)
- **Focus**: Full-stack TypeScript applications
- **Recommendations**: Authentication patterns, API design, React hooks
- **Templates**: CRUD operations, middleware patterns, component structures

### IntelliPact-Observability (247 patterns)
- **Focus**: DevOps, monitoring, logging
- **Recommendations**: Prometheus metrics, log aggregation, health checks
- **Templates**: Monitoring dashboards, alert configurations, logging setups

### Normalization_Middleware (321 patterns)
- **Focus**: Azure middleware, data transformation
- **Recommendations**: Pipeline patterns, error handling, data validation
- **Templates**: Middleware functions, Azure integrations, transformation pipelines

### bMigrate (156 patterns)
- **Focus**: Legacy system migration
- **Recommendations**: Data migration patterns, compatibility layers
- **Templates**: Migration scripts, rollback procedures, data mappers

### Tool-Box (127 patterns)
- **Focus**: Utility functions and helpers
- **Recommendations**: Reusable utilities, helper functions, common patterns
- **Templates**: Utility functions, error handlers, data processors

### Western-Dental (89 patterns)
- **Focus**: Healthcare-specific patterns
- **Recommendations**: HIPAA compliance, data security, audit trails
- **Templates**: Patient data handlers, compliance checkers, audit loggers

### azfunc (78 patterns)
- **Focus**: Azure Functions, serverless architecture
- **Recommendations**: Function optimization, cold start reduction, event handling
- **Templates**: HTTP triggers, timer functions, event processors

### intellipact-landing-page (43 patterns)
- **Focus**: React frontend, performance optimization
- **Recommendations**: SEO optimization, lazy loading, performance tuning
- **Templates**: Component patterns, performance hooks, SEO components

### RefactorForge (201 patterns)
- **Focus**: Code analysis, refactoring tools
- **Recommendations**: AST manipulation, code transformation, analysis patterns
- **Templates**: Analyzer patterns, refactoring utilities, transformation tools

## Authentication & Security

### API Authentication
Currently, the API operates without authentication for development purposes. In production:

```javascript
// Add JWT authentication header
Authorization: Bearer <jwt-token>
```

### Rate Limiting
- 100 requests per 15-minute window per IP
- Higher limits available for authenticated users
- Analysis operations may have separate limits

### CORS Policy
- Configurable origins via environment variables
- Default allows localhost:3000 for development

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "details": "Detailed error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-08-25T10:00:00.000Z"
}
```

## Performance Considerations

### Database Optimization
- Composite indexes on frequently queried columns
- Pattern content hashing for deduplication
- Repository-based partitioning for large datasets

### Caching Strategy
- Pattern results cached for 15 minutes
- Template generation results cached for 1 hour
- Repository metadata cached for 5 minutes

### Background Processing
- Analysis jobs run asynchronously
- Progress tracking via WebSocket connections (planned)
- Job queue for handling multiple concurrent analyses

## Usage Examples

### Complete Repository Analysis Workflow

```javascript
// 1. Create repository entry
const repo = await fetch('/api/repositories', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'MyProject',
    fullName: 'org/MyProject',
    organization: 'org',
    repositoryUrl: 'https://github.com/org/MyProject'
  })
});

// 2. Start analysis
const analysis = await fetch(`/api/analysis/repositories/${repo.id}/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    repoPath: '/path/to/project',
    fullScan: true
  })
});

// 3. Monitor progress
const status = await fetch(`/api/analysis/repositories/${repo.id}/status`);

// 4. Get recommendations
const recommendations = await fetch(`/api/analysis/repositories/${repo.id}/recommendations`);

// 5. Generate templates
const templates = await fetch('/api/templates/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    repositoryId: repo.id,
    categories: ['interface', 'function'],
    languages: ['typescript']
  })
});
```

### Cross-Repository Pattern Search

```javascript
const searchResults = await fetch('/api/analysis/patterns/search/cross-repo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'authentication middleware',
    repositories: ['repo-1', 'repo-2', 'repo-3'],
    category: 'middleware',
    language: 'typescript',
    minConfidence: 0.8,
    limit: 25
  })
});
```

## Development & Testing

### Health Check
```
GET /api/health
```
Returns system status including database connectivity and performance metrics.

### Environment Variables
```bash
PORT=8001
NODE_ENV=development
DATABASE_PATH=./refactorforge.db
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Roadmap

### Phase 2 Features (Planned)
- Real-time WebSocket connections for analysis progress
- Advanced similarity algorithms using machine learning
- Integration with GitHub API for automated repository discovery
- Plugin system for custom recommendation generators
- Advanced template marketplace with community contributions

### Performance Improvements
- Redis caching layer
- PostgreSQL migration for better performance at scale
- Elasticsearch integration for advanced pattern search
- Distributed analysis processing

## Support & Documentation

For additional support or feature requests, please refer to the project repository or contact the development team.

---

**RefactorForge Multi-Repository API v2.0**  
*Advanced Code Intelligence Platform*