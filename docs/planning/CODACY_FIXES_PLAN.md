# RefactorForge Codacy Issues Fix Plan

## Overview
This plan addresses all critical, major, and minor issues identified in the Codacy analysis, prioritized by severity and impact.

## Current Grade: C+ (69/100) → Target Grade: A (95/100)

---

## 🔴 Priority 1: Security Fixes (Week 1)
**Impact**: Critical | **Effort**: 2 days | **Target Score**: 75→95/100

### 1.1 Remove All Hardcoded Secrets

#### Files to Fix:
```
backend/src/routes/webhooks.ts:73
backend/src/index.ts:34
backend/src/services/github-scanner.ts
```

#### Actions:

**Step 1: Update .gitignore for Development Secrets**
```bash
# Add to .gitignore
.env
.env.*
!.env.example
*.key
*.pem
*.crt
secrets/
.secrets/
config/local.*
config/development.*
config/production.*
```

**Step 2: Create Secrets Management Structure**
```bash
# Create secrets directory structure
mkdir -p config/secrets
mkdir -p config/environments

# Create development secrets template
cat > config/secrets/.env.development.example << EOF
# Development Secrets (DO NOT COMMIT)
GITHUB_WEBHOOK_SECRET=generate-random-secret-here
GITHUB_TOKEN=ghp_your_development_token_here
JWT_SECRET=generate-random-jwt-secret
DATABASE_ENCRYPTION_KEY=generate-random-key
SESSION_SECRET=generate-random-session-secret
ADMIN_API_KEY=generate-random-admin-key
EOF

# Create production secrets template
cat > config/secrets/.env.production.example << EOF
# Production Secrets (USE ENVIRONMENT VARIABLES)
# These should be set in your deployment environment
# Never commit actual values
GITHUB_WEBHOOK_SECRET=\${GITHUB_WEBHOOK_SECRET}
GITHUB_TOKEN=\${GITHUB_TOKEN}
JWT_SECRET=\${JWT_SECRET}
DATABASE_ENCRYPTION_KEY=\${DATABASE_ENCRYPTION_KEY}
SESSION_SECRET=\${SESSION_SECRET}
ADMIN_API_KEY=\${ADMIN_API_KEY}
EOF
```

**Step 3: Fix Webhook Secret**
```typescript
// backend/src/routes/webhooks.ts
// REMOVE: const secret = process.env.GITHUB_WEBHOOK_SECRET || 'refactorforge-secret';
// REPLACE WITH:
const secret = process.env.GITHUB_WEBHOOK_SECRET;
if (!secret) {
  throw new Error('GITHUB_WEBHOOK_SECRET is required but not configured');
}
```

**Step 4: Fix Token Logging**
```typescript
// backend/src/index.ts
// REMOVE: console.log(`GitHub token configured: ${githubToken.substring(0, 10)}...`);
// REPLACE WITH:
console.log('GitHub token configured: [REDACTED]');
```

### 1.2 Environment Variable Validation

**Create validation utility:**
```typescript
// backend/src/utils/env-validator.ts
export function validateEnvironment(): void {
  const required = [
    'NODE_ENV',
    'GITHUB_WEBHOOK_SECRET',
    'JWT_SECRET',
    'SESSION_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate format
  if (process.env.GITHUB_TOKEN && !process.env.GITHUB_TOKEN.startsWith('ghp_')) {
    throw new Error('Invalid GitHub token format');
  }
}
```

### 1.3 SQL Injection Prevention

**Fix dynamic SQL queries:**
```typescript
// backend/src/routes/analysis.ts
// Use parameterized queries exclusively
const updateQuery = `
  UPDATE analysis_jobs 
  SET status = ?, 
      completed_at = ?,
      result = ?
  WHERE id = ?
`;

db.run(updateQuery, [status, new Date().toISOString(), JSON.stringify(result), jobId]);
```

---

## 🔴 Priority 2: Testing Infrastructure (Week 1-2)
**Impact**: Critical | **Effort**: 5 days | **Target Coverage**: 5%→30%→80%

### 2.1 Phase 1: Critical Path Tests (30% coverage)

**Test Implementation Order:**
1. Authentication & Authorization
2. Database operations
3. GitHub API integration
4. Core business logic
5. API endpoints

**Create test structure:**
```bash
# Backend test structure
mkdir -p backend/src/__tests__/{unit,integration,e2e}
mkdir -p backend/src/__tests__/unit/{services,routes,utils}
mkdir -p backend/src/__tests__/integration/{api,database}
mkdir -p backend/src/__tests__/fixtures

# Frontend test structure
mkdir -p frontend/src/__tests__/{components,hooks,utils}
mkdir -p frontend/src/__tests__/integration
```

