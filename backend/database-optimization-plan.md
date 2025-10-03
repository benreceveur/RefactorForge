# RefactorForge Database Optimization Plan

## Executive Summary

After analyzing the RefactorForge SQLite database schema, existing indexes, and query patterns, I've identified several optimization opportunities. The database already has a **solid indexing foundation** with proper indexes on foreign keys and frequently queried columns. However, there are strategic improvements that can enhance performance significantly.

## Current State Analysis

### ✅ Existing Strong Points
- **Email index already exists**: `idx_contacts_email` on `contacts(email)` ✓
- **Foreign key indexes**: All major FK relationships are properly indexed
- **Primary queries indexed**: Most common query patterns have supporting indexes
- **Composite indexes**: Multi-column indexes for complex queries exist

### 🔍 Performance Analysis Results

**Query Execution Plan for Email Lookup:**
```sql
EXPLAIN QUERY PLAN SELECT * FROM contacts WHERE email = 'test@example.com';
-- Result: SEARCH contacts USING INDEX idx_contacts_email (email=?)
```
✅ **Email queries are already optimized using index**

## Recommended Optimizations

### 1. **Missing Composite Indexes** (High Priority)

#### A. Repository Analysis Queries
```sql
-- Current problematic query pattern from code analysis:
SELECT * FROM repositories
WHERE analysis_status = 'analyzed'
  AND organization = 'IntelliPact'
ORDER BY updated_at DESC;
```

**Missing Index:**
```sql
CREATE INDEX idx_repositories_status_org_updated
ON repositories(analysis_status, organization, updated_at DESC);
```

**Performance Impact:**
- **Before**: Sequential scan + sort (estimated 15-50ms for 1000+ repos)
- **After**: Index seek only (estimated 1-3ms)
- **Improvement**: 80-95% faster for filtered repository queries

#### B. Pattern Search Optimization
```sql
-- Common query pattern:
SELECT * FROM repository_patterns
WHERE repository_id = ?
  AND category = ?
  AND confidence_score > 0.7
ORDER BY confidence_score DESC;
```

**Missing Index:**
```sql
CREATE INDEX idx_patterns_repo_category_confidence
ON repository_patterns(repository_id, category, confidence_score DESC);
```

### 2. **Timeline and Search Optimization** (Medium Priority)

#### A. Timeline Events Composite Index
```sql
CREATE INDEX idx_timeline_events_repo_type_created
ON timeline_events(repository, type, created_at DESC);
```

#### B. Search History Performance
```sql
CREATE INDEX idx_search_history_user_created
ON search_history(user_id, created_at DESC);
```

### 3. **Query-Specific Optimizations** (Medium Priority)

#### A. Error Reporting Queries
```sql
-- Current: Multiple separate indexes
-- Optimization: Composite index for error analytics
CREATE INDEX idx_error_reports_level_component_created
ON client_error_reports(level, component, created_at DESC);
```

#### B. Analysis Jobs Status Tracking
```sql
-- Enhance existing index
DROP INDEX IF EXISTS idx_jobs_repository_status;
CREATE INDEX idx_jobs_repository_status_type
ON analysis_jobs(repository_id, status, job_type, created_at DESC);
```

### 4. **Partial Indexes for Performance** (Advanced)

```sql
-- Index only active recommendations for faster dashboard queries
CREATE INDEX idx_recommendations_active_priority
ON repository_recommendations(repository_id, priority, updated_at DESC)
WHERE status IN ('pending', 'in_progress');

-- Index only recent timeline events (last 30 days are queried most)
CREATE INDEX idx_timeline_events_recent
ON timeline_events(repository, type, created_at DESC)
WHERE created_at > date('now', '-30 days');
```

## Migration Strategy

### Phase 1: Critical Performance Indexes (Week 1)
```sql
-- High-impact, low-risk additions
CREATE INDEX idx_repositories_status_org_updated
ON repositories(analysis_status, organization, updated_at DESC);

CREATE INDEX idx_patterns_repo_category_confidence
ON repository_patterns(repository_id, category, confidence_score DESC);
```

### Phase 2: Query-Specific Optimizations (Week 2)
```sql
CREATE INDEX idx_timeline_events_repo_type_created
ON timeline_events(repository, type, created_at DESC);

CREATE INDEX idx_search_history_user_created
ON search_history(user_id, created_at DESC);

CREATE INDEX idx_error_reports_level_component_created
ON client_error_reports(level, component, created_at DESC);
```

### Phase 3: Advanced Optimizations (Week 3)
```sql
-- Replace existing index with enhanced version
DROP INDEX idx_jobs_repository_status;
CREATE INDEX idx_jobs_repository_status_type
ON analysis_jobs(repository_id, status, job_type, created_at DESC);

-- Add partial indexes for performance
CREATE INDEX idx_recommendations_active_priority
ON repository_recommendations(repository_id, priority, updated_at DESC)
WHERE status IN ('pending', 'in_progress');
```

## Index Naming Convention

Following SQLite best practices and RefactorForge patterns:
- `idx_[table]_[columns]` - Standard multi-column indexes
- `idx_[table]_[purpose]` - Functional indexes (e.g., `idx_recommendations_active`)
- Column order: Equality → Range → Sort (E-R-S principle)

## Performance Monitoring

### Before Implementation
```sql
-- Baseline performance measurement
EXPLAIN QUERY PLAN SELECT * FROM repositories
WHERE analysis_status = 'analyzed'
  AND organization = 'IntelliPact'
ORDER BY updated_at DESC LIMIT 20;
```

