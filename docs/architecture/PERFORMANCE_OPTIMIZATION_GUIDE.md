# RefactorForge Performance Optimization Guide

## Table of Contents
- [Overview](#overview)
- [Performance Monitoring](#performance-monitoring)
- [GitHub API Optimization](#github-api-optimization)
- [Database Performance](#database-performance)
- [Application-Level Optimizations](#application-level-optimizations)
- [Memory Management](#memory-management)
- [Caching Strategies](#caching-strategies)
- [Scaling Considerations](#scaling-considerations)
- [Production Deployment](#production-deployment)
- [Performance Troubleshooting](#performance-troubleshooting)

## Overview

RefactorForge is designed for high-performance code analysis at enterprise scale. This guide provides comprehensive strategies to optimize performance across all system components, from GitHub API interactions to database queries and memory management.

### Performance Baseline Metrics

**Typical Performance Characteristics** (v2.1.0):
- **Repository Scan**: 50-200 files processed per minute (authenticated)
- **Pattern Extraction**: 1,000-5,000 patterns per minute
- **API Response Time**: <200ms (P95), <500ms (P99)
- **Memory Usage**: 200-500MB under normal load
- **Database Queries**: <10ms average query time
- **GitHub API Rate Limit**: 5,000 requests/hour (authenticated)

### Key Performance Features

RefactorForge v2.1.0 includes advanced performance optimizations:
- **Dynamic Rate Limit Management**: Automatically adjusts processing based on GitHub API limits
- **Intelligent Caching**: Multi-level caching with configurable TTL
- **Connection Pooling**: Persistent connections for database and HTTP
- **Streaming Processing**: Memory-efficient handling of large files
- **Concurrent Processing**: Optimized parallel processing with backpressure control
- **Performance Monitoring**: Real-time metrics and alerting

## Performance Monitoring

### Built-in Performance Monitor

RefactorForge includes a comprehensive performance monitoring system:

```bash
# Check current performance metrics
curl http://localhost:8001/api/performance/metrics

# View performance summary (last 30 minutes)
curl http://localhost:8001/api/performance/metrics?minutes=30

# Get detailed metrics with individual data points
curl http://localhost:8001/api/performance/metrics?minutes=10&detailed=true
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

### Performance Alerts

Configure performance alerts for proactive monitoring:

```bash
# Environment configuration
PERFORMANCE_THRESHOLDS='{
  "responseTime": {"warning": 1000, "critical": 5000},
  "memoryUsage": {"warning": 0.8, "critical": 0.9},
  "cpuUsage": {"warning": 70, "critical": 90},
  "errorRate": {"warning": 0.05, "critical": 0.1},
  "eventLoopDelay": {"warning": 10, "critical": 50}
}'
```

### Custom Monitoring Integration

Integrate with external monitoring systems:

```typescript
// Prometheus metrics export
app.get('/metrics', (req, res) => {
  const metrics = performanceMonitor.getPerformanceSummary(5);
  
  res.set('Content-Type', 'text/plain');
  res.send(`
    # HELP refactorforge_requests_total Total number of requests
    # TYPE refactorforge_requests_total counter
    refactorforge_requests_total ${metrics.requests.total}
    
    # HELP refactorforge_response_time_seconds Response time in seconds
    # TYPE refactorforge_response_time_seconds histogram
    refactorforge_response_time_seconds{quantile="0.95"} ${metrics.requests.p95ResponseTime / 1000}
    refactorforge_response_time_seconds{quantile="0.99"} ${metrics.requests.p99ResponseTime / 1000}
    
    # HELP refactorforge_memory_usage Memory usage ratio
    # TYPE refactorforge_memory_usage gauge
    refactorforge_memory_usage ${metrics.system.averageMemoryUsage}
  `);
});
```

## GitHub API Optimization

### Rate Limit Management

RefactorForge implements sophisticated rate limit management:

**Dynamic Batch Sizing**:
```typescript
// Automatically adjusts batch sizes based on remaining rate limit
private getOptimalBatchSize(): number {
  if (this.rateLimitRemaining > 3000) {
    return 10; // High rate limit: larger batches
  } else if (this.rateLimitRemaining > 1000) {
    return 5;  // Medium rate limit: moderate batches
  } else {
    return 3;  // Low rate limit: small batches
  }
}
```

**Configuration Options**:
```bash
# GitHub API optimization settings
GITHUB_SCANNER_FILE_LIMIT=100          # Maximum files per scan
GITHUB_SCANNER_BATCH_SIZE=10           # Files processed in parallel
GITHUB_API_TIMEOUT=30000               # API request timeout (ms)
GITHUB_RETRY_ATTEMPTS=3                # Number of retry attempts
GITHUB_RETRY_DELAY=1000               # Base retry delay (ms)
GITHUB_EXPONENTIAL_BACKOFF=true       # Enable exponential backoff
```

### Connection Optimization

**HTTP Connection Pooling**:
```typescript
// Configure HTTP agent for connection reuse
const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30000,
  freeSocketTimeout: 15000
});

const octokit = new Octokit({
  auth: githubToken,
  request: {
    agent: agent,
    timeout: 30000
  }
});
```

### Caching Strategy

**Multi-level GitHub API Caching**:
```typescript
// Repository tree caching (5-minute TTL)
const treeCache = new LRUCache<string, GitHubTreeResponse>({
  max: 500,
  ttl: 5 * 60 * 1000, // 5 minutes
});

// File content caching (10-minute TTL)
const contentCache = new LRUCache<string, string>({
  max: 1000,
  ttl: 10 * 60 * 1000, // 10 minutes
  sizeCalculation: (content) => content.length
});

// Rate limit info caching
const rateLimitCache = new LRUCache<string, GitHubRateLimit>({
  max: 1,
  ttl: 60 * 1000, // 1 minute
});
```

**Cache Configuration**:
```bash
# Caching settings
GITHUB_CACHE_ENABLED=true
GITHUB_CACHE_TTL=300000                # 5 minutes
GITHUB_CACHE_MAX_SIZE=1000
GITHUB_CACHE_SIZE_LIMIT=50MB
```

## Database Performance

### Connection Pool Optimization

RefactorForge uses optimized SQLite configuration with connection pooling:

```typescript
// Database connection pool configuration
const dbConfig = {
  filename: process.env.DATABASE_URL || './refactorforge.db',
  options: {
    // Enable WAL mode for better concurrency
    pragma: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: -2000, // 2MB cache
      temp_store: 'MEMORY',
      mmap_size: 67108864, // 64MB memory map
      optimize: null
    },
    
    // Connection pool settings
    poolSize: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100
  }
};
```

### Query Optimization

**Optimized Database Helpers**:
```typescript
// Cached query execution with automatic retries
export async function optimizedDbAll<T>(
  query: string,
  params: unknown[] = [],
  options: {
    enableCaching?: boolean;
    cacheTTL?: number;
    timeout?: number;
    retries?: number;
  } = {}
): Promise<{
  data: T[];
  fromCache: boolean;
  executionTime: number;
}> {
  const startTime = Date.now();
  const cacheKey = options.enableCaching ? 
    `query:${hashQuery(query, params)}` : null;
  
  // Check cache first
  if (cacheKey && queryCache.has(cacheKey)) {
    return {
      data: queryCache.get(cacheKey) as T[],
      fromCache: true,
      executionTime: Date.now() - startTime
    };
  }
  
  // Execute query with retry logic
  let lastError: Error | null = null;
  const maxRetries = options.retries || 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await executeWithTimeout(
        () => db.prepare(query).all(params),
        options.timeout || 10000
      );
      
      // Cache result if enabled
      if (cacheKey && options.enableCaching) {
        queryCache.set(cacheKey, result, {
          ttl: options.cacheTTL || 30000
        });
      }
      
      return {
        data: result as T[],
        fromCache: false,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}
```

### Index Optimization

Ensure proper indexing for frequently queried columns:

```sql
-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_patterns_repository_id ON repository_patterns(repository_id);
CREATE INDEX IF NOT EXISTS idx_patterns_category ON repository_patterns(category);
CREATE INDEX IF NOT EXISTS idx_patterns_language ON repository_patterns(language);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON repository_patterns(confidence_score);
CREATE INDEX IF NOT EXISTS idx_patterns_created_at ON repository_patterns(created_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_patterns_repo_category ON repository_patterns(repository_id, category);
CREATE INDEX IF NOT EXISTS idx_patterns_lang_confidence ON repository_patterns(language, confidence_score);

-- Repository indexes
CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_repositories_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_repositories_last_analyzed ON repositories(last_analyzed);

-- Performance monitoring
ANALYZE;
```

### Database Configuration

```bash
# SQLite optimization settings
DATABASE_CACHE_SIZE=2000               # 2MB cache
DATABASE_PAGE_SIZE=4096                # 4KB pages
DATABASE_MMAP_SIZE=67108864           # 64MB memory mapping
DATABASE_WAL_AUTOCHECKPOINT=1000      # WAL checkpoint threshold
DATABASE_BUSY_TIMEOUT=30000           # 30 second busy timeout
DATABASE_SYNCHRONOUS=NORMAL           # Balance performance and durability
```

## Application-Level Optimizations

### Concurrent Processing

**Controlled Concurrency with P-Limit**:
```typescript
import pLimit from 'p-limit';

// Configure concurrency limits based on authentication
const concurrencyLimit = pLimit(this.authenticated ? 8 : 4);

// Process files with concurrency control
const results = await Promise.all(
  files.map(file => 
    concurrencyLimit(() => this.processFile(file))
  )
);
```

### Streaming for Large Files

**Memory-Efficient File Processing**:
```typescript
// Stream large files to prevent memory overflow
export class StreamingFileProcessor {
  async processLargeFile(
    content: string,
    threshold: number = 1024 * 1024 // 1MB
  ): Promise<ProcessingResult> {
    if (content.length < threshold) {
      return this.processInMemory(content);
    }
    
    return this.processWithStreaming(content);
  }
  
  private async processWithStreaming(content: string): Promise<ProcessingResult> {
    const chunks = this.chunkContent(content, 64 * 1024); // 64KB chunks
    const results: ProcessingResult[] = [];
    
    for (const chunk of chunks) {
      const result = await this.processChunk(chunk);
      results.push(result);
      
      // Allow garbage collection
      if (results.length % 10 === 0) {
        await this.yield();
      }
    }
    
    return this.mergeResults(results);
  }
  
  private async yield(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }
}
```

### Asynchronous Processing

**Background Job Processing**:
```typescript
// Queue system for heavy operations
export class AnalysisJobQueue {
  private queue = new Queue('analysis', {
    redis: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  });
  
  async addAnalysisJob(
    repository: GitHubRepository,
    options: AnalysisOptions
  ): Promise<Job> {
    return this.queue.add('analyze-repository', {
      repository,
      options,
      timestamp: Date.now()
    }, {
      priority: this.calculatePriority(options),
      delay: this.calculateDelay(options)
    });
  }
  
  private calculatePriority(options: AnalysisOptions): number {
    // Higher priority for smaller repositories
    if (options.estimatedFiles < 50) return 10;
    if (options.estimatedFiles < 200) return 5;
    return 1;
  }
}
```

## Memory Management

### Memory Monitoring and Optimization

**Proactive Memory Management**:
```typescript
export class MemoryManager {
  private memoryThreshold = 0.85; // 85% of available memory
  private gcThreshold = 0.80;     // 80% triggers garbage collection
  
  async monitorMemoryUsage(): Promise<void> {
    const usage = process.memoryUsage();
    const heapUtilization = usage.heapUsed / usage.heapTotal;
    
    if (heapUtilization > this.memoryThreshold) {
      await this.handleMemoryPressure();
    } else if (heapUtilization > this.gcThreshold) {
      await this.triggerGarbageCollection();
    }
    
    // Log memory statistics
    this.logMemoryStats(usage, heapUtilization);
  }
  
  private async handleMemoryPressure(): Promise<void> {
    // Clear caches
    this.clearApplicationCaches();
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Pause non-critical operations
    await this.pauseNonCriticalOperations();
    
    // Alert system administrators
    this.sendMemoryAlert();
  }
  
  private clearApplicationCaches(): void {
    // Clear GitHub API caches
    githubCache.clear();
    
    // Clear query result caches
    queryCache.clear();
    
    // Clear pattern analysis caches
    patternCache.clear();
  }
}
```

### Memory Configuration

```bash
# Node.js memory settings
NODE_OPTIONS="--max-old-space-size=2048 --max-semi-space-size=128"

# Memory monitoring settings
MEMORY_MONITORING_ENABLED=true
MEMORY_THRESHOLD_WARNING=0.8           # 80% memory usage warning
MEMORY_THRESHOLD_CRITICAL=0.9          # 90% memory usage critical
MEMORY_GC_THRESHOLD=0.75              # Force GC at 75% usage
MEMORY_CLEANUP_INTERVAL=300000        # Cleanup every 5 minutes
```

## Caching Strategies

### Multi-Level Caching Architecture

RefactorForge implements a sophisticated caching strategy:

```
Application Cache (LRU) → Database Query Cache → GitHub API Cache → File System Cache
```

**Cache Configuration**:
```typescript
// Application-level caching
const cacheConfig = {
  // GitHub API responses
  github: {
    maxSize: 1000,
    ttl: 5 * 60 * 1000,        // 5 minutes
    sizeCalculation: (item: any) => JSON.stringify(item).length
  },
  
  // Database query results
  database: {
    maxSize: 2000,
    ttl: 30 * 1000,            // 30 seconds
    stale: true                // Return stale data while refreshing
  },
  
  // Pattern analysis results
  patterns: {
    maxSize: 5000,
    ttl: 10 * 60 * 1000,       // 10 minutes
    maxAge: 60 * 60 * 1000     // 1 hour absolute expiry
  },
  
  // File content cache
  files: {
    maxSize: 500,
    ttl: 15 * 60 * 1000,       // 15 minutes
    maxFileSize: 1024 * 1024   // 1MB max file size
  }
};
```

### Cache Warming Strategies

**Proactive Cache Population**:
```typescript
export class CacheWarmer {
  async warmCaches(): Promise<void> {
    // Warm frequently accessed repositories
    const popularRepositories = await this.getPopularRepositories();
    
    await Promise.all(
      popularRepositories.map(repo => 
        this.warmRepositoryCache(repo)
      )
    );
  }
  
  private async warmRepositoryCache(repository: Repository): Promise<void> {
    // Pre-load repository metadata
    await this.cacheRepositoryInfo(repository);
    
    // Pre-load popular patterns
    await this.cachePopularPatterns(repository);
    
    // Pre-load recent analysis results
    await this.cacheRecentAnalysis(repository);
  }
}

// Schedule cache warming
setInterval(async () => {
  const warmer = new CacheWarmer();
  await warmer.warmCaches();
}, 15 * 60 * 1000); // Every 15 minutes
```

### Cache Invalidation

**Smart Cache Invalidation**:
```typescript
export class CacheInvalidator {
  async invalidateRepositoryCache(repositoryId: string): Promise<void> {
    // Invalidate specific repository caches
    const patterns = [
      `repo:${repositoryId}:*`,
      `patterns:${repositoryId}:*`,
      `analysis:${repositoryId}:*`
    ];
    
    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }
  }
  
  async invalidateOnUpdate(event: WebhookEvent): Promise<void> {
    switch (event.type) {
      case 'push':
        // Invalidate repository and pattern caches
        await this.invalidateRepositoryCache(event.repository.id);
        break;
        
      case 'pull_request':
        // Invalidate PR-specific caches
        await this.invalidatePullRequestCache(event.pullRequest.id);
        break;
    }
  }
}
```

## Scaling Considerations

### Horizontal Scaling

**Load Balancer Configuration**:
```nginx
# nginx.conf
upstream refactorforge_backend {
    least_conn;
    server backend-1:8001 weight=3;
    server backend-2:8001 weight=3;
    server backend-3:8001 weight=2;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://refactorforge_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Connection pooling
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}
```

### Database Scaling

**Read Replicas and Sharding**:
```typescript
// Database connection routing
export class DatabaseRouter {
  private readConnections: Database[];
  private writeConnection: Database;
  
  async query(sql: string, params: unknown[], options: QueryOptions = {}): Promise<unknown> {
    if (options.readonly !== false && this.isReadQuery(sql)) {
      // Route to read replica
      const connection = this.getReadConnection();
      return connection.prepare(sql).all(params);
    } else {
      // Route to primary database
      return this.writeConnection.prepare(sql).all(params);
    }
  }
  
  private getReadConnection(): Database {
    // Round-robin or least-loaded connection
    return this.readConnections[
      Math.floor(Math.random() * this.readConnections.length)
    ];
  }
}
```

### Container Optimization

**Docker Configuration**:
```dockerfile
# Multi-stage build for optimization
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app

# Security and performance optimizations
RUN addgroup -g 1001 -S nodejs && \
    adduser -S refactorforge -u 1001

# Copy application files
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=refactorforge:nodejs . .

# Optimize Node.js performance
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=32768"

USER refactorforge
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8001/api/health || exit 1

CMD ["npm", "start"]
```

**Docker Compose Scaling**:
```yaml
version: '3.8'
services:
  refactorforge-backend:
    build: .
    ports:
      - "8001-8003:8001"
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

## Production Deployment

### Performance-Optimized Environment

**Production Environment Configuration**:
```bash
# Node.js production optimizations
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096 --max-http-header-size=32768 --enable-source-maps=false"

# Application settings
PORT=8001
CLUSTER_MODE=true                      # Enable cluster mode
CLUSTER_WORKERS=4                      # Number of worker processes

# Database optimizations
DATABASE_POOL_SIZE=20                  # Larger connection pool
DATABASE_CACHE_SIZE=10000             # 10MB cache
DATABASE_MMAP_SIZE=134217728          # 128MB memory mapping
DATABASE_WAL_AUTOCHECKPOINT=10000     # Larger checkpoint threshold

# GitHub API optimizations
GITHUB_SCANNER_FILE_LIMIT=200         # Increased file limit
GITHUB_SCANNER_BATCH_SIZE=15          # Larger batch size
GITHUB_API_TIMEOUT=45000              # Longer timeout

# Caching settings
CACHE_ENABLED=true
CACHE_TTL=600000                      # 10 minutes
CACHE_MAX_SIZE=5000                   # Larger cache size

# Performance monitoring
PERFORMANCE_MONITORING_ENABLED=true
PERFORMANCE_DETAILED_METRICS=true
PERFORMANCE_ALERT_WEBHOOK=https://alerts.company.com/webhook
```

### Process Management

**PM2 Configuration**:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'refactorforge-backend',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    
    // Performance optimizations
    node_args: '--max-old-space-size=4096 --max-http-header-size=32768',
    
    // Auto-restart on memory limit
    max_memory_restart: '2G',
    
    // Graceful shutdown
    kill_timeout: 10000,
    
    // Environment
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8001
    },
    
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    time: true,
    
    // Monitoring
    monitoring: false,
    pmx: true
  }]
};
```

### Health Checks and Monitoring

**Comprehensive Health Monitoring**:
```bash
#!/bin/bash
# health-check.sh

# Check application health
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/health)

if [ $HEALTH_STATUS -ne 200 ]; then
    echo "Health check failed with status: $HEALTH_STATUS"
    
    # Check system resources
    echo "Memory usage: $(free -m)"
    echo "Disk usage: $(df -h)"
    echo "Load average: $(uptime)"
    
    # Check application processes
    echo "PM2 status: $(pm2 jlist)"
    
    # Restart if necessary
    pm2 restart refactorforge-backend
    
    exit 1
fi

echo "Health check passed"
exit 0
```

## Performance Troubleshooting

### Common Performance Issues

#### 1. High Memory Usage
**Symptoms**: Memory usage consistently above 80%
**Debugging**:
```bash
# Check Node.js heap usage
node --expose-gc --inspect your-app.js

# Generate heap snapshot
kill -USR2 $(pgrep node)

# Check for memory leaks
node --trace-gc your-app.js
```

**Solutions**:
- Increase `--max-old-space-size`
- Implement cache size limits
- Add garbage collection triggers
- Review for memory leaks in event listeners

#### 2. Slow Database Queries
**Symptoms**: Database queries taking >50ms
**Debugging**:
```sql
-- Enable query logging
PRAGMA optimize;
ANALYZE;

-- Check query plans
EXPLAIN QUERY PLAN SELECT * FROM repository_patterns WHERE repository_id = ?;
```

**Solutions**:
- Add missing indexes
- Optimize WHERE clauses
- Use query result caching
- Consider database sharding

#### 3. GitHub API Rate Limits
**Symptoms**: Frequent rate limit errors, slow repository scanning
**Debugging**:
```bash
# Check current rate limit
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/rate_limit

# Monitor rate limit usage
tail -f logs/github-api.log | grep "rate_limit"
```

**Solutions**:
- Implement smarter batch sizing
- Add longer delays between requests
- Use GitHub Apps for higher limits
- Implement request priority queuing

#### 4. High CPU Usage
**Symptoms**: CPU usage consistently above 80%
**Debugging**:
```bash
# Profile CPU usage
node --prof your-app.js
node --prof-process isolate-*.log > processed.txt

# Check for blocking operations
node --trace-sync-io your-app.js
```

**Solutions**:
- Move CPU-intensive tasks to worker threads
- Implement processing queues
- Optimize regex patterns and parsing
- Use cluster mode for multi-core utilization

### Performance Testing

**Load Testing with Artillery**:
```yaml
# artillery-config.yml
config:
  target: 'http://localhost:8001'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100
  processor: "./artillery-processor.js"

scenarios:
  - name: "Repository Scanning"
    weight: 40
    flow:
      - post:
          url: "/api/repositories"
          json:
            owner: "testuser"
            repo: "test-repo-{{ $randomString() }}"
            branch: "main"
      - think: 2
      - post:
          url: "/api/repositories/{{ id }}/scan"

  - name: "Pattern Search"
    weight: 60
    flow:
      - get:
          url: "/api/patterns"
          qs:
            search: "async function"
            limit: 20
```

**Performance Regression Testing**:
```javascript
// performance-test.js
const { performance } = require('perf_hooks');

async function performanceTest() {
  const startTime = performance.now();
  
  // Simulate repository scan
  const response = await fetch('http://localhost:8001/api/repositories/test-repo/scan', {
    method: 'POST'
  });
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`Scan completed in ${duration.toFixed(2)}ms`);
  
  // Assert performance requirements
  if (duration > 5000) { // 5 second threshold
    throw new Error(`Performance regression: scan took ${duration}ms`);
  }
}
```

### Performance Optimization Checklist

**Application Level**:
- [ ] Enable connection pooling for databases
- [ ] Implement request/response caching
- [ ] Use async/await consistently
- [ ] Optimize database queries with indexes
- [ ] Configure appropriate timeouts
- [ ] Implement rate limiting for external APIs
- [ ] Use streaming for large data processing
- [ ] Enable gzip compression

**Infrastructure Level**:
- [ ] Use SSD storage for databases
- [ ] Configure adequate RAM (minimum 2GB)
- [ ] Enable HTTP/2 for client connections
- [ ] Configure load balancing for multiple instances
- [ ] Use CDN for static assets
- [ ] Implement database read replicas
- [ ] Configure proper monitoring and alerting
- [ ] Optimize Docker container resources

**GitHub API Level**:
- [ ] Use authenticated requests for higher rate limits
- [ ] Implement intelligent retry logic with exponential backoff
- [ ] Cache GitHub API responses appropriately
- [ ] Use conditional requests (ETag/If-Modified-Since)
- [ ] Batch multiple API calls when possible
- [ ] Monitor and respect rate limit headers
- [ ] Use GitHub Apps for enterprise features

---

## Summary

RefactorForge's performance optimization capabilities provide enterprise-grade scalability and reliability. By following the strategies in this guide, you can:

- Monitor performance in real-time with built-in metrics
- Optimize GitHub API usage for maximum efficiency
- Implement sophisticated caching strategies
- Scale horizontally for high-volume processing
- Debug and resolve performance issues quickly
- Deploy with production-ready configurations

For additional performance optimization support or advanced scaling requirements, refer to our [Architecture Documentation](../SYSTEM_ARCHITECTURE.md) or contact our support team.

---

*Last Updated: January 15, 2025*
*Version: 2.1.0*