**Critical Test Files to Create:**

```typescript
// backend/src/__tests__/unit/services/github-scanner.test.ts
describe('GitHubScanner', () => {
  describe('Security', () => {
    it('should never expose tokens in logs', async () => {
      // Test token masking
    });
    
    it('should validate repository input', async () => {
      // Test input validation
    });
  });
  
  describe('Core Functionality', () => {
    it('should scan public repository without token', async () => {
      // Test public repo scanning
    });
    
    it('should handle rate limiting gracefully', async () => {
      // Test rate limit handling
    });
  });
});

// backend/src/__tests__/integration/api/security.test.ts
describe('API Security', () => {
  it('should reject requests without authentication', async () => {
    const response = await request(app)
      .post('/api/admin/users')
      .send({ user: 'test' });
    
    expect(response.status).toBe(401);
  });
  
  it('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    const response = await request(app)
      .get(`/api/search?q=${maliciousInput}`);
    
    // Should sanitize input, not execute SQL
    expect(response.status).toBe(200);
    // Verify tables still exist
  });
});
```

### 2.2 Phase 2: Comprehensive Tests (80% coverage)

**Week 2 Test Plan:**
- Unit tests for all services
- Integration tests for all API endpoints
- E2E tests for critical user flows
- Frontend component tests

---

## 🟡 Priority 3: Code Complexity Refactoring (Week 2)
**Impact**: Major | **Effort**: 3 days | **Target**: Reduce complexity by 50%

### 3.1 Refactor github-scanner.ts

**Split into multiple services:**
```typescript
// backend/src/services/github/
// ├── scanner.ts (main orchestrator, <300 lines)
// ├── file-processor.ts (file handling)
// ├── api-client.ts (GitHub API wrapper)
// ├── rate-limiter.ts (rate limit handling)
// ├── cache-manager.ts (caching logic)
// └── types.ts (shared types)

// Example: scanner.ts (simplified)
export class GitHubScanner {
  constructor(
    private fileProcessor: FileProcessor,
    private apiClient: GitHubAPIClient,
    private rateLimiter: RateLimiter,
    private cache: CacheManager
  ) {}
  
  async scanRepository(owner: string, repo: string): Promise<ScanResult> {
    // Orchestrate scanning with dependency injection
    const cached = await this.cache.get(owner, repo);
    if (cached) return cached;
    
    await this.rateLimiter.checkLimit();
    const repoData = await this.apiClient.getRepository(owner, repo);
    const files = await this.fileProcessor.processFiles(repoData);
    
    const result = { repoData, files };
    await this.cache.set(owner, repo, result);
    return result;
  }
}
```

### 3.2 Extract Common Patterns

**Create database helper:**
```typescript
// backend/src/utils/database-helper.ts
export class DatabaseHelper {
  static async transaction<T>(
    operation: (db: Database) => Promise<T>
  ): Promise<T> {
    const db = getDatabase();
    try {
      await db.run('BEGIN TRANSACTION');
      const result = await operation(db);
      await db.run('COMMIT');
      return result;
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }
  
  static async findOne<T>(
    table: string,
    conditions: Record<string, any>
  ): Promise<T | null> {
    // Parameterized query builder
  }
}
```

---

## 🟡 Priority 4: Error Handling (Week 2)
**Impact**: Major | **Effort**: 2 days

### 4.1 Global Error Handler

```typescript
// backend/src/middleware/error-handler.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
  
  // Log unexpected errors
  console.error('Unexpected error:', err);
  
  // Don't leak error details in production
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
};
```

### 4.2 Frontend Error Boundary

```tsx
// frontend/src/components/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

---

## 🟢 Priority 5: Performance Optimization (Week 3)
**Impact**: Medium | **Effort**: 2 days

### 5.1 Fix Synchronous Operations

```typescript
// backend/src/services/file-processor.ts
// BEFORE: Synchronous processing
for (const file of files) {
  await processFile(file);
  await delay(100); // Blocking
}

// AFTER: Concurrent processing with limits
import pLimit from 'p-limit';

const limit = pLimit(5); // Process 5 files concurrently
const promises = files.map(file => 
  limit(() => processFile(file))
);
await Promise.all(promises);
```

### 5.2 Implement Streaming

```typescript
// backend/src/services/large-file-handler.ts
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

export async function processLargeFile(filePath: string) {
  const readStream = createReadStream(filePath);
  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      // Process chunk without loading entire file
      const processed = processChunk(chunk);
      callback(null, processed);
    }
  });
  
  await pipeline(readStream, transformStream, outputStream);
}
```

### 5.3 Add Database Connection Pooling

```typescript
// backend/src/database-pool.ts
import { Pool } from 'generic-pool';

