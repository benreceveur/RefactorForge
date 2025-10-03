/**
 * RefactorForge Database Index Optimizer
 *
 * Provides safe, programmatic index creation with performance monitoring
 * and rollback capabilities for database optimization.
 */

import { dbRun, dbGet, dbAll } from '../utils/database-helpers';
import { logger } from '../utils/logger';
import { DatabaseError, ErrorCode } from '../errors/AppError';

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
  where?: string; // For partial indexes
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedImpact: string;
}

export interface IndexCreationResult {
  name: string;
  created: boolean;
  existed: boolean;
  executionTime: number;
  error?: string;
}

export interface OptimizationReport {
  totalIndexes: number;
  newIndexes: number;
  skippedIndexes: number;
  failedIndexes: number;
  results: IndexCreationResult[];
  totalExecutionTime: number;
  performanceTests: PerformanceTestResult[];
}

export interface PerformanceTestResult {
  query: string;
  description: string;
  executionPlan: string;
  usesIndex: boolean;
  estimatedImprovement: string;
}

/**
 * RefactorForge Performance Index Definitions
 * Based on comprehensive analysis of query patterns and bottlenecks
 */
export const PERFORMANCE_INDEXES: IndexDefinition[] = [
  {
    name: 'idx_repositories_status_org_updated',
    table: 'repositories',
    columns: ['analysis_status', 'organization', 'updated_at DESC'],
    description: 'Optimizes repository dashboard filtering and sorting',
    priority: 'critical',
    estimatedImpact: '80-95% faster repository queries'
  },
  {
    name: 'idx_patterns_repo_category_confidence',
    table: 'repository_patterns',
    columns: ['repository_id', 'category', 'confidence_score DESC'],
    description: 'Optimizes pattern search with confidence filtering',
    priority: 'critical',
    estimatedImpact: '85-95% faster pattern searches'
  },
  {
    name: 'idx_timeline_events_repo_type_created',
    table: 'timeline_events',
    columns: ['repository', 'type', 'created_at DESC'],
    description: 'Optimizes timeline activity tracking',
    priority: 'high',
    estimatedImpact: '75-90% faster timeline queries'
  },
  {
    name: 'idx_search_history_user_created',
    table: 'search_history',
    columns: ['user_id', 'created_at DESC'],
    description: 'Optimizes user search history analytics',
    priority: 'high',
    estimatedImpact: '70-85% faster search history'
  },
  {
    name: 'idx_error_reports_level_component_created',
    table: 'client_error_reports',
    columns: ['level', 'component', 'created_at DESC'],
    description: 'Optimizes error reporting analytics',
    priority: 'high',
    estimatedImpact: '70-85% faster error analytics'
  },
  {
    name: 'idx_jobs_repository_status_type',
    table: 'analysis_jobs',
    columns: ['repository_id', 'status', 'job_type', 'created_at DESC'],
    description: 'Enhanced analysis jobs tracking',
    priority: 'medium',
    estimatedImpact: '60-80% faster job status queries'
  },
  {
    name: 'idx_recommendations_active_priority',
    table: 'repository_recommendations',
    columns: ['repository_id', 'priority', 'updated_at DESC'],
    where: "status IN ('pending', 'in_progress')",
    description: 'Partial index for active recommendations only',
    priority: 'medium',
    estimatedImpact: '50-70% faster dashboard recommendations'
  }
];

/**
 * Performance test queries to validate index effectiveness
 */
export const PERFORMANCE_TESTS = [
  {
    query: `SELECT * FROM repositories
            WHERE analysis_status = 'analyzed'
              AND organization = 'IntelliPact'
            ORDER BY updated_at DESC
            LIMIT 20`,
    description: 'Repository dashboard query',
    expectedIndex: 'idx_repositories_status_org_updated'
  },
  {
    query: `SELECT * FROM repository_patterns
            WHERE repository_id = 'test-repo'
              AND category = 'performance'
              AND confidence_score > 0.7
            ORDER BY confidence_score DESC`,
    description: 'Pattern search with confidence filtering',
    expectedIndex: 'idx_patterns_repo_category_confidence'
  },
  {
    query: `SELECT * FROM timeline_events
            WHERE repository = 'IntelliPact/RefactorForge'
              AND type = 'analysis'
            ORDER BY created_at DESC
            LIMIT 50`,
    description: 'Timeline events query',
    expectedIndex: 'idx_timeline_events_repo_type_created'
  }
];

