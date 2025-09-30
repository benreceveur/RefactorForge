import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getPerformanceMonitor } from '../performance/performance-monitor';
import { getConnectionPool } from '../performance/connection-pool-manager';
import { optimizedDb } from '../performance/optimized-database-helpers';
import { logger } from '../utils/logger';
import { processUtils } from '../types/node.types';

const router = Router();
const performanceMonitor = getPerformanceMonitor();

/**
 * Get performance dashboard data
 */
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  const minutes = parseInt(req.query.minutes as string) || 30;
  
  try {
    // Get performance summary
    const summary = performanceMonitor.getPerformanceSummary(minutes);
    
    // Get connection pool stats
    let poolStats = null;
    try {
      const dbPath = process.env.DATABASE_PATH || './refactorforge.db';
      const pool = getConnectionPool(dbPath);
      poolStats = pool.getStats();
    } catch (error) {
      logger.warn('Could not get connection pool stats', { error: String(error) });
    }
    
    // Get database query stats
    const queryStats = optimizedDb.getQueryStats();
    const cacheStats = optimizedDb.getCacheStats();
    
    // Get detailed metrics for charts
    const detailedMetrics = performanceMonitor.getDetailedMetrics(minutes);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      timeWindow: `${minutes} minutes`,
      summary,
      database: {
        connectionPool: poolStats,
        queryStats: queryStats.slice(0, 20), // Top 20 queries
        cache: cacheStats
      },
      metrics: {
        requests: detailedMetrics.metrics.length,
        systemSnapshots: detailedMetrics.systemMetrics.length,
        alerts: detailedMetrics.alerts.length
      },
      charts: {
        responseTime: detailedMetrics.metrics.map(m => ({
          timestamp: m.timestamp,
          value: m.responseTime,
          endpoint: m.endpoint
        })),
        memoryUsage: detailedMetrics.systemMetrics.map(m => ({
          timestamp: m.timestamp,
          heapUsed: m.memory.heapUsed,
          heapTotal: m.memory.heapTotal,
          utilization: m.memory.heapUtilization
        })),
        cpuUsage: detailedMetrics.systemMetrics.map(m => ({
          timestamp: m.timestamp,
          value: m.cpu.utilization
        })),
        eventLoopDelay: detailedMetrics.systemMetrics.map(m => ({
          timestamp: m.timestamp,
          value: m.eventLoop.delay
        })),
        throughput: detailedMetrics.metrics.reduce((acc, m) => {
          const minute = Math.floor(m.timestamp / 60000) * 60000;
          acc[minute] = (acc[minute] || 0) + 1;
          return acc;
        }, {} as Record<number, number>)
      },
      alerts: detailedMetrics.alerts.filter(a => !a.resolved)
    });
  } catch (error) {
    logger.error('Failed to get performance dashboard data', {
      error: String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance data',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * Get real-time performance metrics
 */
router.get('/realtime', asyncHandler(async (req: Request, res: Response) => {
  try {
    const summary = performanceMonitor.getPerformanceSummary(5); // Last 5 minutes
    
    // Get current system metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      current: {
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          utilization: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          rss: memoryUsage.rss,
          external: memoryUsage.external
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          utilization: ((cpuUsage.user + cpuUsage.system) / 1000000) * 100
        },
        uptime: process.uptime(),
        activeHandles: processUtils.getActiveHandleCount(),
        activeRequests: processUtils.getActiveRequestCount()
      },
      recent: {
        requests: summary.requests,
        system: summary.system,
        alerts: summary.alerts
      }
    });
  } catch (error) {
    logger.error('Failed to get real-time performance data', {
      error: String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve real-time data'
    });
  }
}));

/**
 * Get performance alerts
 */
router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const includeResolved = req.query.resolved === 'true';
  
  try {
    const detailedMetrics = performanceMonitor.getDetailedMetrics(60); // Last hour
    let alerts = detailedMetrics.alerts;
    
    if (!includeResolved) {
      alerts = alerts.filter(a => !a.resolved);
    }
    
    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp - a.timestamp);
    
    res.json({
      success: true,
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        unresolved: alerts.filter(a => !a.resolved).length
      }
    });
  } catch (error) {
    logger.error('Failed to get performance alerts', {
      error: String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts'
    });
  }
}));

/**
 * Resolve a performance alert
 */