const pool = createPool({
  create: async () => {
    return new Database('./refactorforge.db');
  },
  destroy: async (db) => {
    await db.close();
  },
  min: 2,
  max: 10
});

export async function withDatabase<T>(
  operation: (db: Database) => Promise<T>
): Promise<T> {
  const db = await pool.acquire();
  try {
    return await operation(db);
  } finally {
    await pool.release(db);
  }
}
```

---

## 🟢 Priority 6: Type Safety (Week 3)
**Impact**: Medium | **Effort**: 1 day

### 6.1 Replace 'any' Types

```typescript
// Find all 'any' types
// grep -r "any" --include="*.ts" --include="*.tsx" backend/src

// Replace with proper types or unknown
// BEFORE:
catch (error: any) {
  console.error(error.message);
}

// AFTER:
catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### 6.2 Add Return Types

```typescript
// tsconfig.json - enforce return types
{
  "compilerOptions": {
    "noImplicitReturns": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}

// Fix all functions
// BEFORE:
function calculate(a: number, b: number) {
  return a + b;
}

// AFTER:
function calculate(a: number, b: number): number {
  return a + b;
}
```

---

## 🟢 Priority 7: Documentation (Week 3-4)
**Impact**: Low | **Effort**: 3 days

### 7.1 Add JSDoc Comments

```typescript
/**
 * Scans a GitHub repository for code quality issues
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<ScanResult>} Scan results with metrics
 * @throws {AppError} If repository not found or rate limited
 * @example
 * const result = await scanner.scanRepository('facebook', 'react');
 */
export async function scanRepository(
  owner: string,
  repo: string
): Promise<ScanResult> {
  // Implementation
}
```

### 7.2 Generate API Documentation

```bash
# Install documentation generator
npm install --save-dev @apidevtools/swagger-cli typedoc

# Generate API docs
npx typedoc --out docs/api backend/src

# Generate OpenAPI spec
npx swagger-jsdoc -d swaggerDef.js backend/src/routes/*.ts -o openapi.json
```

---

## Implementation Timeline

### Week 1 (Days 1-5)
- [x] Day 1: Security fixes - Remove hardcoded secrets
- [x] Day 2: Security fixes - Environment validation, SQL injection
- [x] Days 3-5: Critical path tests (30% coverage)

### Week 2 (Days 6-10)
- [ ] Days 6-7: Complete test coverage (80% target)
- [ ] Days 8-9: Refactor complex files
- [ ] Day 10: Error handling implementation

### Week 3 (Days 11-15)
- [ ] Days 11-12: Performance optimizations
- [ ] Day 13: Type safety fixes
- [ ] Days 14-15: Documentation

### Week 4 (Days 16-20)
- [ ] Days 16-17: Final testing and validation
- [ ] Days 18-19: Code review and cleanup
- [ ] Day 20: Deploy fixes and verify metrics

---

## Success Metrics

| Metric | Current | Target | Deadline |
|--------|---------|--------|----------|
| Security Score | 75/100 | 95/100 | Week 1 |
| Test Coverage | 5% | 80% | Week 2 |
| Code Complexity | High | Medium | Week 2 |
| Type Safety | 85% | 100% | Week 3 |
| Documentation | 65% | 90% | Week 3 |
| **Overall Grade** | **C+ (69)** | **A (95)** | Week 4 |

---

## Validation Commands

```bash
# Security validation
npm audit
grep -r "hardcoded" --include="*.ts" backend/src
grep -r "secret" --include="*.ts" backend/src

# Test coverage
npm run test:coverage

# Type checking
npm run typecheck

# Linting
npm run lint

# Complexity analysis
npx eslint backend/src --format json | jq '.[] | select(.messages[].ruleId == "complexity")'

# Documentation coverage
npx typedoc --out docs backend/src --validation.invalidLink
```

---

## Risk Mitigation

1. **Breaking Changes**: Run full test suite after each change
2. **Performance Regression**: Benchmark before/after
3. **Security Introduction**: Security scan after each fix
4. **Deployment Issues**: Test in staging environment first

---

## Post-Implementation Monitoring

1. Set up error tracking (Sentry)
2. Implement performance monitoring (New Relic/DataDog)
3. Configure security scanning in CI/CD
4. Set up test coverage reporting (Codecov)
5. Schedule weekly security audits

---

*This plan will improve the codebase from Grade C+ (69/100) to Grade A (95/100) within 4 weeks.*