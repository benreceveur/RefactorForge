# Performance Optimization Patterns Library

## Pattern Categories

This library documents proven optimization patterns based on successful implementations, organized by category and impact level.

---

## 1. Database Optimization Patterns

### Pattern 1.1: Composite Index Strategy

**Problem**: Multiple queries filtering/sorting on related columns
**Solution**: Strategic composite indexes covering multiple query patterns

```sql
-- Instead of multiple single-column indexes:
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_status ON users(status);
CREATE INDEX idx_org ON users(organization);

-- Create composite indexes:
CREATE INDEX idx_users_composite ON users(
  status,           -- Most selective first
  organization,     -- Common filter
  updated_at DESC   -- Sort column last
);
```

**Impact**: 70-95% query improvement
**Applicability**: High-frequency filtered queries with sorting

### Pattern 1.2: Covering Index Pattern

**Problem**: Queries requiring table lookups after index scan
**Solution**: Include all needed columns in the index

```sql
-- Query needing user details
SELECT id, name, email, last_login
FROM users
WHERE organization = ? AND status = 'active'
ORDER BY last_login DESC;

-- Covering index eliminates table lookup
CREATE INDEX idx_users_covering ON users(
  organization,
  status,
  last_login DESC,
  id,
  name,
  email
);
```

**Impact**: 50-70% reduction in I/O
**Applicability**: Read-heavy workloads with predictable column access

### Pattern 1.3: Partial Index Pattern

**Problem**: Index overhead for rarely-queried values
**Solution**: Index only relevant subset of data

```sql
-- Only index active items
CREATE INDEX idx_active_items ON items(
  category, priority, created_at DESC
) WHERE status IN ('active', 'pending');

-- Reduces index size by 60-80% if most items are archived
```

**Impact**: 40-60% index size reduction, faster writes
**Applicability**: Tables with clear hot/cold data separation

---

## 2. Caching Optimization Patterns

### Pattern 2.1: Multi-Layer Cache Strategy

**Problem**: Single cache point creates bottleneck
**Solution**: Hierarchical caching at multiple layers

```typescript
class MultiLayerCache {
  layers = {
    L1: { // Process memory
      type: 'memory',
      ttl: 60,
      size: '100MB',
      hitRate: '~90%'
    },
    L2: { // Redis
      type: 'redis',
      ttl: 3600,
      size: '1GB',
      hitRate: '~70%'
    },
    L3: { // CDN
      type: 'cdn',
      ttl: 86400,
      size: 'unlimited',
      hitRate: '~50%'
    }
  };

  async get(key: string): Promise<any> {
    // Check each layer, populate on miss
    for (const layer of this.layers) {
      const value = await layer.get(key);
      if (value) {
        await this.populateUpperLayers(key, value);
        return value;
      }
    }
    return null;
  }
}
```

**Impact**: 80-95% reduction in database queries
**Applicability**: Read-heavy applications with predictable access patterns

### Pattern 2.2: Smart Invalidation Pattern

**Problem**: Cache invalidation complexity
**Solution**: Tag-based invalidation with dependency tracking

```typescript
class SmartCache {
  // Tag-based invalidation
  async set(key: string, value: any, tags: string[]) {
    await this.cache.set(key, value);
    for (const tag of tags) {
      await this.cache.sadd(`tag:${tag}`, key);
    }
  }

  async invalidateByTag(tag: string) {
    const keys = await this.cache.smembers(`tag:${tag}`);
    await this.cache.del(...keys);
    await this.cache.del(`tag:${tag}`);
  }

  // Usage
  await cache.set('user:123', userData, ['users', 'org:456']);
  await cache.invalidateByTag('org:456'); // Invalidates all org data
}
```

**Impact**: 90% reduction in unnecessary invalidations
**Applicability**: Complex data relationships requiring selective invalidation

### Pattern 2.3: Predictive Preloading Pattern

**Problem**: Cold cache misses on predictable access
**Solution**: Preload cache based on patterns

