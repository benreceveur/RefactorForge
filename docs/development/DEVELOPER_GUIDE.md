# RefactorForge Developer Guide

## Table of Contents
- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Code Standards](#code-standards)
- [Performance Guidelines](#performance-guidelines)
- [Security Considerations](#security-considerations)
- [Contribution Guidelines](#contribution-guidelines)
- [Troubleshooting](#troubleshooting)

## Getting Started

RefactorForge is a sophisticated code intelligence platform built with enterprise-grade reliability, performance, and security in mind. This guide will help you set up your development environment and understand the contribution process.

### Prerequisites

Before starting development, ensure you have the following tools installed:

#### Required Tools
- **Node.js**: Version 18.17.0 or higher
- **npm**: Version 9.0.0 or higher (or yarn 1.22.0+)
- **Git**: Version 2.30.0 or higher
- **Docker**: Version 20.10.0+ (for containerized development)
- **Visual Studio Code**: Recommended IDE with TypeScript support

#### Recommended Extensions (VS Code)
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.rest-client"
  ]
}
```

#### Environment Variables
Create the necessary environment files:

**.env (Backend)**
```bash
# Server Configuration
PORT=8001
NODE_ENV=development

# Database
DATABASE_URL=./refactorforge.db
DATABASE_TIMEOUT=10000

# GitHub Integration
GITHUB_TOKEN=ghp_your_github_personal_access_token_here
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
PERFORMANCE_ALERT_THRESHOLDS={"responseTime":{"warning":1000,"critical":5000}}

# Secrets Management (choose one)
SECRETS_PROVIDER=env # env | aws | azure | gcp

# For AWS Secrets Manager
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# For Azure Key Vault
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_TENANT_ID=your_azure_tenant_id
AZURE_KEYVAULT_URL=https://your-keyvault.vault.azure.net/

# For Google Cloud Secret Manager
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GCP_PROJECT_ID=your-gcp-project-id

# OpenAI Integration (for AI analysis)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**.env (Frontend)**
```bash
REACT_APP_API_URL=http://localhost:8001
REACT_APP_ENVIRONMENT=development
REACT_APP_VERSION=2.1.0
GENERATE_SOURCEMAP=true
```

## Development Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/RefactorForge/RefactorForge.git
cd RefactorForge
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 3. Database Setup

The application uses SQLite with automatic schema migration:

```bash
# Initialize database (automatically done on first run)
cd backend
npm run dev # This will create the database and run migrations
```

### 4. Start Development Services

#### Option A: Individual Services
```bash
# Terminal 1 - Backend API (Port 8001)
cd backend
npm run dev

# Terminal 2 - Frontend Application (Port 8000)
cd frontend
npm start

# Terminal 3 - Memory API Server (Port 3721) - Optional
cd ~/.claude/memory/integrations/api-server
node server.js
```

#### Option B: Docker Compose (Recommended)
```bash
# Build and start all services
docker-compose up --build

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 5. Verify Installation

Once all services are running, verify the installation:

```bash
# Health check endpoints
curl http://localhost:8001/api/health
curl http://localhost:8000 # Should load React app
curl http://localhost:3721/health # Memory API (if running)
```

## Project Structure

```
RefactorForge/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── database.ts     # Database initialization
│   │   ├── errors/         # Error handling classes
│   │   ├── index.ts        # Main server entry point
│   │   ├── middleware/     # Express middleware
│   │   ├── performance/    # Performance monitoring
│   │   │   ├── connection-pool-manager.ts
│   │   │   ├── optimized-database-helpers.ts
│   │   │   ├── optimized-github-scanner.ts
│   │   │   ├── performance-monitor.ts
│   │   │   └── streaming-file-processor.ts
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic services
│   │   │   ├── github-scanner.ts
│   │   │   ├── recommendation-engine.ts
│   │   │   ├── repository-analyzer.ts
│   │   │   └── template-engine.ts
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   └── validation/     # Input validation schemas
│   ├── docs/               # API documentation
│   │   └── api/
│   │       ├── openapi.yaml
│   │       └── API_DOCUMENTATION.md
│   ├── __tests__/          # Test files
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # React.js application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   └── validation/     # Frontend validation
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
├── config/                 # Environment configuration
├── scripts/                # Utility scripts
├── docker-compose.yml      # Container orchestration
├── Dockerfile             # Container definition
├── DEVELOPER_GUIDE.md     # This file
├── SYSTEM_ARCHITECTURE.md # System documentation
└── README.md              # Project overview
```

## Development Workflow

### Branch Strategy

We use a modified Git Flow strategy:

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/**: Feature development branches
- **hotfix/**: Critical bug fixes
- **release/**: Release preparation branches

### Development Process

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Development**
   - Write code following our standards
   - Add comprehensive tests
   - Update documentation
   - Run local quality checks

3. **Quality Checks**
   ```bash
   # Backend checks
   cd backend
   npm run typecheck    # TypeScript compilation
   npm run lint         # ESLint checks
   npm run lint:fix     # Auto-fix linting issues
   npm run test         # Unit tests
   npm run test:coverage # Coverage report
   
   # Frontend checks
   cd frontend
   npm run typecheck
   npm run lint
   npm run test
   npm run build        # Production build test
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat(scanner): add advanced pattern detection
   
   - Implement ML-based pattern recognition
   - Add support for React hooks detection
   - Improve confidence scoring algorithm
   - Add comprehensive tests
   
   Closes #123"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create pull request through GitHub UI
   ```

### Commit Message Convention

We follow the Conventional Commits specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, missing semicolons, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or modifying tests
- `chore`: Build process or auxiliary tool changes

**Examples:**
```bash
feat(github): add webhook signature validation
fix(scanner): resolve rate limit handling bug
docs(api): update authentication examples
perf(db): optimize pattern query performance
test(scanner): add integration tests for GitHub API
```

## Testing Strategy

### Test Structure

```
__tests__/
├── unit/                   # Unit tests
│   ├── services/
│   ├── utils/
│   └── middleware/
├── integration/           # Integration tests
│   ├── routes/
│   └── database/
├── e2e/                  # End-to-end tests
└── fixtures/             # Test data
```

### Testing Commands

```bash
# Unit tests
npm test

# Watch mode during development
npm run test:watch

# Coverage report
npm run test:coverage

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

### Writing Tests

**Unit Test Example:**
```typescript
// src/services/__tests__/github-scanner.test.ts
import { GitHubScanner } from '../github-scanner';
import { GitHubRepository } from '../../types/github.types';

describe('GitHubScanner', () => {
  let scanner: GitHubScanner;
  
  beforeEach(() => {
    scanner = new GitHubScanner('fake-token');
  });

  describe('scanRepository', () => {
    it('should successfully scan a public repository', async () => {
      const repository: GitHubRepository = {
        owner: 'octocat',
        repo: 'Hello-World',
        branch: 'main'
      };

      const result = await scanner.scanRepository(repository);

      expect(result.scanSuccessful).toBe(true);
      expect(result.patterns).toBeDefined();
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('should handle rate limit errors gracefully', async () => {
      // Mock rate limit error
      jest.spyOn(scanner as any, 'checkRateLimit')
        .mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const repository: GitHubRepository = {
        owner: 'octocat',
        repo: 'Hello-World',
        branch: 'main'
      };

      const result = await scanner.scanRepository(repository);

      expect(result.scanSuccessful).toBe(false);
      expect(result.errorMessage).toContain('Rate limit');
    });
  });
});
```

**Integration Test Example:**
```typescript
// src/routes/__tests__/repositories.integration.test.ts
import request from 'supertest';
import app from '../../index';

describe('Repository API', () => {
  describe('GET /api/repositories', () => {
    it('should return paginated repository list', async () => {
      const response = await request(app)
        .get('/api/repositories')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('repositories');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.repositories).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/repositories', () => {
    it('should create a new repository', async () => {
      const repositoryData = {
        owner: 'testuser',
        repo: 'test-repo',
        branch: 'main'
      };

      const response = await request(app)
        .post('/api/repositories')
        .send(repositoryData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.fullName).toBe('testuser/test-repo');
    });
  });
});
```

### Test Data Management

Use fixtures for consistent test data:

```typescript
// __tests__/fixtures/repositories.ts
export const mockRepository = {
  id: 'repo-test-123',
  name: 'test-repo',
  fullName: 'testuser/test-repo',
  description: 'Test repository for unit tests',
  language: 'TypeScript',
  patternsCount: 42,
  lastUpdated: '2024-01-15T10:30:00.000Z',
  categories: ['test', 'mock']
};

export const mockPatterns = [
  {
    id: 'pattern-test-001',
    repositoryId: 'repo-test-123',
    patternType: 'function_declaration',
    content: 'async function testFunction() {}',
    category: 'function',
    confidenceScore: 0.95
  }
];
```

## Code Standards

### TypeScript Guidelines

1. **Strict Type Checking**
   ```typescript
   // tsconfig.json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "strictFunctionTypes": true
     }
   }
   ```

2. **Interface Definitions**
   ```typescript
   // Good: Comprehensive interface
   interface GitHubRepository {
     owner: string;
     repo: string;
     branch: string;
     description?: string;
     private?: boolean;
   }

   // Bad: Using 'any'
   interface BadRepository {
     data: any;
   }
   ```

3. **Error Handling**
   ```typescript
   // Good: Typed error handling
   try {
     const result = await scanRepository(repo);
     return { success: true, data: result };
   } catch (error) {
     if (error instanceof GitHubAPIError) {
       return { success: false, error: error.message };
     }
     throw error;
   }
   ```

### ESLint Configuration

Our ESLint configuration enforces code quality:

```json
// .eslintrc.json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### JSDoc Documentation Standards

All public APIs must have comprehensive JSDoc comments:

```typescript
/**
 * Scans a GitHub repository for code patterns and issues
 * 
 * @param repository - Repository configuration object
 * @param options - Optional scan configuration
 * @returns Promise resolving to scan results
 * 
 * @example
 * ```typescript
 * const scanner = new GitHubScanner(token);
 * const results = await scanner.scanRepository({
 *   owner: 'octocat',
 *   repo: 'Hello-World',
 *   branch: 'main'
 * });
 * ```
 * 
 * @throws {GitHubAPIError} When GitHub API request fails
 * @throws {RateLimitError} When rate limit is exceeded
 * 
 * @since 2.1.0
 */
public async scanRepository(
  repository: GitHubRepository,
  options?: ScanOptions
): Promise<ScanResult> {
  // Implementation...
}
```

## Performance Guidelines

### Backend Performance

1. **Database Optimization**
   ```typescript
   // Good: Use prepared statements with caching
   const results = await optimizedDbAll<Pattern>(
     'SELECT * FROM patterns WHERE repository_id = ? AND category = ?',
     [repositoryId, category],
     {
       enableCaching: true,
       cacheTTL: 60000,
       timeout: 5000
     }
   );

   // Bad: String concatenation
   const query = `SELECT * FROM patterns WHERE repository_id = '${repositoryId}'`;
   ```

2. **Async Operations**
   ```typescript
   // Good: Parallel processing
   const [patterns, security, performance] = await Promise.all([
     extractPatterns(content),
     detectSecurityIssues(content),
     detectPerformanceIssues(content)
   ]);

   // Bad: Sequential processing
   const patterns = await extractPatterns(content);
   const security = await detectSecurityIssues(content);
   const performance = await detectPerformanceIssues(content);
   ```

3. **Memory Management**
   ```typescript
   // Good: Stream large files
   if (file.size > STREAMING_THRESHOLD) {
     return this.processFileWithStreaming(file);
   }

   // Good: Cleanup resources
   try {
     const result = await operation();
     return result;
   } finally {
     await cleanup();
   }
   ```

### Frontend Performance

1. **Component Optimization**
   ```typescript
   // Good: Memoized component
   const PatternList = React.memo(({ patterns }: { patterns: Pattern[] }) => {
     return (
       <VirtualizedList
         items={patterns}
         renderItem={(pattern) => <PatternItem key={pattern.id} pattern={pattern} />}
       />
     );
   });

   // Good: Lazy loading
   const HeavyComponent = React.lazy(() => import('./HeavyComponent'));
   ```

2. **API Optimization**
   ```typescript
   // Good: Use React Query for caching
   const { data, isLoading, error } = useQuery({
     queryKey: ['patterns', repositoryId],
     queryFn: () => api.getRepositoryPatterns(repositoryId),
     staleTime: 5 * 60 * 1000, // 5 minutes
   });
   ```

## Security Considerations

### Authentication & Authorization

1. **GitHub Token Management**
   ```typescript
   // Good: Secure token handling
   const token = await AppSecrets.getSecret('GITHUB_TOKEN');
   const octokit = new Octokit({ auth: token });

   // Bad: Hardcoded tokens
   const octokit = new Octokit({ auth: 'ghp_hardcoded_token' });
   ```

2. **Input Validation**
   ```typescript
   // Good: Schema validation
   import { z } from 'zod';

   const repositorySchema = z.object({
     owner: z.string().min(1).max(39),
     repo: z.string().min(1).max(100),
     branch: z.string().min(1).max(250)
   });

   export const validateRepository = (data: unknown) => {
     return repositorySchema.parse(data);
   };
   ```

3. **SQL Injection Prevention**
   ```typescript
   // Good: Parameterized queries
   const patterns = await dbAll(
     'SELECT * FROM patterns WHERE repository_id = ? AND confidence > ?',
     [repositoryId, minConfidence]
   );

   // Bad: String concatenation
   const query = `SELECT * FROM patterns WHERE repository_id = '${repositoryId}'`;
   ```

### Secrets Management

All sensitive data should be managed through our secrets system:

```typescript
// Configuration
const secretsConfig = getSecretsConfig();
AppSecrets.initialize(secretsConfig);

// Usage
const githubToken = await AppSecrets.getSecret('GITHUB_TOKEN');
const dbPassword = await AppSecrets.getSecret('DATABASE_PASSWORD');
```

## Contribution Guidelines

### Pull Request Process

1. **Before Creating a PR**
   - Ensure all tests pass
   - Run linting and fix all issues
   - Update documentation if needed
   - Add changelog entry if applicable

2. **PR Description Template**
   ```markdown
   ## Description
   Brief description of what this PR does.

   ## Type of Change
   - [ ] Bug fix (non-breaking change which fixes an issue)
   - [ ] New feature (non-breaking change which adds functionality)
   - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows the project's style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No new TypeScript errors
   - [ ] Performance impact considered
   ```

3. **Review Process**
   - At least one code review required
   - All CI checks must pass
   - Documentation review if applicable
   - Performance review for significant changes

### Code Review Guidelines

**For Reviewers:**
- Focus on code quality, security, and performance
- Provide constructive feedback with examples
- Check test coverage and quality
- Verify documentation updates
- Consider the user experience impact

**For Authors:**
- Respond to all feedback
- Make requested changes or explain why not
- Keep PRs focused and reasonably sized
- Update the PR description if scope changes

### Release Process

1. **Feature Complete**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v2.2.0
   ```

2. **Prepare Release**
   - Update version numbers
   - Update CHANGELOG.md
   - Run full test suite
   - Update documentation

3. **Release**
   ```bash
   git checkout main
   git merge release/v2.2.0
   git tag v2.2.0
   git push origin main --tags
   ```

## Troubleshooting

### Common Development Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :8001
# Kill process
kill -9 <PID>
```

#### Database Lock Issues
```bash
# Remove database lock
rm backend/refactorforge.db-wal
rm backend/refactorforge.db-shm
```

#### TypeScript Compilation Errors
```bash
# Clean TypeScript cache
rm -rf backend/dist
rm backend/tsconfig.tsbuildinfo
# Rebuild
npm run build:clean
```

#### GitHub API Rate Limits
```bash
# Check current rate limit
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
     https://api.github.com/rate_limit
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"
```

### Performance Debugging

#### Enable Debug Logging
```bash
export DEBUG=refactorforge:*
export LOG_LEVEL=debug
npm run dev
```

#### Monitor Performance
```bash
# Check performance metrics
curl http://localhost:8001/api/performance/metrics

# View active alerts
curl http://localhost:8001/api/performance/alerts
```

#### Profile Memory Usage
```bash
# Generate heap snapshot
node --inspect backend/dist/index.js
# Open Chrome DevTools -> Memory tab
```

### Getting Help

1. **Check Documentation**
   - [API Documentation](backend/docs/api/API_DOCUMENTATION.md)
   - [System Architecture](SYSTEM_ARCHITECTURE.md)

2. **Common Resources**
   - GitHub Issues for bug reports
   - Discussions for feature requests
   - Wiki for additional guides

3. **Development Setup Issues**
   - Verify all prerequisites are installed
   - Check environment variable configuration
   - Ensure database permissions are correct
   - Verify GitHub token has required scopes

## Contributing to Documentation

Documentation improvements are always welcome! When updating docs:

1. Keep examples current and tested
2. Include practical use cases
3. Update the table of contents
4. Check for broken links
5. Ensure consistency with existing style

---

**Happy coding!** 🚀

*Last Updated: January 15, 2025*
*Version: 2.1.0*