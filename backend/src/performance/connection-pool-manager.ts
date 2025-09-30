import sqlite3 from 'sqlite3';
import { logger } from '../utils/logger';
import { DatabaseError, ErrorCode } from '../errors/AppError';

export interface ConnectionPoolOptions {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  retryDelay: number;
  maxRetries: number;
}

export interface PoolStats {
  totalConnections: number;
  availableConnections: number;
  busyConnections: number;
  pendingRequests: number;
  totalAcquired: number;
  totalReleased: number;
  totalErrors: number;
  averageQueryTime: number;
  peakConnections: number;
}

interface PoolConnection {
  id: string;
  connection: sqlite3.Database;
  inUse: boolean;
  createdAt: Date;
  lastUsed: Date;
  queryCount: number;
  totalQueryTime: number;
}

interface PendingRequest {
  resolve: (connection: PoolConnection) => void;
  reject: (error: Error) => void;
  timestamp: Date;
}

/**
 * Advanced SQLite Connection Pool Manager
 * Provides efficient connection reuse, monitoring, and optimization
 */
export class ConnectionPoolManager {
  private connections: Map<string, PoolConnection> = new Map();
  private pendingRequests: PendingRequest[] = [];
  private options: ConnectionPoolOptions;
  private dbPath: string;
  private stats: PoolStats;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private queryTimings: number[] = [];

  constructor(dbPath: string, options: Partial<ConnectionPoolOptions> = {}) {
    this.dbPath = dbPath;
    this.options = {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeout: 30000,
      idleTimeout: 300000, // 5 minutes
      retryDelay: 100,
      maxRetries: 3,
      ...options
    };

    this.stats = {
      totalConnections: 0,
      availableConnections: 0,
      busyConnections: 0,
      pendingRequests: 0,
      totalAcquired: 0,
      totalReleased: 0,
      totalErrors: 0,
      averageQueryTime: 0,
      peakConnections: 0
    };

    this.initialize();
  }

