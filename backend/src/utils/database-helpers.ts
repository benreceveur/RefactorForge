import db from '../database';
import { DatabaseError, ErrorCode, AppError } from '../errors/AppError';
import { logger } from './logger';

export interface RunResult {
  lastID?: number;
  changes: number;
}

export interface TransactionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: AppError;
}

export interface DatabaseRetryOptions {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
}

const DEFAULT_RETRY_OPTIONS: DatabaseRetryOptions = {
  maxRetries: 3,
  backoffMs: 100,
  maxBackoffMs: 5000
};

/**
 * Enhanced database helper with retry logic and comprehensive error handling
 */
function withDatabaseErrorHandling<T>(
  operation: string,
  query: string,
  params: unknown[] = [],
  options: Partial<DatabaseRetryOptions> = {}
) {
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  
  const executeWithRetry = async (attempt = 1): Promise<T> => {
    const startTime = Date.now();
    
    try {
      logger.database(operation, query, { attempt, params: params.length });
      
      const result = await new Promise<T>((resolve, reject) => {
        const callback = (err: Error | null, data?: T | T[]) => {
          if (err) {
            reject(convertDatabaseError(err, operation, query));
          } else {
            resolve(data as T);
          }
        };
        
        // Execute the appropriate database operation
        if (operation === 'all') {
          db.all(query, params, (err, rows) => callback(err, (rows as T[]) || []));
        } else if (operation === 'get') {
          db.get(query, params, (err, row) => callback(err, row as T));
        } else if (operation === 'run') {
          db.run(query, params, function(err) {
            if (err) {
              callback(err);
            } else {
              callback(null, { 
                lastID: this.lastID, 
                changes: this.changes 
              } as T);
            }
          });
        }
      });
      
      // Log successful operation
      logger.performance(`Database ${operation}`, startTime, { 
        query: query.substring(0, 100),
        params: params.length 
      });
      
      return result;
      
    } catch (error) {
      const dbError = error as DatabaseError;
      
      // Check if we should retry
      if (attempt < retryOptions.maxRetries && isRetryableError(dbError)) {
        const backoffMs = Math.min(
          retryOptions.backoffMs * Math.pow(2, attempt - 1),
          retryOptions.maxBackoffMs
        );
        
        logger.warn(`Database operation failed, retrying in ${backoffMs}ms`, {
          operation,
          attempt,
          maxRetries: retryOptions.maxRetries,
          error: dbError.message
        });
        
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return executeWithRetry(attempt + 1);
      }
      
      // Log the final error
      logger.error(`Database operation failed after ${attempt} attempts`, {
        operation,
        query: query.substring(0, 100),
        error: dbError.toLogObject()
      });
      
      throw dbError;
    }
  };
  
  return executeWithRetry();
}

/**
 * Check if a database error is retryable
 */
function isRetryableError(error: DatabaseError): boolean {
  const retryablePatterns = [
    /database is locked/i,
    /database disk image is malformed/i,
    /disk i\/o error/i,
    /connection/i
  ];
  
  return retryablePatterns.some(pattern => pattern.test(error.message));
}

/**
 * Convert database errors to structured AppError instances
 */
function convertDatabaseError(error: Error, operation: string, query: string): DatabaseError {
  const message = error.message.toLowerCase();
  
  if (message.includes('unique constraint')) {
    return new DatabaseError(
      'Duplicate resource',
      ErrorCode.DATABASE_CONSTRAINT_ERROR,
      { constraint: 'unique' },
      { operation, resource: extractTableFromQuery(query) }
    );
  }
  
  if (message.includes('foreign key constraint')) {
    return new DatabaseError(
      'Foreign key constraint violation',
      ErrorCode.DATABASE_CONSTRAINT_ERROR,
      { constraint: 'foreign_key' },
      { operation, resource: extractTableFromQuery(query) }
    );
  }
  
  if (message.includes('not null constraint')) {
    return new DatabaseError(
      'Required field missing',
      ErrorCode.DATABASE_CONSTRAINT_ERROR,
      { constraint: 'not_null' },
      { operation, resource: extractTableFromQuery(query) }
    );
  }
  
  if (message.includes('database is locked') || message.includes('busy')) {
    return new DatabaseError(
      'Database temporarily unavailable',
      ErrorCode.DATABASE_CONNECTION_ERROR,
      { constraint: 'locked' },
      { operation }
    );
  }
  
  // Default database error
  return new DatabaseError(
    error.message,
    ErrorCode.DATABASE_QUERY_ERROR,
    undefined,
    { operation, resource: extractTableFromQuery(query) }
  );
}

/**
 * Extract table name from SQL query for context
 */
