# RefactorForge Error Handling System

A comprehensive, production-ready error handling system implementing security-first practices and user-friendly error management.

## 🏗️ Architecture Overview

The error handling system is built with multiple layers of protection and comprehensive monitoring:

### Backend Error Handling
- **Global Error Classes**: Typed error hierarchy with proper categorization
- **Middleware Integration**: Centralized error handling for all Express routes
- **Database Error Recovery**: Automatic retry logic with exponential backoff
- **GitHub API Resilience**: Circuit breaker pattern and rate limit handling
- **Security-First Logging**: Sanitized error messages without sensitive data exposure

### Frontend Error Handling
- **React Error Boundaries**: Comprehensive error catching at component, page, and application levels
- **Custom Error Hooks**: Functional component error handling utilities
- **API Error Management**: Robust API client with retry logic and error reporting
- **User-Friendly Fallbacks**: Graceful degradation with actionable error messages

## 🔧 Backend Implementation

### 1. Error Classes (`/src/errors/AppError.ts`)

```typescript
// Structured error hierarchy
export class AppError extends Error {
  constructor(message, code, statusCode, isOperational, context, details) {
    // Comprehensive error information with correlation IDs
  }
  
  toClientSafe() {
    // Security-sanitized error responses
  }
}

// Specialized error types
export class ValidationError extends AppError
export class DatabaseError extends AppError  
export class GitHubError extends AppError
export class NotFoundError extends AppError
export class TimeoutError extends AppError
```

### 2. Global Error Middleware (`/src/middleware/errorHandler.ts`)

```typescript
export function globalErrorHandler(error, req, res, next) {
  // Convert all errors to AppError instances
  // Add request context and correlation IDs
  // Log with appropriate security filtering
  // Return sanitized client responses
}

export function asyncHandler(fn) {
  // Wrapper for async route handlers
  // Automatic error catching and forwarding
}
```

### 3. Database Error Handling (`/src/utils/database-helpers.ts`)

```typescript
// Enhanced database operations with retry logic
export const dbAll = async (query, params, options) => {
  return withDatabaseErrorHandling('all', query, params, options);
};

export async function withTransaction(operations) {
  // Automatic transaction management
  // Rollback on errors with proper cleanup
}
```

### 4. GitHub API Error Handling (`/src/utils/github-error-handler.ts`)

```typescript
export class GitHubApiClient {
  async execute(operation, operationName, options) {
    // Circuit breaker pattern
    // Exponential backoff retry
    // Rate limit handling
  }
}
```

### 5. Error Reporting Routes (`/src/routes/errors.ts`)

```typescript
// Client error reporting endpoints
POST /api/errors/report        - General error reporting
POST /api/errors/critical      - Critical error alerts  
POST /api/errors/api          - API error reporting
GET  /api/errors/stats        - Error monitoring dashboard
```

## 🎨 Frontend Implementation

### 1. Error Boundaries (`/src/components/ErrorBoundary.tsx`)

```typescript
// Multi-level error boundaries
<CriticalErrorBoundary>      // Application-wide errors
  <PageErrorBoundary>        // Page-level errors
    <ComponentErrorBoundary> // Component-level errors
      <YourComponent />
    </ComponentErrorBoundary>
  </PageErrorBoundary>
</CriticalErrorBoundary>

// Custom error boundary with reporting
export class ErrorBoundary extends Component {
  componentDidCatch(error, errorInfo) {
    // Automatic error reporting to backend
    // Detailed logging in development
    // Sanitized reporting in production
  }
}
```

### 2. Error Handling Hooks (`/src/hooks/useErrorHandling.ts`)

```typescript
// Comprehensive error management
const { handleError, clearErrors } = useErrorHandler({
  showSnackbar: true,
  reportToServer: true,
  retryable: true
});

// Async operation error handling
const { execute, retry, canRetry } = useAsyncError();

// Form validation errors
const { fieldErrors, handleValidationError } = useFormError();
```

### 3. API Client (`/src/utils/apiClient.ts`)

```typescript
// Robust API client with error handling
export const api = {
  get: (endpoint) => apiClient.get(endpoint),
  post: (endpoint, data) => apiClient.post(endpoint, data),
  // Automatic retry logic
  // Error reporting integration
  // Network error handling
};
```

## 🛡️ Security Features

### 1. Data Sanitization
- **Sensitive Information Filtering**: Automatic removal of passwords, tokens, secrets
- **Stack Trace Filtering**: Production vs development error detail levels
- **Request Sanitization**: Headers and body content filtering
- **Context Sanitization**: Safe error context without sensitive data

### 2. Production Safety
```typescript
// Development vs Production error handling
const message = isProduction ? 
  this.getProductionMessage() : 
  this.originalMessage;

// Stack trace exposure control
if (process.env.NODE_ENV === 'development') {
  errorResponse.stack = error.stack;
}
```

### 3. Rate Limiting & Monitoring
- **Error Report Rate Limiting**: Prevent error spam attacks
- **Correlation IDs**: Track errors across distributed systems
- **Security Alert Integration**: Critical error notifications
- **Audit Logging**: Security-sensitive operation tracking

## 📊 Monitoring & Analytics

### 1. Error Statistics
```typescript
GET /api/errors/stats?timeframe=24h
{
  "total": 42,
  "byLevel": [
    { "level": "component", "count": 25 },
    { "level": "page", "count": 12 },
    { "level": "critical", "count": 5 }
  ],
  "byComponent": [...],
  "recent": [...]
}
```