export class DatabaseIndexOptimizer {
  private static instance: DatabaseIndexOptimizer;

  public static getInstance(): DatabaseIndexOptimizer {
    if (!DatabaseIndexOptimizer.instance) {
      DatabaseIndexOptimizer.instance = new DatabaseIndexOptimizer();
    }
    return DatabaseIndexOptimizer.instance;
  }

  /**
   * Check if an index exists in the database
   */
  async indexExists(indexName: string): Promise<boolean> {
    try {
      const result = await dbGet<{ count: number }>(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name=?",
        [indexName]
      );
      return (result?.count || 0) > 0;
    } catch (error) {
      logger.error('Failed to check index existence', {
        indexName,
        error: String(error)
      });
      return false;
    }
  }

  /**
   * Create a single index with error handling and monitoring
   */
  async createIndex(indexDef: IndexDefinition): Promise<IndexCreationResult> {
    const startTime = Date.now();
    const result: IndexCreationResult = {
      name: indexDef.name,
      created: false,
      existed: false,
      executionTime: 0
    };

    try {
      // Check if index already exists
      const exists = await this.indexExists(indexDef.name);
      if (exists) {
        result.existed = true;
        result.executionTime = Date.now() - startTime;
        logger.info('Index already exists, skipping', {
          indexName: indexDef.name,
          table: indexDef.table
        });
        return result;
      }

      // Generate CREATE INDEX statement
      const sql = this.generateCreateIndexSQL(indexDef);

      logger.info('Creating performance index', {
        indexName: indexDef.name,
        table: indexDef.table,
        columns: indexDef.columns,
        priority: indexDef.priority,
        sql: sql.substring(0, 200)
      });

      // Create the index
      await dbRun(sql);

      result.created = true;
      result.executionTime = Date.now() - startTime;

      logger.info('Performance index created successfully', {
        indexName: indexDef.name,
        executionTime: result.executionTime,
        estimatedImpact: indexDef.estimatedImpact
      });

      return result;

    } catch (error) {
      result.executionTime = Date.now() - startTime;
      result.error = String(error);

      logger.error('Failed to create performance index', {
        indexName: indexDef.name,
        table: indexDef.table,
        executionTime: result.executionTime,
        error: String(error)
      });

      return result;
    }
  }

  /**
   * Create all performance indexes with proper error handling
   */
  async optimizeDatabase(
    priorities: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high']
  ): Promise<OptimizationReport> {
    const startTime = Date.now();
    const results: IndexCreationResult[] = [];

    logger.info('Starting database optimization', {
      targetPriorities: priorities,
      totalIndexes: PERFORMANCE_INDEXES.length
    });

    // Filter indexes by priority
    const targetIndexes = PERFORMANCE_INDEXES.filter(idx =>
      priorities.includes(idx.priority)
    );

    // Create indexes sequentially to avoid conflicts
    for (const indexDef of targetIndexes) {
      const result = await this.createIndex(indexDef);
      results.push(result);
    }

    // Run performance tests
    const performanceTests = await this.runPerformanceTests();

    const report: OptimizationReport = {
      totalIndexes: targetIndexes.length,
      newIndexes: results.filter(r => r.created).length,
      skippedIndexes: results.filter(r => r.existed).length,
      failedIndexes: results.filter(r => r.error).length,
      results,
      totalExecutionTime: Date.now() - startTime,
      performanceTests
    };

    logger.info('Database optimization completed', {
      newIndexes: report.newIndexes,
      skippedIndexes: report.skippedIndexes,
      failedIndexes: report.failedIndexes,
      totalExecutionTime: report.totalExecutionTime
    });

    return report;
  }

