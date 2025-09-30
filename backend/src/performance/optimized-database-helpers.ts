import { getConnectionPool, ConnectionPoolManager } from './connection-pool-manager';
import { logger } from '../utils/logger';
import { DatabaseError, ErrorCode } from '../errors/AppError';

export interface OptimizedQueryOptions {
  useConnectionPool?: boolean;
  enableCaching?: boolean;
  cacheTTL?: number;
  timeout?: number;
  retryAttempts?: number;
  logSlowQueries?: boolean;
  slowQueryThreshold?: number;
}

export interface QueryResult<T> {
  data: T;
  executionTime: number;
  fromCache: boolean;
  connectionId?: string;
}

export interface BatchQueryResult<T> {
  results: T[];
  executionTime: number;
  successCount: number;
  errorCount: number;
  errors: Error[];
}

interface CachedQuery {
  data: unknown;
  timestamp: number;
  ttl: number;
}

/**
 * Optimized Database Helper with Connection Pooling and Advanced Features
 * Provides high-performance database operations with caching, monitoring, and optimization
 */
export class OptimizedDatabaseHelper {
  private static instance: OptimizedDatabaseHelper;
  private connectionPool: ConnectionPoolManager | null = null;
  private queryCache: Map<string, CachedQuery> = new Map();
  private defaultOptions: Required<OptimizedQueryOptions>;
  private queryStats: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();

  private constructor() {
    this.defaultOptions = {
      useConnectionPool: true,
      enableCaching: true,
      cacheTTL: 300000, // 5 minutes
      timeout: 30000,   // 30 seconds
      retryAttempts: 3,
      logSlowQueries: true,
      slowQueryThreshold: 1000 // 1 second
    };

    this.setupCacheCleanup();
  }

  public static getInstance(): OptimizedDatabaseHelper {
    if (!OptimizedDatabaseHelper.instance) {
      OptimizedDatabaseHelper.instance = new OptimizedDatabaseHelper();
    }
    return OptimizedDatabaseHelper.instance;
  }

  /**
   * Initialize the connection pool
   */
  async initialize(dbPath: string): Promise<void> {
    if (this.connectionPool) {
      logger.warn('Database helper already initialized');
      return;
    }

    try {
      this.connectionPool = getConnectionPool(dbPath);
      logger.info('Optimized database helper initialized with connection pool');
    } catch (error) {
      logger.error('Failed to initialize optimized database helper', {
        error: String(error)
      });
      throw new DatabaseError(
        'Failed to initialize database helper',
        ErrorCode.DATABASE_CONNECTION_ERROR,
        undefined,
        { metadata: { dbPath, error: String(error) } }
      );
    }
  }

  /**
   * Execute optimized SELECT query that returns multiple rows
   */
  async dbAll<T = unknown>(
    query: string,
    params: unknown[] = [],
    options: OptimizedQueryOptions = {}
  ): Promise<QueryResult<T[]>> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    
    // Generate cache key
    const cacheKey = this.generateCacheKey('all', query, params);
    
    // Check cache first
    if (opts.enableCaching) {
      const cached = this.getCachedResult<T[]>(cacheKey);
      if (cached) {
        logger.debug('Query result served from cache', { 
          query: query.substring(0, 100),
          cacheKey: cacheKey.substring(0, 50)
        });
        
        return {
          data: cached,
          executionTime: Date.now() - startTime,
          fromCache: true
        };
      }
    }