function extractTableFromQuery(query: string): string {
  const tablePatterns = [
    /from\s+(\w+)/i,
    /into\s+(\w+)/i,
    /update\s+(\w+)/i,
    /delete\s+from\s+(\w+)/i
  ];
  
  for (const pattern of tablePatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return 'unknown';
}

/**
 * Promisified version of db.all() with enhanced error handling and retry logic
 * @template T The expected type of each row returned from the query
 * @param query SQL query string
 * @param params Query parameters (use unknown[] for type safety)
 * @param options Retry options for the operation
 * @returns Promise resolving to array of rows of type T
 * @example
 * // Usage with proper typing:
 * const users = await dbAll<UserRow>('SELECT * FROM users WHERE active = ?', [true]);
 */
export const dbAll = <T = unknown>(
  query: string, 
  params: unknown[] = [],
  options?: Partial<DatabaseRetryOptions>
): Promise<T[]> => {
  return withDatabaseErrorHandling<T[]>('all', query, params, options);
};

/**
 * Promisified version of db.get() with enhanced error handling and retry logic
 * @template T The expected type of the row returned from the query
 * @param query SQL query string
 * @param params Query parameters (use unknown[] for type safety)
 * @param options Retry options for the operation
 * @returns Promise resolving to a single row of type T or undefined
 * @example
 * // Usage with proper typing:
 * const user = await dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [userId]);
 */
export const dbGet = <T = unknown>(
  query: string, 
  params: unknown[] = [],
  options?: Partial<DatabaseRetryOptions>
): Promise<T | undefined> => {
  return withDatabaseErrorHandling<T | undefined>('get', query, params, options);
};

/**
 * Promisified version of db.run() with enhanced error handling and retry logic
 * Returns both lastID and changes for INSERT/UPDATE/DELETE operations
 * @param query SQL query string for INSERT/UPDATE/DELETE operations
 * @param params Query parameters (use unknown[] for type safety)
 * @param options Retry options for the operation
 * @returns Promise resolving to RunResult with lastID and changes count
 * @example
 * // Usage with proper typing:
 * const result = await dbRun('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
 * console.log('Inserted user with ID:', result.lastID);
 */
export const dbRun = (
  query: string, 
  params: unknown[] = [],
  options?: Partial<DatabaseRetryOptions>
): Promise<RunResult> => {
  return withDatabaseErrorHandling<RunResult>('run', query, params, options);
};

/**
 * Execute multiple operations in a database transaction
 * Automatically handles rollback on errors
 */
export async function withTransaction<T>(
  operations: (db: {
    run: (sql: string, params?: unknown[], callback?: (err: Error | null, result?: RunResult) => void) => void;
    get: <U = unknown>(sql: string, params?: unknown[], callback?: (err: Error | null, row?: U) => void) => void;
    all: <U = unknown>(sql: string, params?: unknown[], callback?: (err: Error | null, rows?: U[]) => void) => void;
  }) => Promise<T>
): Promise<TransactionResult<T>> {
  const startTime = Date.now();
  
  try {
    logger.database('Transaction started');
    
    // Begin transaction
    await new Promise<void>((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err: Error | null) => {
        if (err) reject(convertDatabaseError(err, 'begin_transaction', 'BEGIN TRANSACTION'));
        else resolve();
      });
    });
    
    // Execute operations
    const result = await operations(db);
    
    // Commit transaction
    await new Promise<void>((resolve, reject) => {
      db.run('COMMIT', (err: Error | null) => {
        if (err) reject(convertDatabaseError(err, 'commit_transaction', 'COMMIT'));
        else resolve();
      });
    });
    
    logger.performance('Database transaction completed', startTime);
    
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    // Rollback on error
    try {
      await new Promise<void>((resolve, reject) => {
        db.run('ROLLBACK', (err: Error | null) => {
          if (err) reject(convertDatabaseError(err, 'rollback_transaction', 'ROLLBACK'));
          else resolve();
        });
      });
      logger.warn('Database transaction rolled back');
    } catch (rollbackError) {
      logger.error('Failed to rollback transaction', {
        originalError: error instanceof AppError ? error.toLogObject() : { message: String(error) },
        rollbackError: rollbackError instanceof AppError ? rollbackError.toLogObject() : { message: String(rollbackError) }
      });
    }
    
    const dbError = error instanceof AppError ? error : new DatabaseError(
      'Transaction failed',
      ErrorCode.DATABASE_TRANSACTION_ERROR,
      undefined,
      { operation: 'transaction' }
    );
    
    logger.error('Database transaction failed', {
      duration: Date.now() - startTime,
      error: dbError.toLogObject()
    });
    
    return {
      success: false,
      error: dbError
    };
  }
}

/**
 * Batch database operations with automatic error handling
 */
export async function batchOperations<T>(
  operations: Array<() => Promise<T>>,
  options: { 
    continueOnError?: boolean;
    maxConcurrent?: number;
  } = {}
): Promise<{ 
  results: T[];
  errors: AppError[];
  successCount: number;
  failureCount: number;
}> {
  const { continueOnError = false, maxConcurrent = 5 } = options;
  const results: T[] = [];
  const errors: AppError[] = [];
  
  // Execute operations in batches to avoid overwhelming the database
  for (let i = 0; i < operations.length; i += maxConcurrent) {
    const batch = operations.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (operation, index) => {
      try {
        const result = await operation();
        return { success: true, result, index: i + index };
      } catch (error) {
        const appError = error instanceof AppError ? error : new DatabaseError(
          'Batch operation failed',
          ErrorCode.DATABASE_QUERY_ERROR,
          undefined,
          { operation: 'batch', metadata: { index: i + index } }
        );
        return { success: false, error: appError, index: i + index };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const batchResult of batchResults) {
      if (batchResult.success && batchResult.result !== undefined) {
        results.push(batchResult.result);
      } else if (batchResult.error) {
        errors.push(batchResult.error);
        if (!continueOnError) {
          // Stop processing on first error
          return {
            results,
            errors,
            successCount: results.length,
            failureCount: errors.length
          };
        }
      }
    }
  }
  
  return {
    results,
    errors,
    successCount: results.length,
    failureCount: errors.length
  };
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: AppError;
}> {
  const startTime = Date.now();
  
  try {
    await dbGet('SELECT 1 as test');
    const latency = Date.now() - startTime;
    
    return {
      healthy: true,
      latency
    };
  } catch (error) {
    const appError = error instanceof AppError ? error : new DatabaseError(
      'Database health check failed',
      ErrorCode.DATABASE_CONNECTION_ERROR,
      undefined,
      { operation: 'health_check' }
    );
    
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: appError
    };
  }
}