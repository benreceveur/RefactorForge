import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { logger } from '../utils/logger';

export interface PerformanceMetrics {
  timestamp: number;
  requestId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  eventLoopDelay: number;
  activeHandles: number;
  activeRequests: number;
  throughput: number;
  errorRate: number;
  userAgent?: string;
  ip?: string;
}

export interface SystemMetrics {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    heapUtilization: number;
  };
  cpu: {
    user: number;
    system: number;
    utilization: number;
  };
  eventLoop: {
    delay: number;
    utilization: number;
  };
  gc: {
    collections: number;
    duration: number;
    type: string;
  }[];
  network: {
    connections: number;
    throughput: number;
  };
  database: {
    connections: number;
    queryTime: number;
    slowQueries: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'memory' | 'cpu' | 'response_time' | 'error_rate' | 'throughput';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
}

export interface PerformanceThresholds {
  responseTime: {
    warning: number;
    critical: number;
  };
  memoryUsage: {
    warning: number;
    critical: number;
  };
  cpuUsage: {
    warning: number;
    critical: number;
  };
  errorRate: {
    warning: number;
    critical: number;
  };
  eventLoopDelay: {
    warning: number;
    critical: number;
  };
  throughput: {
    minimum: number;
  };
}

/**
 * PerformanceMonitor - Comprehensive Application Performance Monitoring System
 * 
 * A sophisticated monitoring system that provides real-time performance tracking,
 * resource utilization analysis, and automated alerting for Node.js applications.
 * 
 * Core Capabilities:
 * - HTTP request performance tracking with detailed metrics
 * - System resource monitoring (CPU, memory, event loop)
 * - Automatic alert generation based on configurable thresholds
 * - Performance data aggregation and historical analysis
 * - Garbage collection monitoring and optimization insights
 * - Network throughput and error rate tracking
 * 
 * Features:
 * - Event-driven architecture for real-time notifications
 * - Configurable alert thresholds for different environments
 * - Automatic data cleanup to prevent memory bloat
 * - Performance baseline establishment and trend analysis
 * - Integration with external monitoring systems
 * 
 * @example
 * ```typescript
 * const monitor = new PerformanceMonitor({
 *   responseTime: { warning: 1000, critical: 5000 },
 *   memoryUsage: { warning: 0.8, critical: 0.9 },
 *   cpuUsage: { warning: 70, critical: 90 }
 * });
 * 
 * monitor.on('performance-alert', (alert) => {
 *   console.log(`Alert: ${alert.message}`);
 *   // Send to external monitoring service
 * });
 * 
 * // Record HTTP request
 * monitor.recordRequest('req_123', '/api/users', 'GET', 200, 245);
 * 
 * // Get performance summary
 * const summary = monitor.getPerformanceSummary(5);
 * console.log(`Average response time: ${summary.requests.averageResponseTime}ms`);
 * ```
 * 
 * @extends EventEmitter
 * @author RefactorForge Team
 * @version 2.1.0
 * @since 1.0.0
 * 
 * @fires PerformanceMonitor#performance-alert - When performance thresholds are exceeded
 * @fires PerformanceMonitor#request-recorded - When a new request is recorded
 * @fires PerformanceMonitor#system-metrics-collected - When system metrics are collected
 * @fires PerformanceMonitor#gc-event - When garbage collection occurs
 * @fires PerformanceMonitor#alert-resolved - When an alert is manually resolved
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private performanceObserver: PerformanceObserver | null = null;
  private gcObserver: PerformanceObserver | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private eventLoopMonitor: any = null;
  private thresholds: PerformanceThresholds;
  private isMonitoring = false;
  private requestCount = 0;
  private errorCount = 0;
  private cpuUsageBaseline: NodeJS.CpuUsage | null = null;

  /**
   * Creates a new PerformanceMonitor instance with configurable thresholds
   * 
   * Initializes the monitoring system with customizable performance thresholds
   * for different metrics. Default thresholds are suitable for most production
   * environments but can be adjusted based on specific application requirements.
   * 
   * @param thresholds - Optional performance threshold configuration
   * @param thresholds.responseTime - HTTP response time thresholds in milliseconds
   * @param thresholds.memoryUsage - Memory utilization thresholds as percentages (0-1)
   * @param thresholds.cpuUsage - CPU utilization thresholds as percentages (0-100)
   * @param thresholds.errorRate - Error rate thresholds as percentages (0-1)
   * @param thresholds.eventLoopDelay - Event loop delay thresholds in milliseconds
   * @param thresholds.throughput - Minimum acceptable throughput in requests/second
   * 
   * @example
   * ```typescript
   * // Production environment with strict thresholds
   * const monitor = new PerformanceMonitor({
   *   responseTime: { warning: 500, critical: 2000 },
   *   memoryUsage: { warning: 0.7, critical: 0.85 },
   *   errorRate: { warning: 0.01, critical: 0.05 }
   * });
   * 
   * // Development environment with relaxed thresholds
   * const devMonitor = new PerformanceMonitor({
   *   responseTime: { warning: 2000, critical: 10000 },
   *   memoryUsage: { warning: 0.9, critical: 0.95 }
   * });
   * ```
   */
  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    super();

    this.thresholds = {
      responseTime: { warning: 1000, critical: 5000 },
      memoryUsage: { warning: 0.8, critical: 0.9 },
      cpuUsage: { warning: 70, critical: 90 },
      errorRate: { warning: 0.05, critical: 0.1 },
      eventLoopDelay: { warning: 10, critical: 50 },
      throughput: { minimum: 10 },
      ...thresholds
    };

    this.initialize();
  }

  /**
   * Initialize performance monitoring
   */
  private initialize(): void {
    logger.info('Initializing performance monitoring system', {
      thresholds: this.thresholds
    });

    // Set up performance observers
    this.setupPerformanceObservers();

    // Set up event loop monitoring
    this.setupEventLoopMonitoring();

    // Start system monitoring
    this.startSystemMonitoring();

    // Set up cleanup intervals
    this.setupCleanupIntervals();

    this.isMonitoring = true;
    logger.info('Performance monitoring system started');
  }

  /**
   * Set up performance observers for HTTP requests and functions
   */
  private setupPerformanceObservers(): void {
    // HTTP request observer
    this.performanceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'measure' && entry.name.startsWith('http_request_')) {
          this.processHttpMeasure(entry);
        }
      });
    });

    this.performanceObserver.observe({ entryTypes: ['measure'] });

    // GC observer
    this.gcObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        this.processGCEntry(entry);
      });
    });

    this.gcObserver.observe({ entryTypes: ['gc'] });
  }

  /**
   * Set up event loop delay monitoring
   */
  private setupEventLoopMonitoring(): void {
    const { monitorEventLoopDelay } = require('perf_hooks');
    this.eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
    this.eventLoopMonitor.enable();
  }

  /**
   * Start system-level monitoring
   */
  private startSystemMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 5000); // Collect every 5 seconds
  }

  /**
   * Set up cleanup intervals for old data
   */
  private setupCleanupIntervals(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 60000); // Cleanup every minute
  }

  /**
   * Records performance metrics for an HTTP request
   * 
   * Captures comprehensive performance data for each HTTP request including
   * response times, system resource utilization, and contextual information.
   * This data is used for real-time monitoring, trend analysis, and alert generation.
   * 
   * The method automatically:
   * - Updates request counters and error rates
   * - Captures memory and CPU usage snapshots
   * - Measures event loop delay at request time
   * - Tracks active handles and requests
   * - Calculates throughput and performance ratios
   * - Triggers alert checking against configured thresholds
   * 
   * @param requestId - Unique identifier for the request (for correlation)
   * @param endpoint - API endpoint path (e.g., '/api/users', '/health')
   * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param statusCode - HTTP response status code
   * @param responseTime - Request processing time in milliseconds
   * @param userAgent - Optional client user agent string for analysis
   * @param ip - Optional client IP address for geographic analysis
   * 
   * @example
   * ```typescript
   * // Basic request recording
   * monitor.recordRequest(
   *   'req_abc123',
   *   '/api/users',
   *   'GET',
   *   200,
   *   157
   * );
   * 
   * // Detailed request recording with client info
   * monitor.recordRequest(
   *   'req_def456',
   *   '/api/orders',
   *   'POST',
   *   201,
   *   423,
   *   'Mozilla/5.0 (compatible; MyApp/1.0)',
   *   '192.168.1.100'
   * );
   * ```
   * 
   * @fires PerformanceMonitor#request-recorded - Emitted after recording
   * @fires PerformanceMonitor#performance-alert - If thresholds are exceeded
   */
  recordRequest(
    requestId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    userAgent?: string,
    ip?: string
  ): void {
    this.requestCount++;
    
    if (statusCode >= 400) {
      this.errorCount++;
    }

    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      requestId,
      endpoint,
      method,
      statusCode,
      responseTime,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(this.cpuUsageBaseline ?? undefined),
      eventLoopDelay: this.eventLoopMonitor ? this.eventLoopMonitor.mean : 0,
      activeHandles: (process as any)._getActiveHandles().length,
      activeRequests: (process as any)._getActiveRequests().length,
      throughput: this.calculateThroughput(),
      errorRate: this.calculateErrorRate(),
      userAgent,
      ip
    };

    this.metrics.push(metric);
    this.emit('request-recorded', metric);

    // Check for performance alerts
    this.checkPerformanceThresholds(metric);

    // Update CPU baseline
    this.cpuUsageBaseline = process.cpuUsage();
  }

  /**
   * Collect system-level metrics
   */
  private collectSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const systemMetric: SystemMetrics = {
      timestamp: Date.now(),
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        heapUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        utilization: this.calculateCPUUtilization(cpuUsage)
      },
      eventLoop: {
        delay: this.eventLoopMonitor ? this.eventLoopMonitor.mean : 0,
        utilization: this.calculateEventLoopUtilization()
      },
      gc: this.getRecentGCMetrics(),
      network: {
        connections: (process as any)._getActiveHandles().length,
        throughput: this.calculateThroughput()
      },
      database: {
        connections: 0, // To be implemented with connection pool
        queryTime: 0,   // To be implemented with query monitoring
        slowQueries: 0  // To be implemented with slow query detection
      }
    };

    this.systemMetrics.push(systemMetric);
    this.emit('system-metrics-collected', systemMetric);

    // Check system-level alerts
    this.checkSystemThresholds(systemMetric);

    // Reset event loop monitor
    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.reset();
    }
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkPerformanceThresholds(metric: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Response time alerts
    if (metric.responseTime > this.thresholds.responseTime.critical) {
      alerts.push(this.createAlert(
        'response_time',
        'critical',
        `Critical response time: ${metric.responseTime}ms`,
        metric.responseTime,
        this.thresholds.responseTime.critical
      ));
    } else if (metric.responseTime > this.thresholds.responseTime.warning) {
      alerts.push(this.createAlert(
        'response_time',
        'high',
        `High response time: ${metric.responseTime}ms`,
        metric.responseTime,
        this.thresholds.responseTime.warning
      ));
    }

    // Memory usage alerts
    const memoryUtilization = metric.memoryUsage.heapUsed / metric.memoryUsage.heapTotal;
    if (memoryUtilization > this.thresholds.memoryUsage.critical) {
      alerts.push(this.createAlert(
        'memory',
        'critical',
        `Critical memory usage: ${(memoryUtilization * 100).toFixed(1)}%`,
        memoryUtilization,
        this.thresholds.memoryUsage.critical
      ));
    } else if (memoryUtilization > this.thresholds.memoryUsage.warning) {
      alerts.push(this.createAlert(
        'memory',
        'high',
        `High memory usage: ${(memoryUtilization * 100).toFixed(1)}%`,
        memoryUtilization,
        this.thresholds.memoryUsage.warning
      ));
    }

    // Error rate alerts
    if (metric.errorRate > this.thresholds.errorRate.critical) {
      alerts.push(this.createAlert(
        'error_rate',
        'critical',
        `Critical error rate: ${(metric.errorRate * 100).toFixed(1)}%`,
        metric.errorRate,
        this.thresholds.errorRate.critical
      ));
    } else if (metric.errorRate > this.thresholds.errorRate.warning) {
      alerts.push(this.createAlert(
        'error_rate',
        'high',
        `High error rate: ${(metric.errorRate * 100).toFixed(1)}%`,
        metric.errorRate,
        this.thresholds.errorRate.warning
      ));
    }

    // Event loop delay alerts
    if (metric.eventLoopDelay > this.thresholds.eventLoopDelay.critical) {
      alerts.push(this.createAlert(
        'response_time',
        'critical',
        `Critical event loop delay: ${metric.eventLoopDelay.toFixed(2)}ms`,
        metric.eventLoopDelay,
        this.thresholds.eventLoopDelay.critical
      ));
    }

    // Process alerts
    for (const alert of alerts) {
      this.processAlert(alert);
    }
  }

  /**
   * Check system-level thresholds
   */
  private checkSystemThresholds(metric: SystemMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // CPU utilization alerts
    if (metric.cpu.utilization > this.thresholds.cpuUsage.critical) {
      alerts.push(this.createAlert(
        'cpu',
        'critical',
        `Critical CPU usage: ${metric.cpu.utilization.toFixed(1)}%`,
        metric.cpu.utilization,
        this.thresholds.cpuUsage.critical
      ));
    } else if (metric.cpu.utilization > this.thresholds.cpuUsage.warning) {
      alerts.push(this.createAlert(
        'cpu',
        'high',
        `High CPU usage: ${metric.cpu.utilization.toFixed(1)}%`,
        metric.cpu.utilization,
        this.thresholds.cpuUsage.warning
      ));
    }

    // Throughput alerts
    if (metric.network.throughput < this.thresholds.throughput.minimum) {
      alerts.push(this.createAlert(
        'throughput',
        'medium',
        `Low throughput: ${metric.network.throughput.toFixed(2)} req/s`,
        metric.network.throughput,
        this.thresholds.throughput.minimum
      ));
    }

    // Process alerts
    for (const alert of alerts) {
      this.processAlert(alert);
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number
  ): PerformanceAlert {
    return {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: Date.now(),
      resolved: false
    };
  }

  /**
   * Process and store alert
   */
  private processAlert(alert: PerformanceAlert): void {
    // Check for duplicate alerts (same type within last 60 seconds)
    const recentAlert = this.alerts.find(a => 
      a.type === alert.type && 
      !a.resolved && 
      (alert.timestamp - a.timestamp) < 60000
    );

    if (recentAlert) {
      // Update existing alert
      recentAlert.value = alert.value;
      recentAlert.timestamp = alert.timestamp;
      recentAlert.message = alert.message;
    } else {
      // Add new alert
      this.alerts.push(alert);
      
      // Emit alert event
      this.emit('performance-alert', alert);
      
      // Log alert
      logger.warn('Performance alert generated', {
        alert: {
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          value: alert.value,
          threshold: alert.threshold
        }
      });
    }
  }

  /**
   * Generates a comprehensive performance summary for the specified time window
   * 
   * Analyzes collected performance data and provides statistical summaries
   * including percentiles, averages, peaks, and alert information. This method
   * is optimized for dashboard displays and API responses.
   * 
   * The summary includes:
   * - Request metrics: totals, error rates, response time statistics
   * - System metrics: resource utilization averages and peaks
   * - Alert metrics: counts by severity and resolution status
   * 
   * @param minutes - Time window in minutes for the summary (default: 5)
   * @returns Comprehensive performance summary object
   * 
   * @example
   * ```typescript
   * // Get last 5 minutes of performance data
   * const summary = monitor.getPerformanceSummary();
   * console.log(`Requests: ${summary.requests.total}`);
   * console.log(`Error rate: ${(summary.requests.errorRate * 100).toFixed(2)}%`);
   * console.log(`P95 response time: ${summary.requests.p95ResponseTime}ms`);
   * 
   * // Get last hour of performance data
   * const hourlySummary = monitor.getPerformanceSummary(60);
   * 
   * // Check for performance issues
   * if (summary.alerts.critical > 0) {
   *   console.log(`⚠️ ${summary.alerts.critical} critical alerts active`);
   * }
   * ```
   */
  getPerformanceSummary(minutes: number = 5): {
    requests: {
      total: number;
      errors: number;
      averageResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
      throughput: number;
      errorRate: number;
    };
    system: {
      averageMemoryUsage: number;
      peakMemoryUsage: number;
      averageCPUUsage: number;
      peakCPUUsage: number;
      averageEventLoopDelay: number;
      maxEventLoopDelay: number;
    };
    alerts: {
      total: number;
      critical: number;
      high: number;
      unresolved: number;
    };
  } {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    const recentSystemMetrics = this.systemMetrics.filter(m => m.timestamp > cutoff);
    const recentAlerts = this.alerts.filter(a => a.timestamp > cutoff);

    // Request metrics
    const responseTimes = recentMetrics.map(m => m.responseTime);
    responseTimes.sort((a, b) => a - b);

    const requests = {
      total: recentMetrics.length,
      errors: recentMetrics.filter(m => m.statusCode >= 400).length,
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0,
      p95ResponseTime: responseTimes.length > 0 
        ? responseTimes[Math.floor(responseTimes.length * 0.95)] || 0
        : 0,
      p99ResponseTime: responseTimes.length > 0 
        ? responseTimes[Math.floor(responseTimes.length * 0.99)] || 0
        : 0,
      throughput: this.calculateThroughput(),
      errorRate: this.calculateErrorRate()
    };

    // System metrics
    const memoryUsages = recentSystemMetrics.map(m => m.memory.heapUtilization);
    const cpuUsages = recentSystemMetrics.map(m => m.cpu.utilization);
    const eventLoopDelays = recentSystemMetrics.map(m => m.eventLoop.delay);

    const system = {
      averageMemoryUsage: memoryUsages.length > 0 
        ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length 
        : 0,
      peakMemoryUsage: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0,
      averageCPUUsage: cpuUsages.length > 0 
        ? cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length 
        : 0,
      peakCPUUsage: cpuUsages.length > 0 ? Math.max(...cpuUsages) : 0,
      averageEventLoopDelay: eventLoopDelays.length > 0 
        ? eventLoopDelays.reduce((a, b) => a + b, 0) / eventLoopDelays.length 
        : 0,
      maxEventLoopDelay: eventLoopDelays.length > 0 ? Math.max(...eventLoopDelays) : 0
    };

    // Alert metrics
    const alerts = {
      total: recentAlerts.length,
      critical: recentAlerts.filter(a => a.severity === 'critical').length,
      high: recentAlerts.filter(a => a.severity === 'high').length,
      unresolved: recentAlerts.filter(a => !a.resolved).length
    };

    return { requests, system, alerts };
  }

  /**
   * Retrieves detailed performance data for advanced analysis and dashboards
   * 
   * Returns raw performance data points for the specified time window,
   * enabling detailed trend analysis, custom visualizations, and
   * advanced performance debugging.
   * 
   * @param minutes - Time window in minutes for detailed data (default: 30)
   * @returns Object containing arrays of detailed metrics
   * 
   * @example
   * ```typescript
   * // Get detailed data for chart visualization
   * const detailed = monitor.getDetailedMetrics(60);
   * 
   * // Extract response times for trend chart
   * const responseTimes = detailed.metrics.map(m => ({
   *   timestamp: m.timestamp,
   *   responseTime: m.responseTime
   * }));
   * 
   * // Extract memory usage for system monitoring
   * const memoryTrend = detailed.systemMetrics.map(m => ({
   *   timestamp: m.timestamp,
   *   usage: m.memory.heapUtilization * 100
   * }));
   * 
   * // Filter active alerts
   * const activeAlerts = detailed.alerts.filter(a => !a.resolved);
   * ```
   */
  getDetailedMetrics(minutes: number = 30): {
    metrics: PerformanceMetrics[];
    systemMetrics: SystemMetrics[];
    alerts: PerformanceAlert[];
  } {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    
    return {
      metrics: this.metrics.filter(m => m.timestamp > cutoff),
      systemMetrics: this.systemMetrics.filter(m => m.timestamp > cutoff),
      alerts: this.alerts.filter(a => a.timestamp > cutoff)
    };
  }

  /**
   * Manually resolves an active performance alert
   * 
   * Marks a specific alert as resolved, which stops it from appearing
   * in active alert lists and dashboard warnings. This is useful when
   * alerts are addressed through external actions or when false positives
   * are identified.
   * 
   * @param alertId - Unique identifier of the alert to resolve
   * @returns True if alert was found and resolved, false otherwise
   * 
   * @example
   * ```typescript
   * // Get current alerts
   * const summary = monitor.getPerformanceSummary();
   * if (summary.alerts.unresolved > 0) {
   *   const detailed = monitor.getDetailedMetrics(5);
   *   const activeAlert = detailed.alerts.find(a => !a.resolved);
   *   
   *   if (activeAlert) {
   *     // Resolve the alert after investigation
   *     const resolved = monitor.resolveAlert(activeAlert.id);
   *     console.log(`Alert resolved: ${resolved}`);
   *   }
   * }
   * ```
   * 
   * @fires PerformanceMonitor#alert-resolved - When alert is successfully resolved
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      this.emit('alert-resolved', alert);
      logger.info('Performance alert resolved', { alertId, type: alert.type });
      return true;
    }
    return false;
  }

  /**
   * Gracefully stops the performance monitoring system and cleans up resources
   * 
   * Properly shuts down all monitoring components including:
   * - Performance observers for HTTP requests and GC events
   * - System monitoring intervals
   * - Event loop delay monitoring
   * - Data cleanup intervals
   * 
   * This method should be called during application shutdown to prevent
   * memory leaks and ensure clean termination.
   * 
   * @example
   * ```typescript
   * // Graceful application shutdown
   * process.on('SIGTERM', () => {
   *   console.log('Shutting down performance monitoring...');
   *   monitor.stop();
   *   
   *   // Continue with other cleanup...
   *   process.exit(0);
   * });
   * 
   * // Manual stop for testing
   * monitor.stop();
   * console.log('Monitoring stopped');
   * ```
   */
  stop(): void {
    if (!this.isMonitoring) return;

    logger.info('Stopping performance monitoring system');

    // Clean up observers
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    if (this.gcObserver) {
      this.gcObserver.disconnect();
      this.gcObserver = null;
    }

    // Clean up intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clean up event loop monitor
    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.disable();
      this.eventLoopMonitor = null;
    }

    this.isMonitoring = false;
    logger.info('Performance monitoring system stopped');
  }

  // Private helper methods

  private processHttpMeasure(entry: any): void {
    // Extract request information from measure name
    const parts = entry.name.split('_');
    if (parts.length >= 3) {
      // const requestId = parts[2];
      // Additional processing can be added here
    }
  }

  private processGCEntry(entry: any): void {
    // Process garbage collection entries
    this.emit('gc-event', {
      kind: (entry as any).kind,
      duration: entry.duration,
      timestamp: entry.startTime + performance.timeOrigin
    });
  }

  private calculateThroughput(): number {
    const timeWindow = 60000; // 1 minute
    const cutoff = Date.now() - timeWindow;
    const recentRequests = this.metrics.filter(m => m.timestamp > cutoff);
    return recentRequests.length / (timeWindow / 1000);
  }

  private calculateErrorRate(): number {
    if (this.requestCount === 0) return 0;
    return this.errorCount / this.requestCount;
  }

  private calculateCPUUtilization(cpuUsage: NodeJS.CpuUsage): number {
    // Simplified CPU utilization calculation
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    return (totalCpuTime / 1000000) * 100; // Convert to percentage
  }

  private calculateEventLoopUtilization(): number {
    // Event loop utilization calculation
    if (this.eventLoopMonitor) {
      const delay = this.eventLoopMonitor.mean;
      return Math.min(100, (delay / 16.67) * 100); // 16.67ms = 60fps target
    }
    return 0;
  }

  private getRecentGCMetrics(): SystemMetrics['gc'] {
    // Return recent GC metrics (simplified)
    return [];
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // Keep 24 hours
    
    // Cleanup old metrics
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    this.systemMetrics = this.systemMetrics.filter(m => m.timestamp > cutoff);
    
    // Cleanup resolved alerts older than 1 hour
    const alertCutoff = Date.now() - (60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => 
      !a.resolved || a.timestamp > alertCutoff
    );

    logger.debug('Cleaned up old performance data', {
      metricsCount: this.metrics.length,
      systemMetricsCount: this.systemMetrics.length,
      alertsCount: this.alerts.length
    });
  }
}

// Export singleton instance
let monitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(thresholds?: Partial<PerformanceThresholds>): PerformanceMonitor {
  if (!monitorInstance) {
    monitorInstance = new PerformanceMonitor(thresholds);
  }
  return monitorInstance;
}

export function stopPerformanceMonitoring(): void {
  if (monitorInstance) {
    monitorInstance.stop();
    monitorInstance = null;
  }
}