```typescript
class PredictiveCache {
  async analyzePatterns(): Promise<void> {
    // Analyze access patterns
    const patterns = await this.getAccessPatterns();

    // Preload based on time patterns
    if (patterns.morningSpike) {
      await this.preloadDashboardData();
    }

    // Preload based on user patterns
    if (patterns.sequentialAccess) {
      await this.preloadNextLikelyItems();
    }
  }

  async preloadNextLikelyItems(): Promise<void> {
    const predictions = await this.ml.predict(currentContext);
    for (const item of predictions.likely) {
      await this.cache.warmup(item.key);
    }
  }
}
```

**Impact**: 60-80% reduction in cache misses
**Applicability**: Predictable access patterns or user behavior

---

## 3. Query Optimization Patterns

### Pattern 3.1: Query Result Pagination

**Problem**: Large result sets causing memory/network issues
**Solution**: Cursor-based pagination with consistent ordering

```typescript
class CursorPagination {
  async getPage(cursor?: string, limit = 20) {
    let query = this.baseQuery;

    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      query = query.where('created_at < ?', decoded.timestamp)
                   .andWhere('id < ?', decoded.id);
    }

    const results = await query
      .orderBy('created_at', 'DESC')
      .orderBy('id', 'DESC')  // Ensure deterministic ordering
      .limit(limit + 1);      // Fetch one extra for hasMore

    const hasMore = results.length > limit;
    if (hasMore) results.pop();

    const nextCursor = hasMore
      ? this.encodeCursor(results[results.length - 1])
      : null;

    return { results, nextCursor, hasMore };
  }
}
```

**Impact**: 70-90% reduction in memory usage
**Applicability**: Large result sets, API endpoints

### Pattern 3.2: Query Batching Pattern

**Problem**: N+1 query problems
**Solution**: Batch and deduplicate queries

```typescript
class QueryBatcher {
  private batch: Map<string, Promise<any>> = new Map();
  private timer: NodeJS.Timeout;

  async get(id: string): Promise<any> {
    if (!this.batch.has(id)) {
      this.batch.set(id, new Promise((resolve) => {
        this.schedule();
        this.resolvers.set(id, resolve);
      }));
    }
    return this.batch.get(id);
  }

  private schedule() {
    if (this.timer) return;

    this.timer = setTimeout(async () => {
      const ids = Array.from(this.batch.keys());
      const results = await this.batchFetch(ids);

      results.forEach(result => {
        const resolver = this.resolvers.get(result.id);
        resolver?.(result);
      });

      this.batch.clear();
      this.timer = null;
    }, 10); // 10ms batching window
  }

  private async batchFetch(ids: string[]) {
    return this.db.query('SELECT * FROM items WHERE id IN (?)', [ids]);
  }
}
```

**Impact**: 90-95% reduction in database round trips
**Applicability**: GraphQL resolvers, nested data loading

### Pattern 3.3: Query Plan Optimization

**Problem**: Suboptimal query execution plans
**Solution**: Query hints and restructuring

```typescript
class QueryOptimizer {
  optimizeQuery(originalQuery: string): string {
    // Force index usage when optimizer chooses poorly
    if (this.shouldForceIndex(originalQuery)) {
      return originalQuery.replace(
        'FROM users',
        'FROM users USE INDEX (idx_users_composite)'
      );
    }

    // Rewrite EXISTS to JOIN for better performance
    if (originalQuery.includes('WHERE EXISTS')) {
      return this.rewriteExistsAsJoin(originalQuery);
    }

    // Convert OR to UNION for index usage
    if (this.hasOrCondition(originalQuery)) {
      return this.convertOrToUnion(originalQuery);
    }

    return originalQuery;
  }

  private convertOrToUnion(query: string): string {
    // WHERE (a = 1 OR b = 2) becomes:
    // SELECT * FROM t WHERE a = 1
    // UNION
    // SELECT * FROM t WHERE b = 2
    // This allows both indexes to be used
  }
}
```

**Impact**: 50-80% query execution improvement
**Applicability**: Complex queries with poor execution plans

---

## 4. Code-Level Optimization Patterns

### Pattern 4.1: Lazy Evaluation Pattern

**Problem**: Unnecessary computation of unused values
**Solution**: Defer computation until needed