  /**
   * Run performance tests to validate index effectiveness
   */
  async runPerformanceTests(): Promise<PerformanceTestResult[]> {
    const tests: PerformanceTestResult[] = [];

    for (const test of PERFORMANCE_TESTS) {
      try {
        // Get query execution plan
        const planResult = await dbAll<{ detail: string }>(
          `EXPLAIN QUERY PLAN ${test.query}`
        );

        const executionPlan = planResult
          .map(row => row.detail)
          .join(' | ');

        const usesIndex = executionPlan.toLowerCase().includes('using index');
        const estimatedImprovement = usesIndex
          ? 'Significant improvement expected'
          : 'May require additional optimization';

        tests.push({
          query: test.query.replace(/\s+/g, ' ').trim(),
          description: test.description,
          executionPlan,
          usesIndex,
          estimatedImprovement
        });

        logger.debug('Performance test completed', {
          description: test.description,
          usesIndex,
          executionPlan: executionPlan.substring(0, 100)
        });

      } catch (error) {
        logger.error('Performance test failed', {
          description: test.description,
          error: String(error)
        });

        tests.push({
          query: test.query,
          description: test.description,
          executionPlan: `Error: ${String(error)}`,
          usesIndex: false,
          estimatedImprovement: 'Test failed'
        });
      }
    }

    return tests;
  }

  /**
   * Remove specific indexes (for rollback)
   */
  async removeIndexes(indexNames: string[]): Promise<void> {
    logger.info('Removing indexes', { indexNames });

    for (const indexName of indexNames) {
      try {
        await dbRun(`DROP INDEX IF EXISTS ${indexName}`);
        logger.info('Index removed successfully', { indexName });
      } catch (error) {
        logger.error('Failed to remove index', {
          indexName,
          error: String(error)
        });
        throw new DatabaseError(
          `Failed to remove index ${indexName}`,
          ErrorCode.DATABASE_QUERY_ERROR,
          undefined,
          { operation: 'remove_index', error: String(error), metadata: { indexName } }
        );
      }
    }
  }

  /**
   * Get current database index statistics
   */
  async getIndexStatistics(): Promise<{
    totalIndexes: number;
    customIndexes: number;
    indexSizes: Array<{ name: string; table: string }>;
  }> {
    try {
      const allIndexes = await dbAll<{ name: string; tbl_name: string }>(
        "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
      );

      const customIndexes = allIndexes.filter(idx =>
        idx.name.startsWith('idx_')
      );

      return {
        totalIndexes: allIndexes.length,
        customIndexes: customIndexes.length,
        indexSizes: allIndexes.map(idx => ({
          name: idx.name,
          table: idx.tbl_name
        }))
      };
    } catch (error) {
      logger.error('Failed to get index statistics', { error: String(error) });
      throw new DatabaseError(
        'Failed to retrieve index statistics',
        ErrorCode.DATABASE_QUERY_ERROR,
        undefined,
        { error: String(error) }
      );
    }
  }

  /**
   * Generate CREATE INDEX SQL statement
   */
  private generateCreateIndexSQL(indexDef: IndexDefinition): string {
    const unique = indexDef.unique ? 'UNIQUE ' : '';
    const columns = indexDef.columns.join(', ');
    const where = indexDef.where ? ` WHERE ${indexDef.where}` : '';

    return `CREATE ${unique}INDEX IF NOT EXISTS ${indexDef.name} ON ${indexDef.table}(${columns})${where}`;
  }
}

// Export convenience functions
export const optimizeDatabase = (priorities?: Array<'critical' | 'high' | 'medium' | 'low'>) =>
  DatabaseIndexOptimizer.getInstance().optimizeDatabase(priorities);

export const createPerformanceIndex = (indexDef: IndexDefinition) =>
  DatabaseIndexOptimizer.getInstance().createIndex(indexDef);

export const getIndexStatistics = () =>
  DatabaseIndexOptimizer.getInstance().getIndexStatistics();

export const runPerformanceTests = () =>
  DatabaseIndexOptimizer.getInstance().runPerformanceTests();