  /**
   * Initialize the connection pool with minimum connections
   */
  private async initialize(): Promise<void> {
    logger.info('Initializing SQLite connection pool', {
      dbPath: this.dbPath,
      maxConnections: this.options.maxConnections,
      minConnections: this.options.minConnections
    });

    // Create minimum connections
    for (let i = 0; i < this.options.minConnections; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        logger.error(`Failed to create initial connection ${i + 1}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Run every minute

    logger.info(`Connection pool initialized with ${this.connections.size} connections`);
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<PoolConnection> {
    return new Promise((resolve, reject) => {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
          logger.error('Failed to create database connection', {
            connectionId,
            error: err.message
          });
          reject(new DatabaseError(
            'Failed to create database connection',
            ErrorCode.DATABASE_CONNECTION_ERROR,
            undefined,
            { metadata: { connectionId } }
          ));
          return;
        }

        // Configure connection for optimal performance
        db.configure('busyTimeout', 30000);
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA synchronous = NORMAL');
        db.run('PRAGMA cache_size = 10000');
        db.run('PRAGMA temp_store = MEMORY');

        const poolConnection: PoolConnection = {
          id: connectionId,
          connection: db,
          inUse: false,
          createdAt: new Date(),
          lastUsed: new Date(),
          queryCount: 0,
          totalQueryTime: 0
        };

        this.connections.set(connectionId, poolConnection);
        this.stats.totalConnections++;
        this.stats.availableConnections++;
        
        if (this.stats.totalConnections > this.stats.peakConnections) {
          this.stats.peakConnections = this.stats.totalConnections;
        }

        logger.debug('Created new database connection', {
          connectionId,
          totalConnections: this.connections.size
        });

        resolve(poolConnection);
      });
    });
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<PoolConnection> {
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now();
      
      // Check for available connection
      const availableConnection = this.getAvailableConnection();
      if (availableConnection) {
        this.markConnectionInUse(availableConnection);
        this.stats.totalAcquired++;
        resolve(availableConnection);
        return;
      }

      // Create new connection if under limit
      if (this.connections.size < this.options.maxConnections) {
        try {
          const newConnection = await this.createConnection();
          this.markConnectionInUse(newConnection);
          this.stats.totalAcquired++;
          resolve(newConnection);
          return;
        } catch (error) {
          this.stats.totalErrors++;
          reject(error);
          return;
        }
      }

      // Queue request if at connection limit
      const pendingRequest: PendingRequest = {
        resolve: (connection: PoolConnection) => {
          this.stats.totalAcquired++;
          resolve(connection);
        },
        reject: (error: Error) => {
          this.stats.totalErrors++;
          reject(error);
        },
        timestamp: new Date()
      };

      this.pendingRequests.push(pendingRequest);
      this.stats.pendingRequests = this.pendingRequests.length;

      // Set timeout for pending request
      setTimeout(() => {
        const index = this.pendingRequests.indexOf(pendingRequest);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
          this.stats.pendingRequests = this.pendingRequests.length;
          
          const timeoutError = new DatabaseError(
            'Connection acquire timeout',
            ErrorCode.DATABASE_CONNECTION_ERROR,
            undefined,
            { 
              metadata: {
                timeout: this.options.acquireTimeout,
                waitTime: Date.now() - startTime 
              }
            }
          );
          
          reject(timeoutError);
        }
      }, this.options.acquireTimeout);
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: PoolConnection): void {
    if (!this.connections.has(connection.id)) {
      logger.warn('Attempted to release unknown connection', {
        connectionId: connection.id
      });
      return;
    }

    this.markConnectionAvailable(connection);
    this.stats.totalReleased++;

    // Process pending requests
    if (this.pendingRequests.length > 0) {
      const pendingRequest = this.pendingRequests.shift()!;
      this.stats.pendingRequests = this.pendingRequests.length;
      
      this.markConnectionInUse(connection);
      pendingRequest.resolve(connection);
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  async executeQuery<T>(
    query: string,
    params: unknown[] = [],
    operation: 'all' | 'get' | 'run' = 'all'
  ): Promise<T> {
    const connection = await this.acquire();
    const queryStartTime = Date.now();

    try {
      const result = await this.performQuery<T>(connection, query, params, operation);
      
      // Track query performance
      const queryTime = Date.now() - queryStartTime;
      connection.totalQueryTime += queryTime;
      connection.queryCount++;
      
      this.queryTimings.push(queryTime);
      if (this.queryTimings.length > 1000) {
        this.queryTimings = this.queryTimings.slice(-1000); // Keep last 1000 timings
      }
      
      this.stats.averageQueryTime = this.queryTimings.reduce((a, b) => a + b, 0) / this.queryTimings.length;

      return result;
    } finally {
      this.release(connection);
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async executeTransaction<T>(
    operation: (connection: PoolConnection) => Promise<T>
  ): Promise<T> {
    const connection = await this.acquire();

    try {
      // Begin transaction
      await this.performQuery(connection, 'BEGIN TRANSACTION', [], 'run');
      
      try {
        const result = await operation(connection);
        await this.performQuery(connection, 'COMMIT', [], 'run');
        return result;
      } catch (error) {
        await this.performQuery(connection, 'ROLLBACK', [], 'run');
        throw error;
      }
    } finally {
      this.release(connection);
    }
  }

  /**
   * Execute queries in batches for optimal performance
   */
  async executeBatch<T>(
    queries: Array<{ query: string; params?: unknown[]; operation?: 'all' | 'get' | 'run' }>,
    options: { batchSize?: number; continueOnError?: boolean } = {}
  ): Promise<Array<T | Error>> {
    const { batchSize = 10, continueOnError = false } = options;
    const results: Array<T | Error> = [];

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async ({ query, params = [], operation = 'all' }) => {
        try {
          return await this.executeQuery<T>(query, params, operation);
        } catch (error) {
          if (continueOnError) {
            return error as Error;
          }
          throw error;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push(result.reason);
          if (!continueOnError) {
            throw result.reason;
          }
        }
      }
    }

    return results;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get detailed pool information
   */
  getPoolInfo(): {
    connections: Array<{
      id: string;
      inUse: boolean;
      age: number;
      idleTime: number;
      queryCount: number;
      averageQueryTime: number;
    }>;
    stats: PoolStats;
  } {
    const now = new Date();
    const connections = Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      inUse: conn.inUse,
      age: now.getTime() - conn.createdAt.getTime(),
      idleTime: now.getTime() - conn.lastUsed.getTime(),
      queryCount: conn.queryCount,
      averageQueryTime: conn.queryCount > 0 ? conn.totalQueryTime / conn.queryCount : 0
    }));

    return {
      connections,
      stats: this.getStats()
    };
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    logger.info('Closing connection pool', {
      totalConnections: this.connections.size,
      pendingRequests: this.pendingRequests.length
    });

    // Cancel cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Reject all pending requests
    for (const request of this.pendingRequests) {
      request.reject(new DatabaseError(
        'Connection pool is closing',
        ErrorCode.DATABASE_CONNECTION_ERROR
      ));
    }
    this.pendingRequests.length = 0;

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(conn => 
      new Promise<void>((resolve) => {
        conn.connection.close((err) => {
          if (err) {
            logger.error('Error closing connection', {
              connectionId: conn.id,
              error: err.message
            });
          }
          resolve();
        });
      })
    );

    await Promise.all(closePromises);
    this.connections.clear();
    
    logger.info('Connection pool closed successfully');
  }

  // Private helper methods

  private getAvailableConnection(): PoolConnection | null {
    for (const connection of this.connections.values()) {
      if (!connection.inUse) {
        return connection;
      }
    }
    return null;
  }

  private markConnectionInUse(connection: PoolConnection): void {
    connection.inUse = true;
    connection.lastUsed = new Date();
    this.updateStats();
  }

  private markConnectionAvailable(connection: PoolConnection): void {
    connection.inUse = false;
    connection.lastUsed = new Date();
    this.updateStats();
  }

  private updateStats(): void {
    this.stats.totalConnections = this.connections.size;
    this.stats.availableConnections = Array.from(this.connections.values())
      .filter(conn => !conn.inUse).length;
    this.stats.busyConnections = this.stats.totalConnections - this.stats.availableConnections;
    this.stats.pendingRequests = this.pendingRequests.length;
  }

  private performQuery<T>(
    connection: PoolConnection,
    query: string,
    params: unknown[],
    operation: 'all' | 'get' | 'run'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const callback = (err: Error | null, data?: T | T[]) => {
        if (err) {
          reject(new DatabaseError(
            err.message,
            ErrorCode.DATABASE_QUERY_ERROR,
            undefined,
            { 
              metadata: {
                query: query.substring(0, 100),
                params: params.length,
                connectionId: connection.id
              }
            }
          ));
        } else {
          resolve(data as T);
        }
      };

      if (operation === 'all') {
        connection.connection.all(query, params, (err, rows) => 
          callback(err, (rows as T[]) || []));
      } else if (operation === 'get') {
        connection.connection.get(query, params, (err, row) => 
          callback(err, row as T));
      } else if (operation === 'run') {
        connection.connection.run(query, params, function(err) {
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
  }

  private cleanupIdleConnections(): void {
    const now = new Date();
    const connectionsToClose: string[] = [];

    for (const [id, connection] of this.connections) {
      if (!connection.inUse) {
        const idleTime = now.getTime() - connection.lastUsed.getTime();
        
        if (idleTime > this.options.idleTimeout && 
            this.connections.size > this.options.minConnections) {
          connectionsToClose.push(id);
        }
      }
    }

    // Close idle connections
    for (const id of connectionsToClose) {
      const connection = this.connections.get(id);
      if (connection) {
        connection.connection.close((err) => {
          if (err) {
            logger.error('Error closing idle connection', {
              connectionId: id,
              error: err.message
            });
          } else {
            logger.debug('Closed idle connection', { connectionId: id });
          }
        });
        this.connections.delete(id);
      }
    }

    if (connectionsToClose.length > 0) {
      this.updateStats();
      logger.info('Cleaned up idle connections', {
        closedConnections: connectionsToClose.length,
        remainingConnections: this.connections.size
      });
    }
  }
}

// Export singleton instance
let poolInstance: ConnectionPoolManager | null = null;

export function getConnectionPool(dbPath?: string): ConnectionPoolManager {
  if (!poolInstance) {
    if (!dbPath) {
      throw new Error('Database path required for connection pool initialization');
    }
    poolInstance = new ConnectionPoolManager(dbPath, {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '15'),
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '3'),
      acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300000')
    });
  }
  return poolInstance;
}

export async function closeConnectionPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.close();
    poolInstance = null;
  }
}