```typescript
class LazyEvaluator<T> {
  private cached?: T;
  private evaluated = false;

  constructor(private factory: () => T) {}

  get value(): T {
    if (!this.evaluated) {
      this.cached = this.factory();
      this.evaluated = true;
    }
    return this.cached!;
  }

  // Usage
  const expensiveData = new LazyEvaluator(() =>
    computeExpensiveOperation()
  );

  // Only computed if accessed
  if (condition) {
    console.log(expensiveData.value);
  }
}
```

**Impact**: 40-60% reduction in unnecessary computation
**Applicability**: Optional expensive operations

### Pattern 4.2: Object Pool Pattern

**Problem**: Expensive object creation/destruction
**Solution**: Reuse objects from pool

```typescript
class ObjectPool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    private maxSize = 10
  ) {
    // Pre-populate pool
    for (let i = 0; i < maxSize / 2; i++) {
      this.available.push(this.factory());
    }
  }

  acquire(): T {
    let obj = this.available.pop();
    if (!obj) {
      obj = this.factory();
    }
    this.inUse.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.inUse.has(obj)) return;

    this.reset(obj);
    this.inUse.delete(obj);

    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    }
  }
}

// Usage: Database connection pool
const dbPool = new ObjectPool(
  () => createConnection(),
  (conn) => conn.reset(),
  20
);
```

**Impact**: 70-90% reduction in GC pressure
**Applicability**: Frequently created/destroyed expensive objects

### Pattern 4.3: Memoization Pattern

**Problem**: Repeated computation of same results
**Solution**: Cache computation results

```typescript
class Memoizer {
  static memoize<T extends (...args: any[]) => any>(
    fn: T,
    options: { ttl?: number; maxSize?: number } = {}
  ): T {
    const cache = new Map();
    const { ttl = Infinity, maxSize = 100 } = options;

    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);

      if (cache.has(key)) {
        const { value, timestamp } = cache.get(key);
        if (Date.now() - timestamp < ttl) {
          return value;
        }
      }

      const value = fn(...args);

      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      cache.set(key, { value, timestamp: Date.now() });
      return value;
    }) as T;
  }
}

// Usage
const expensiveComputation = Memoizer.memoize(
  (n: number) => fibonacci(n),
  { ttl: 60000, maxSize: 50 }
);
```

**Impact**: 90-99% reduction for repeated calls
**Applicability**: Pure functions with repeated inputs

---

## 5. Architecture Optimization Patterns

### Pattern 5.1: Circuit Breaker Pattern

**Problem**: Cascading failures from slow dependencies
**Solution**: Fail fast when service is unhealthy

```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailTime?: number;

  constructor(
    private threshold = 5,
    private timeout = 60000,
    private resetTimeout = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime! > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        this.timeoutPromise()
      ]);

      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

**Impact**: 95% reduction in cascading failures
**Applicability**: External service dependencies

### Pattern 5.2: Read/Write Splitting Pattern

**Problem**: Database bottleneck from mixed workload
**Solution**: Separate read and write connections

```typescript
class ReadWriteSplitter {
  constructor(
    private writeDb: Database,
    private readDbs: Database[],
    private lagThreshold = 1000
  ) {}

  async query(sql: string, params?: any[]): Promise<any> {
    if (this.isWriteQuery(sql)) {
      return this.writeDb.query(sql, params);
    }

    // For reads, check replication lag
    const readDb = await this.selectReadDb();
    return readDb.query(sql, params);
  }

  private async selectReadDb(): Promise<Database> {
    for (const db of this.readDbs) {
      const lag = await this.checkReplicationLag(db);
      if (lag < this.lagThreshold) {
        return db;
      }
    }

    // Fallback to write DB if all replicas lagged
    return this.writeDb;
  }

  private isWriteQuery(sql: string): boolean {
    const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER'];
    return writeKeywords.some(keyword =>
      sql.trim().toUpperCase().startsWith(keyword)
    );
  }
}
```

**Impact**: 60-80% increase in read throughput
**Applicability**: Read-heavy applications with replication

### Pattern 5.3: Async Processing Pattern

**Problem**: Synchronous processing blocking user requests
**Solution**: Queue-based asynchronous processing

```typescript
class AsyncProcessor {
  private queue: Queue;
  private workers: Worker[] = [];