    try {
      let result: T[];
      let connectionId: string | undefined;

      if (opts.useConnectionPool && this.connectionPool) {
        result = await this.connectionPool.executeQuery<T[]>(query, params, 'all');
      } else {
        // Fallback to legacy database helpers
        const { dbAll } = await import('../utils/database-helpers');
        result = await dbAll<T>(query, params);
      }

      const executionTime = Date.now() - startTime;

      // Cache result
      if (opts.enableCaching && result) {
        this.setCachedResult(cacheKey, result, opts.cacheTTL);
      }

      // Log slow queries
      if (opts.logSlowQueries && executionTime > opts.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          query: query.substring(0, 200),
          executionTime,
          threshold: opts.slowQueryThreshold,
          params: params.length
        });
      }

      // Update query statistics
      this.updateQueryStats(query, executionTime);

      return {
        data: result,
        executionTime,
        fromCache: false,
        connectionId
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Optimized dbAll query failed', {
        query: query.substring(0, 100),
        executionTime,
        error: String(error)
      });

      throw new DatabaseError(
        'Optimized query execution failed',
        ErrorCode.DATABASE_QUERY_ERROR,
        undefined,
        { metadata: { query: query.substring(0, 100), executionTime, error: String(error) } }
      );
    }
  }

  /**
   * Execute optimized SELECT query that returns a single row
   */
  async dbGet<T = unknown>(
    query: string,
    params: unknown[] = [],
    options: OptimizedQueryOptions = {}
  ): Promise<QueryResult<T | undefined>> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    
    // Generate cache key
    const cacheKey = this.generateCacheKey('get', query, params);
    
    // Check cache first
    if (opts.enableCaching) {
      const cached = this.getCachedResult<T>(cacheKey);
      if (cached !== undefined) {
        return {
          data: cached,
          executionTime: Date.now() - startTime,
          fromCache: true
        };
      }
    }

    try {
      let result: T | undefined;
      let connectionId: string | undefined;

      if (opts.useConnectionPool && this.connectionPool) {
        result = await this.connectionPool.executeQuery<T | undefined>(query, params, 'get');
      } else {
        // Fallback to legacy database helpers
        const { dbGet } = await import('../utils/database-helpers');
        result = await dbGet<T>(query, params);
      }

      const executionTime = Date.now() - startTime;

      // Cache result
      if (opts.enableCaching) {
        this.setCachedResult(cacheKey, result, opts.cacheTTL);
      }

      // Log slow queries
      if (opts.logSlowQueries && executionTime > opts.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          query: query.substring(0, 200),
          executionTime,
          threshold: opts.slowQueryThreshold,
          params: params.length
        });
      }

      // Update query statistics
      this.updateQueryStats(query, executionTime);

      return {
        data: result,
        executionTime,
        fromCache: false,
        connectionId
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Optimized dbGet query failed', {
        query: query.substring(0, 100),
        executionTime,
        error: String(error)
      });

      throw new DatabaseError(
        'Optimized query execution failed',
        ErrorCode.DATABASE_QUERY_ERROR,
        undefined,
        { metadata: { query: query.substring(0, 100), executionTime, error: String(error) } }
      );
    }
  }

  /**
   * Execute optimized INSERT/UPDATE/DELETE query
   */
  async dbRun(
    query: string,
    params: unknown[] = [],
    options: OptimizedQueryOptions = {}
  ): Promise<QueryResult<{ lastID?: number; changes: number }>> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      let result: { lastID?: number; changes: number };
      let connectionId: string | undefined;

      if (opts.useConnectionPool && this.connectionPool) {
        result = await this.connectionPool.executeQuery<{ lastID?: number; changes: number }>(
          query, 
          params, 
          'run'
        );
      } else {
        // Fallback to legacy database helpers
        const { dbRun } = await import('../utils/database-helpers');
        result = await dbRun(query, params);
      }

      const executionTime = Date.now() - startTime;

      // Invalidate related cache entries for write operations
      if (this.isWriteOperation(query)) {
        this.invalidateRelatedCache(query);
      }

      // Log slow queries
      if (opts.logSlowQueries && executionTime > opts.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          query: query.substring(0, 200),
          executionTime,
          threshold: opts.slowQueryThreshold,
          params: params.length,
          changes: result.changes
        });
      }

      // Update query statistics
      this.updateQueryStats(query, executionTime);

      return {
        data: result,
        executionTime,
        fromCache: false,
        connectionId
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Optimized dbRun query failed', {
        query: query.substring(0, 100),
        executionTime,
        error: String(error)
      });

      throw new DatabaseError(
        'Optimized query execution failed',
        ErrorCode.DATABASE_QUERY_ERROR,
        undefined,
        { metadata: { query: query.substring(0, 100), executionTime, error: String(error) } }
      );
    }
  }

  /**
   * Execute multiple queries in a batch with optimal performance
   */
  async batchQueries<T = unknown>(
    queries: Array<{ query: string; params?: unknown[]; operation?: 'all' | 'get' | 'run' }>,
    options: OptimizedQueryOptions & { 
      batchSize?: number; 
      continueOnError?: boolean; 
      useTransaction?: boolean;
    } = {}
  ): Promise<BatchQueryResult<T>> {
    const opts = { 
      ...this.defaultOptions, 
      batchSize: 10, 
      continueOnError: false, 
      useTransaction: false,
      ...options 
    };
    
    const startTime = Date.now();
    const results: T[] = [];
    const errors: Error[] = [];

    try {
      if (opts.useTransaction && this.connectionPool) {
        // Execute in transaction for data consistency
        const transactionResult = await this.connectionPool.executeTransaction(
          async (_connection) => {
            const transactionResults: T[] = [];
            
            for (const queryObj of queries) {
              try {
                const result = await this.connectionPool!.executeQuery<T>(
                  queryObj.query,
                  queryObj.params || [],
                  queryObj.operation || 'all'
                );
                transactionResults.push(result);
              } catch (error) {
                if (!opts.continueOnError) {
                  throw error;
                }
                errors.push(error as Error);
              }
            }
            
            return transactionResults;
          }
        );
        
        results.push(...transactionResult);
      } else {
        // Execute with batch processing and connection pooling
        if (this.connectionPool) {
          const batchResults = await this.connectionPool.executeBatch<T>(
            queries,
            {
              batchSize: opts.batchSize,
              continueOnError: opts.continueOnError
            }
          );

          for (const result of batchResults) {
            if (result instanceof Error) {
              errors.push(result);
            } else {
              results.push(result);
            }
          }
        } else {
          // Fallback to sequential processing
          for (const queryObj of queries) {
            try {
              const result = await this.executeQueryFallback<T>(
                queryObj.query,
                queryObj.params || [],
                queryObj.operation || 'all'
              );
              results.push(result);
            } catch (error) {
              if (!opts.continueOnError) {
                throw error;
              }
              errors.push(error as Error);
            }
          }
        }
      }

      const executionTime = Date.now() - startTime;

      logger.info('Batch query execution completed', {
        totalQueries: queries.length,
        successCount: results.length,
        errorCount: errors.length,
        executionTime,
        avgTimePerQuery: executionTime / queries.length
      });

      return {
        results,
        executionTime,
        successCount: results.length,
        errorCount: errors.length,
        errors
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Batch query execution failed', {
        totalQueries: queries.length,
        executionTime,
        error: String(error)
      });

      throw new DatabaseError(
        'Batch query execution failed',
        ErrorCode.DATABASE_QUERY_ERROR,
        undefined,
        { metadata: { totalQueries: queries.length, executionTime, error: String(error) } }
      );
    }
  }

  /**
   * Execute queries with streaming for large result sets
   */
  async streamQuery<T = unknown>(
    query: string,
    params: unknown[] = [],
    processor: (row: T) => Promise<void>,
    options: OptimizedQueryOptions & { batchSize?: number } = {}
  ): Promise<{ processedRows: number; executionTime: number; errors: Error[] }> {
    const opts = { ...this.defaultOptions, batchSize: 1000, ...options };
    const startTime = Date.now();
    const errors: Error[] = [];
    let processedRows = 0;

    try {
      // Use LIMIT and OFFSET for streaming large result sets
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const paginatedQuery = `${query} LIMIT ${opts.batchSize} OFFSET ${offset}`;
        
        const result = await this.dbAll<T>(paginatedQuery, params, {
          ...opts,
          enableCaching: false // Don't cache streaming results
        });

        if (result.data.length === 0) {
          hasMore = false;
          break;
        }

        // Process batch
        for (const row of result.data) {
          try {
            await processor(row);
            processedRows++;
          } catch (error) {
            errors.push(error as Error);
            logger.error('Row processing error in stream', {
              offset,
              processedRows,
              error: String(error)
            });
          }
        }

        offset += opts.batchSize;

        // Check if we got fewer results than requested (end of data)
        if (result.data.length < opts.batchSize) {
          hasMore = false;
        }

        // Memory management - trigger GC if needed
        if (processedRows % (opts.batchSize * 10) === 0 && global.gc) {
          global.gc();
        }
      }

      const executionTime = Date.now() - startTime;

      logger.info('Stream query completed', {
        query: query.substring(0, 100),
        processedRows,
        errors: errors.length,
        executionTime,
        avgTimePerRow: processedRows > 0 ? executionTime / processedRows : 0
      });

      return {
        processedRows,
        executionTime,
        errors
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Stream query failed', {
        query: query.substring(0, 100),
        processedRows,
        executionTime,
        error: String(error)
      });

      throw new DatabaseError(
        'Stream query execution failed',
        ErrorCode.DATABASE_QUERY_ERROR,
        undefined,
        { metadata: { query: query.substring(0, 100), processedRows, executionTime, error: String(error) } }
      );
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): Array<{
    query: string;
    count: number;
    totalTime: number;
    avgTime: number;
    isFrequent: boolean;
    isSlow: boolean;
  }> {
    return Array.from(this.queryStats.entries()).map(([query, stats]) => ({
      query: query.substring(0, 100),
      count: stats.count,
      totalTime: stats.totalTime,
      avgTime: stats.avgTime,
      isFrequent: stats.count > 100,
      isSlow: stats.avgTime > this.defaultOptions.slowQueryThreshold
    }));
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    totalMemoryUsage: number;
    hitRate: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    let totalMemory = 0;
    let oldest = Date.now();
    let newest = 0;

    for (const cached of this.queryCache.values()) {
      totalMemory += JSON.stringify(cached.data).length;
      if (cached.timestamp < oldest) oldest = cached.timestamp;
      if (cached.timestamp > newest) newest = cached.timestamp;
    }

    return {
      totalEntries: this.queryCache.size,
      totalMemoryUsage: totalMemory,
      hitRate: 0, // Would need to track hits/misses separately
      oldestEntry: oldest,
      newestEntry: newest
    };
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
    logger.info('Query cache cleared');
  }

  /**
   * Close connections and cleanup
   */
  async close(): Promise<void> {
    if (this.connectionPool) {
      await this.connectionPool.close();
      this.connectionPool = null;
    }
    
    this.queryCache.clear();
    this.queryStats.clear();
    
    logger.info('Optimized database helper closed');
  }

  // Private helper methods

  private generateCacheKey(operation: string, query: string, params: unknown[]): string {
    const paramString = params.length > 0 ? JSON.stringify(params) : '';
    const queryHash = this.hashString(query + paramString);
    return `${operation}:${queryHash}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private getCachedResult<T>(cacheKey: string): T | undefined {
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    
    // Remove expired cache entry
    if (cached) {
      this.queryCache.delete(cacheKey);
    }
    
    return undefined;
  }

  private setCachedResult(cacheKey: string, data: unknown, ttl: number): void {
    this.queryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private isWriteOperation(query: string): boolean {
    const writeOperations = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'];
    const upperQuery = query.toUpperCase().trim();
    return writeOperations.some(op => upperQuery.startsWith(op));
  }

  private invalidateRelatedCache(query: string): void {
    // Simple cache invalidation - clear all cache for write operations
    // In a more sophisticated system, this could be more targeted
    if (this.isWriteOperation(query)) {
      const tableName = this.extractTableName(query);
      if (tableName) {
        // Remove cache entries related to this table
        for (const [key] of this.queryCache) {
          if (key.includes(tableName.toLowerCase())) {
            this.queryCache.delete(key);
          }
        }
      }
    }
  }

  private extractTableName(query: string): string | null {
    const patterns = [
      /INSERT\s+INTO\s+(\w+)/i,
      /UPDATE\s+(\w+)/i,
      /DELETE\s+FROM\s+(\w+)/i,
      /FROM\s+(\w+)/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private updateQueryStats(query: string, executionTime: number): void {
    const queryKey = this.normalizeQuery(query);
    const existing = this.queryStats.get(queryKey);

    if (existing) {
      existing.count++;
      existing.totalTime += executionTime;
      existing.avgTime = existing.totalTime / existing.count;
    } else {
      this.queryStats.set(queryKey, {
        count: 1,
        totalTime: executionTime,
        avgTime: executionTime
      });
    }
  }

  private normalizeQuery(query: string): string {
    // Normalize query by removing parameters and whitespace
    return query
      .replace(/\s+/g, ' ')
      .replace(/\?/g, '?')
      .trim()
      .substring(0, 200); // Truncate for memory efficiency
  }

  private async executeQueryFallback<T>(
    query: string,
    params: unknown[],
    operation: 'all' | 'get' | 'run'
  ): Promise<T> {
    const { dbAll, dbGet, dbRun } = await import('../utils/database-helpers');
    
    switch (operation) {
      case 'all':
        return await dbAll<T>(query, params) as T;
      case 'get':
        return await dbGet<T>(query, params) as T;
      case 'run':
        return await dbRun(query, params) as T;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  private setupCacheCleanup(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, cached] of this.queryCache) {
        if (now - cached.timestamp >= cached.ttl) {
          this.queryCache.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logger.debug('Cleaned up expired cache entries', { cleaned });
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
}

// Export singleton instance and convenience functions
const optimizedDb = OptimizedDatabaseHelper.getInstance();

export const initOptimizedDb = (dbPath: string) => optimizedDb.initialize(dbPath);

export const optimizedDbAll = <T = unknown>(
  query: string,
  params?: unknown[],
  options?: OptimizedQueryOptions
) => optimizedDb.dbAll<T>(query, params, options);

export const optimizedDbGet = <T = unknown>(
  query: string,
  params?: unknown[],
  options?: OptimizedQueryOptions
) => optimizedDb.dbGet<T>(query, params, options);

export const optimizedDbRun = (
  query: string,
  params?: unknown[],
  options?: OptimizedQueryOptions
) => optimizedDb.dbRun(query, params, options);

export const optimizedBatchQueries = <T = unknown>(
  queries: Array<{ query: string; params?: unknown[]; operation?: 'all' | 'get' | 'run' }>,
  options?: OptimizedQueryOptions & { 
    batchSize?: number; 
    continueOnError?: boolean; 
    useTransaction?: boolean;
  }
) => optimizedDb.batchQueries<T>(queries, options);

export const streamQuery = <T = unknown>(
  query: string,
  params: unknown[],
  processor: (row: T) => Promise<void>,
  options?: OptimizedQueryOptions & { batchSize?: number }
) => optimizedDb.streamQuery<T>(query, params, processor, options);

export { optimizedDb };