### 2. Error Tracking Database Schema
```sql
CREATE TABLE client_error_reports (
  id TEXT PRIMARY KEY,
  error_id TEXT NOT NULL UNIQUE,
  message TEXT NOT NULL,
  stack TEXT,
  level TEXT NOT NULL DEFAULT 'component',
  component TEXT,
  context TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Usage Examples

### Backend Route with Error Handling
```typescript
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('ID is required');
  }
  
  const record = await dbGet('SELECT * FROM table WHERE id = ?', [id]);
  
  if (!record) {
    throw new NotFoundError('Record', id);
  }
  
  logger.info('Record retrieved', { id });
  res.json(record);
}));
```

### Frontend Error Handling
```typescript
const MyComponent = () => {
  const { handleError } = useErrorHandler();
  const { execute, isLoading, error } = useAsyncError();
  
  const loadData = async () => {
    try {
      const data = await execute(() => api.get('/api/data'));
      setData(data);
    } catch (error) {
      handleError(error, { component: 'MyComponent', operation: 'loadData' });
    }
  };
  
  return (
    <ComponentErrorBoundary>
      {/* Component content */}
    </ComponentErrorBoundary>
  );
};
```

### GitHub API with Error Handling
```typescript
const client = createGitHubClient(process.env.GITHUB_TOKEN);

const data = await client.execute(async () => {
  return octokit.rest.repos.get({ owner, repo });
}, 'getRepository');
```

## 🔄 Error Recovery Patterns

### 1. Automatic Retry
- **Exponential Backoff**: Progressive delay between retries
- **Jitter**: Randomized delays to prevent thundering herd
- **Circuit Breaker**: Temporary service blocking after repeated failures
- **Selective Retry**: Only retry recoverable errors

### 2. Graceful Degradation
- **Fallback UI**: Alternative interfaces when components fail
- **Cached Data**: Serve stale data when fresh data unavailable  
- **Reduced Functionality**: Core features remain when auxiliary features fail
- **Progressive Enhancement**: Basic functionality + enhanced features

### 3. User Communication
- **Clear Error Messages**: User-friendly explanations without technical jargon
- **Actionable Suggestions**: Clear next steps for users
- **Status Indicators**: Visual feedback on system state
- **Recovery Options**: Retry buttons, alternative actions

## 🔧 Configuration

### Environment Variables
```bash
# Logging Configuration
LOG_LEVEL=info                    # debug, info, warn, error
NODE_ENV=production              # development, production

# Error Reporting
ENABLE_ERROR_REPORTING=true      # Enable error reporting
ERROR_RETENTION_DAYS=30          # How long to keep error reports

# GitHub Integration
GITHUB_TOKEN=ghp_xxxxx          # GitHub API token
GITHUB_WEBHOOK_SECRET=secret     # Webhook signature verification
```

### Frontend Configuration
```typescript
// API Client Configuration
apiClient.setOptions({
  timeout: 30000,
  retries: 3,
  enableErrorReporting: true
});

// Error Boundary Configuration  
<ErrorBoundary
  level="critical"
  enableReporting={true}
  reportingEndpoint="/api/errors/critical"
>
  <App />
</ErrorBoundary>
```

## 📋 Best Practices

### 1. Error Classification
- **Operational Errors**: Expected errors (validation, not found, etc.)
- **Programming Errors**: Bugs that should be fixed (null reference, etc.)
- **System Errors**: Infrastructure issues (database down, network errors)

### 2. Error Context
- **Request Correlation**: Track errors across request lifecycle
- **User Context**: Associate errors with specific users/sessions
- **System State**: Include relevant system information
- **Business Context**: Add domain-specific error context

### 3. Security Considerations
- **Never expose sensitive data** in error messages
- **Log detailed errors internally** but return generic messages to clients
- **Implement rate limiting** on error reporting endpoints
- **Monitor for suspicious error patterns**

## 🛠️ Development Tools

### Error Testing
```typescript
// Test error boundaries
const ThrowError = () => {
  throw new Error('Test error');
};

// Test API errors
await api.get('/api/nonexistent'); // Should trigger error handling

// Test database errors  
await dbGet('INVALID SQL'); // Should retry and handle gracefully
```

### Error Monitoring
```bash
# View error logs
tail -f logs/error.log

# Check error statistics
curl /api/errors/stats

# Monitor circuit breaker status
curl /api/health
```

## 🔍 Troubleshooting

### Common Issues

1. **Error Boundaries Not Catching Errors**
   - Ensure errors are thrown in render methods or lifecycle methods
   - Async errors need explicit handling with error hooks

2. **Database Connection Errors**
   - Check retry configuration
   - Verify connection string and permissions
   - Monitor for connection pool exhaustion

3. **GitHub API Rate Limiting**
   - Implement proper rate limit handling
   - Use circuit breaker to prevent cascade failures
   - Check token permissions and quotas

4. **Memory Leaks in Error Reporting**
   - Implement error report cleanup
   - Limit error context size
   - Use weak references where appropriate

## 📈 Performance Considerations

### 1. Error Reporting Overhead
- **Async Error Reporting**: Don't block user operations
- **Batched Reporting**: Group multiple errors
- **Rate Limiting**: Prevent error spam
- **Circuit Breaking**: Stop reporting when backend is down

### 2. Error Storage
- **Database Indexing**: Efficient error queries
- **Data Retention**: Automatic cleanup of old errors
- **Compression**: Compress large error contexts
- **Partitioning**: Separate error data by time/severity

## 🚀 Deployment

### Production Checklist
- [ ] Error reporting endpoints secured
- [ ] Sensitive data sanitization verified
- [ ] Error retention policies configured
- [ ] Monitoring dashboards set up
- [ ] Alert notifications configured
- [ ] Error rate baselines established
- [ ] Circuit breaker thresholds tuned
- [ ] Database error table created and indexed

This comprehensive error handling system provides production-ready error management with security-first practices, comprehensive monitoring, and user-friendly error experiences.