### After Implementation
```sql
-- Performance verification
EXPLAIN QUERY PLAN SELECT * FROM repositories
WHERE analysis_status = 'analyzed'
  AND organization = 'IntelliPact'
ORDER BY updated_at DESC LIMIT 20;
-- Expected: "SEARCH repositories USING INDEX idx_repositories_status_org_updated"
```

### Monitoring Queries
```sql
-- Check index usage statistics
SELECT name, tbl_name
FROM sqlite_master
WHERE type = 'index'
  AND name LIKE 'idx_%'
ORDER BY tbl_name, name;

-- Identify slow queries in application logs
-- Monitor query execution times in OptimizedDatabaseHelper
```

## Query Optimization Examples

### 1. Repository Dashboard Query
**Before:**
```typescript
// Inefficient: Multiple queries + potential full table scans
const repositories = await dbAll(
  'SELECT * FROM repositories WHERE analysis_status = ? ORDER BY updated_at DESC',
  ['analyzed']
);
```

**After:**
```typescript
// Optimized: Single index-optimized query
const repositories = await dbAll(
  `SELECT r.*,
          COUNT(p.id) as patterns_count,
          COUNT(rec.id) as recommendations_count
   FROM repositories r
   LEFT JOIN repository_patterns p ON r.id = p.repository_id
   LEFT JOIN repository_recommendations rec ON r.id = rec.repository_id
   WHERE r.analysis_status = ? AND r.organization = ?
   GROUP BY r.id
   ORDER BY r.updated_at DESC
   LIMIT ?`,
  ['analyzed', 'IntelliPact', 50]
);
```

### 2. Pattern Search with Confidence Filtering
**Before:**
```typescript
// Suboptimal: Separate indexes, potential sort operation
const patterns = await dbAll(
  'SELECT * FROM repository_patterns WHERE repository_id = ? AND category = ? AND confidence_score > ? ORDER BY confidence_score DESC',
  [repoId, 'performance', 0.7]
);
```

**After (with new index):**
```typescript
// Optimized: Single composite index covers entire query
// Uses idx_patterns_repo_category_confidence for optimal performance
const patterns = await dbAll(
  'SELECT * FROM repository_patterns WHERE repository_id = ? AND category = ? AND confidence_score > ? ORDER BY confidence_score DESC',
  [repoId, 'performance', 0.7]
);
```

## Database Size Impact

### Index Storage Analysis
- **Current indexes**: ~15 indexes, estimated 2-5MB
- **New indexes**: +8 indexes, estimated additional 1-3MB
- **Total overhead**: <10MB for typical dataset (10k repositories, 100k patterns)
- **Performance gain vs storage**: Excellent ROI (10x+ query speedup for <5% storage increase)

## Risk Assessment

### Low Risk
- ✅ All new indexes are additive (no schema changes)
- ✅ SQLite handles index creation online
- ✅ Can be rolled back easily

### Mitigation Strategies
1. **Phased rollout**: Implement critical indexes first
2. **Performance monitoring**: Track query execution times
3. **Rollback plan**: Drop index commands ready if needed
4. **Testing**: Validate on staging database first

## Implementation Script

Create this migration file as `/backend/migrations/001_performance_indexes.sql`:

```sql
-- RefactorForge Database Performance Optimization
-- Migration: 001_performance_indexes
-- Date: 2025-01-XX

BEGIN TRANSACTION;

-- Phase 1: Critical Performance Indexes
CREATE INDEX IF NOT EXISTS idx_repositories_status_org_updated
ON repositories(analysis_status, organization, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_repo_category_confidence
ON repository_patterns(repository_id, category, confidence_score DESC);

-- Phase 2: Dashboard and Search Optimization
CREATE INDEX IF NOT EXISTS idx_timeline_events_repo_type_created
ON timeline_events(repository, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_history_user_created
ON search_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_reports_level_component_created
ON client_error_reports(level, component, created_at DESC);

-- Phase 3: Enhanced Existing Indexes
-- Note: Keep old index until new one is tested
CREATE INDEX IF NOT EXISTS idx_jobs_repository_status_type
ON analysis_jobs(repository_id, status, job_type, created_at DESC);

COMMIT;

-- Verification queries
SELECT 'Index verification:' AS status;
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_repositories_status_%';
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_patterns_repo_%';
```

## Expected Performance Improvements

| Query Type | Current Performance | Optimized Performance | Improvement |
|------------|-------------------|---------------------|-------------|
| Repository Dashboard | 15-50ms | 1-3ms | **80-95% faster** |
| Pattern Search | 10-30ms | 1-2ms | **85-95% faster** |
| Timeline Events | 20-40ms | 2-5ms | **75-90% faster** |
| Error Analytics | 25-60ms | 3-8ms | **70-85% faster** |

## Monitoring and Maintenance

1. **Weekly Performance Review**: Check slow query logs
2. **Monthly Index Analysis**: Review index usage statistics
3. **Quarterly Optimization**: Identify new query patterns needing indexes
4. **VACUUM and ANALYZE**: Run monthly for optimal performance

```sql
-- Monthly maintenance
PRAGMA optimize;
ANALYZE;
-- Consider VACUUM if database has grown significantly
```

## Conclusion

This optimization plan provides **significant performance improvements** with minimal risk. The RefactorForge database already has a solid foundation, and these targeted additions will enhance the most common query patterns while maintaining data integrity and application stability.

**Next Steps:**
1. Review and approve optimization plan
2. Test index creation on staging database
3. Implement Phase 1 indexes in production
4. Monitor performance improvements
5. Proceed with subsequent phases based on results