router.post('/alerts/:alertId/resolve', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { alertId } = req.params;
  
  if (!alertId) {
    res.status(400).json({ error: 'Alert ID is required' });
    return;
  }
  
  try {
    const resolved = performanceMonitor.resolveAlert(alertId);
    
    if (resolved) {
      res.json({
        success: true,
        message: 'Alert resolved successfully',
        alertId
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found or already resolved',
        alertId
      });
    }
  } catch (error) {
    logger.error('Failed to resolve alert', {
      alertId,
      error: String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
}));

/**
 * Get database performance statistics
 */
router.get('/database', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get connection pool information
    let poolInfo = null;
    try {
      const dbPath = process.env.DATABASE_PATH || './refactorforge.db';
      const pool = getConnectionPool(dbPath);
      poolInfo = pool.getPoolInfo();
    } catch (error) {
      logger.warn('Could not get connection pool info', { error: String(error) });
    }
    
    // Get query statistics
    const queryStats = optimizedDb.getQueryStats() || [];
    const cacheStats = optimizedDb.getCacheStats();
    
    // Analyze query patterns
    const slowQueries = queryStats.filter(q => q.isSlow);
    const frequentQueries = queryStats.filter(q => q.isFrequent);
    const queryByType = queryStats.reduce((acc, q) => {
      const type = q.query.split(' ')[0]?.toUpperCase() || 'UNKNOWN';
      acc[type] = (acc[type] || 0) + q.count;
      return acc;
    }, {} as Record<string, number>);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      connectionPool: poolInfo,
      queryStats: {
        total: queryStats.length,
        slow: slowQueries.length,
        frequent: frequentQueries.length,
        byType: queryByType,
        top20: queryStats.slice(0, 20)
      },
      cache: cacheStats,
      recommendations: [
        ...(slowQueries.length > 0 ? [
          {
            type: 'performance',
            severity: 'medium',
            message: `${slowQueries.length} slow queries detected`,
            action: 'Consider adding indexes or optimizing query structure'
          }
        ] : []),
        ...(cacheStats.hitRate < 50 ? [
          {
            type: 'cache',
            severity: 'low',
            message: 'Low cache hit rate',
            action: 'Consider increasing cache TTL or optimizing cache strategy'
          }
        ] : []),
        ...(poolInfo && poolInfo.stats.busyConnections / poolInfo.stats.totalConnections > 0.8 ? [
          {
            type: 'connections',
            severity: 'medium',
            message: 'High connection pool utilization',
            action: 'Consider increasing max connections or optimizing query patterns'
          }
        ] : [])
      ]
    });
  } catch (error) {
    logger.error('Failed to get database performance stats', {
      error: String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database performance data'
    });
  }
}));

/**
 * Get endpoint performance analysis
 */
router.get('/endpoints', asyncHandler(async (req: Request, res: Response) => {
  const minutes = parseInt(req.query.minutes as string) || 60;
  
  try {
    const detailedMetrics = performanceMonitor.getDetailedMetrics(minutes);
    
    // Analyze endpoint performance
    const endpointStats = detailedMetrics.metrics.reduce((acc, m) => {
      const key = `${m.method} ${m.endpoint}`;
      if (!acc[key]) {
        acc[key] = {
          endpoint: m.endpoint,
          method: m.method,
          count: 0,
          totalTime: 0,
          minTime: Infinity,
          maxTime: 0,
          errors: 0,
          statusCodes: {} as Record<number, number>
        };
      }
      
      const stat = acc[key];
      stat.count++;
      stat.totalTime += m.responseTime;
      stat.minTime = Math.min(stat.minTime, m.responseTime);
      stat.maxTime = Math.max(stat.maxTime, m.responseTime);
      
      if (m.statusCode >= 400) {
        stat.errors++;
      }
      
      stat.statusCodes[m.statusCode] = (stat.statusCodes[m.statusCode] || 0) + 1;
      
      return acc;
    }, {} as Record<string, {
      endpoint: string;
      method: string;
      count: number;
      totalTime: number;
      minTime: number;
      maxTime: number;
      errors: number;
      statusCodes: Record<number, number>;
    }>);
    
    // Calculate averages and sort by total time
    const endpoints = Object.values(endpointStats).map((stat) => ({
      ...stat,
      avgTime: stat.totalTime / stat.count,
      errorRate: (stat.errors / stat.count) * 100,
      throughput: stat.count / (minutes / 60) // requests per minute
    })).sort((a, b) => b.totalTime - a.totalTime);
    
    res.json({
      success: true,
      timeWindow: `${minutes} minutes`,
      endpoints: endpoints.slice(0, 50), // Top 50 endpoints
      summary: {
        totalEndpoints: endpoints.length,
        totalRequests: detailedMetrics.metrics.length,
        averageResponseTime: detailedMetrics.metrics.reduce((sum, m) => sum + m.responseTime, 0) / detailedMetrics.metrics.length || 0,
        slowEndpoints: endpoints.filter((e) => e.avgTime > 1000).length,
        errorEndpoints: endpoints.filter((e) => e.errorRate > 5).length
      }
    });
  } catch (error) {
    logger.error('Failed to get endpoint performance analysis', {
      error: String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve endpoint analysis'
    });
  }
}));

/**
 * Clear performance data and caches
 */
router.post('/clear', asyncHandler(async (req: Request, res: Response) => {
  const { clearCache, clearMetrics } = req.body;
  
  try {
    const results = {
      cacheCleared: false,
      metricsCleared: false
    };
    
    if (clearCache) {
      optimizedDb.clearCache();
      results.cacheCleared = true;
      logger.info('Performance cache cleared via API');
    }
    
    // Note: We don't provide an API to clear performance metrics
    // as they are important for monitoring
    
    res.json({
      success: true,
      message: 'Performance data cleared successfully',
      results
    });
  } catch (error) {
    logger.error('Failed to clear performance data', {
      error: String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear performance data'
    });
  }
}));

/**
 * Get system resource usage
 */
router.get('/system', asyncHandler(async (req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      system: {
        nodejs: {
          version: process.version,
          uptime: process.uptime(),
          platform: process.platform,
          arch: process.arch
        },
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          heapUtilization: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          rss: memoryUsage.rss,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers || 0
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          utilization: ((cpuUsage.user + cpuUsage.system) / 1000000) * 100
        },
        handles: {
          active: processUtils.getActiveHandleCount(),
          requests: processUtils.getActiveRequestCount()
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          pid: process.pid
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get system resource data', {
      error: String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system data'
    });
  }
}));

export default router;