  constructor(concurrency = 5) {
    this.queue = new Queue('processing');

    for (let i = 0; i < concurrency; i++) {
      this.workers.push(new Worker(this.queue));
    }
  }

  async submitJob(data: any): Promise<string> {
    // Immediate response with job ID
    const jobId = uuid();

    await this.queue.add({
      id: jobId,
      data,
      timestamp: Date.now()
    });

    return jobId;
  }

  async getStatus(jobId: string): Promise<JobStatus> {
    return this.queue.getJobStatus(jobId);
  }

  // Worker process
  class Worker {
    async process(job: Job) {
      try {
        await this.updateStatus(job.id, 'processing');
        const result = await this.heavyOperation(job.data);
        await this.updateStatus(job.id, 'completed', result);
      } catch (error) {
        await this.updateStatus(job.id, 'failed', error);
      }
    }
  }
}
```

**Impact**: 90% reduction in request latency
**Applicability**: Heavy computations, batch processing

---

## Pattern Selection Guide

### Quick Decision Matrix

| Pattern | Use When | Avoid When | Expected Impact |
|---------|----------|------------|-----------------|
| Composite Index | Multiple filters on same table | Write-heavy workload | 70-95% query improvement |
| Multi-Layer Cache | Read >> Write ratio | Frequently changing data | 80-95% DB load reduction |
| Query Batching | N+1 queries detected | Single queries only | 90-95% fewer DB calls |
| Object Pool | Expensive object creation | Simple objects | 70-90% GC reduction |
| Circuit Breaker | External dependencies | Internal services only | 95% failure isolation |
| Async Processing | CPU-intensive operations | Real-time requirements | 90% latency reduction |

### Combination Strategies

**High-Traffic API Endpoint**
- Multi-Layer Cache + Query Batching + Circuit Breaker
- Expected: 85-95% latency reduction

**Dashboard Performance**
- Composite Indexes + Memoization + Lazy Evaluation
- Expected: 70-90% load time improvement

**Batch Processing System**
- Async Processing + Object Pool + Read/Write Splitting
- Expected: 80-90% throughput increase

---

## Implementation Checklist

For each pattern implementation:

- [ ] Measure baseline performance
- [ ] Implement pattern with feature flag
- [ ] Create performance tests
- [ ] Document configuration options
- [ ] Set up monitoring/alerting
- [ ] Create rollback procedure
- [ ] Train team on usage
- [ ] Update runbooks

---

## Anti-Patterns to Avoid

### ❌ Premature Optimization
- Optimizing without measurements
- Complex solutions for simple problems
- Micro-optimizations with macro problems

### ❌ Cache-Everything Syndrome
- Caching without invalidation strategy
- Multiple cache layers for rarely accessed data
- Cache keys without versioning

### ❌ Index Proliferation
- Creating index for every query
- Indexes on low-cardinality columns
- Redundant indexes with same prefix

### ❌ Over-Engineering
- Building frameworks before proving value
- Abstract solutions for concrete problems
- Infinite configurability with no defaults

---

## Success Metrics

Track these metrics for each pattern:

1. **Performance Metrics**
   - Response time (P50, P95, P99)
   - Throughput (requests/second)
   - Error rate

2. **Resource Metrics**
   - CPU utilization
   - Memory usage
   - Network I/O
   - Disk I/O

3. **Business Metrics**
   - User experience scores
   - Cost per transaction
   - Developer productivity

4. **Pattern-Specific Metrics**
   - Cache hit rate (caching patterns)
   - Index usage (database patterns)
   - Queue depth (async patterns)
   - Circuit state (resilience patterns)

---

## Conclusion

These patterns represent proven solutions to common performance problems. The key to success is:

1. **Measure first** - Identify actual bottlenecks
2. **Choose appropriate patterns** - Match solution to problem
3. **Implement incrementally** - Start small, validate, expand
4. **Monitor continuously** - Track improvements and regressions
5. **Share knowledge** - Document and train team

Remember: The best optimization is often a combination of patterns applied systematically with measurement and validation at each step.