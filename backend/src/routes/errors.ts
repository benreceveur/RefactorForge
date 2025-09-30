/**
 * Error Reporting Routes
 * Endpoints for client-side error reporting and monitoring
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError, ErrorCode, ValidationError } from '../errors/AppError';
import { logger } from '../utils/logger';
import { dbRun, dbAll, dbGet } from '../utils/database-helpers';

const router = Router();

// Helper function to save error reports to database
async function reportError(report: ClientErrorReport): Promise<void> {
  try {
    await dbRun(
      'INSERT OR REPLACE INTO error_reports (id, message, stack, level, timestamp, url, user_agent, user_id, session_id, component, error_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        report.errorId || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        report.message,
        report.stack || null,
        report.level || 'page',
        report.timestamp,
        report.url,
        report.userAgent,
        report.userId || null,
        report.sessionId || null,
        report.component || null,
        JSON.stringify({
          name: report.name,
          props: report.props,
          state: report.state,
          context: report.context
        })
      ]
    );
    
    logger.info('Error report saved to database', { 
      errorId: report.errorId,
      level: report.level,
      url: report.url,
      component: report.component
    });
  } catch (error) {
    logger.error('Failed to save error report to database', { 
      error: String(error), 
      report: report.errorId 
    });
  }
}

interface ClientErrorReport {
  errorId?: string;
  message: string;
  stack?: string;
  name?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  level?: 'component' | 'page' | 'critical';
  component?: string;
  props?: Record<string, unknown>;
  state?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

interface ErrorReportRow {
  id: string;
  error_id: string;
  message: string;
  stack: string | null;
  name: string;
  timestamp: string;
  user_agent: string;
  url: string;
  user_id: string | null;
  session_id: string | null;
  level: string;
  component: string | null;
  context: string;
  created_at: string;
}

/**
 * Report client-side error
 */
router.post('/report', asyncHandler(async (req: Request, res: Response) => {
  const report = req.body as ClientErrorReport;
  
  // Validate required fields
  if (!report.message || !report.timestamp || !report.url) {
    throw new ValidationError('Missing required fields: message, timestamp, url');
  }

  // Generate error ID if not provided
  const errorId = report.errorId || `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Sanitize and prepare data for storage
  const sanitizedReport = {
    errorId,
    message: report.message.substring(0, 1000), // Limit message length
    stack: report.stack?.substring(0, 5000) || null, // Limit stack trace length
    name: report.name || 'ClientError',
    timestamp: report.timestamp,
    userAgent: report.userAgent?.substring(0, 500) || '',
    url: report.url.substring(0, 500),
    userId: report.userId || null,
    sessionId: report.sessionId || null,
    level: report.level || 'component',
    component: report.component || null,
    context: JSON.stringify({
      props: report.props ? sanitizeObject(report.props) : undefined,
      state: report.state ? sanitizeObject(report.state) : undefined,
      context: report.context ? sanitizeObject(report.context) : undefined
    })
  };

  try {
    // Store error report in database
    await dbRun(`
      INSERT INTO client_error_reports (
        id, error_id, message, stack, name, timestamp, 
        user_agent, url, user_id, session_id, level, 
        component, context, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `report_${Date.now()}`,
      sanitizedReport.errorId,
      sanitizedReport.message,
      sanitizedReport.stack,
      sanitizedReport.name,
      sanitizedReport.timestamp,
      sanitizedReport.userAgent,
      sanitizedReport.url,
      sanitizedReport.userId,
      sanitizedReport.sessionId,
      sanitizedReport.level,
      sanitizedReport.component,
      sanitizedReport.context,
      new Date().toISOString()
    ]);

    // Log the error for immediate visibility
    const logLevel = sanitizedReport.level === 'critical' ? 'error' : 
                     sanitizedReport.level === 'page' ? 'warn' : 'info';
    
    logger[logLevel]('Client error reported', {
      errorId: sanitizedReport.errorId,
      message: sanitizedReport.message,
      level: sanitizedReport.level,
      component: sanitizedReport.component,
      url: sanitizedReport.url,
      userId: sanitizedReport.userId,
      sessionId: sanitizedReport.sessionId,
      userAgent: sanitizedReport.userAgent.substring(0, 100),
      hasStack: !!sanitizedReport.stack
    });

    res.json({
      success: true,
      errorId: sanitizedReport.errorId,
      message: 'Error report received',
      timestamp: new Date().toISOString()
    });

  } catch (dbError) {
    logger.error('Failed to store client error report', {
      error: dbError instanceof Error ? dbError.message : String(dbError),
      reportErrorId: sanitizedReport.errorId
    });

    // Still return success to client to avoid double reporting
    res.json({
      success: true,
      errorId: sanitizedReport.errorId,
      message: 'Error report received (logged only)',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * Report critical client-side error (high priority)
 */
router.post('/critical', asyncHandler(async (req: Request, res: Response) => {
  const report = req.body as ClientErrorReport;
  report.level = 'critical';
  
  // Forward to main report endpoint
  req.body = report;
  
  // Also send immediate notification/alert for critical errors
  logger.error('CRITICAL CLIENT ERROR', {
    errorId: report.errorId,
    message: report.message,
    url: report.url,
    component: report.component,
    userId: report.userId,
    sessionId: report.sessionId,
    alert: true,
    severity: 'critical'
  });

  // Continue with normal error reporting
  res.status(200).json({ 
    success: true, 
    message: 'Critical error reported' 
  });
}));

/**
 * Report API error (from client-side API calls)
 */
router.post('/api', asyncHandler(async (req: Request, res: Response) => {
  const report = req.body as ClientErrorReport & {
    api?: {
      endpoint: string;
      method: string;
      statusCode?: number;
      responseTime?: number;
    };
  };

  // Enhanced logging for API errors
  logger.warn('Client API error reported', {
    errorId: report.errorId,
    message: report.message,
    api: report.api,
    url: report.url,
    userId: report.userId,
    sessionId: report.sessionId
  });

  // Add API context to the report
  if (report.api) {
    report.context = {
      ...report.context,
      api: report.api
    };
  }

  // Report API error
  await reportError(report);
  
  res.status(200).json({ 
    success: true, 
    message: 'API error reported' 
  });
}));

/**
 * Get error statistics (for monitoring dashboard)
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const timeframe = req.query.timeframe as string || '24h';
  
  let timeframeHours: number;
  switch (timeframe) {
    case '1h': timeframeHours = 1; break;
    case '6h': timeframeHours = 6; break;
    case '24h': timeframeHours = 24; break;
    case '7d': timeframeHours = 168; break;
    case '30d': timeframeHours = 720; break;
    default: timeframeHours = 24;
  }

  const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();

  try {
    // Get error counts by level
    const errorsByLevel = await dbAll<{ level: string; count: number }>(`
      SELECT level, COUNT(*) as count
      FROM client_error_reports 
      WHERE created_at > ?
      GROUP BY level
      ORDER BY count DESC
    `, [cutoffTime]);

    // Get error counts by component
    const errorsByComponent = await dbAll<{ component: string; count: number }>(`
      SELECT COALESCE(component, 'unknown') as component, COUNT(*) as count
      FROM client_error_reports 
      WHERE created_at > ?
      GROUP BY component
      ORDER BY count DESC
      LIMIT 10
    `, [cutoffTime]);

    // Get recent errors
    const recentErrors = await dbAll<ErrorReportRow>(`
      SELECT id, error_id, message, name, timestamp, level, component, url
      FROM client_error_reports 
      WHERE created_at > ?
      ORDER BY created_at DESC
      LIMIT 20
    `, [cutoffTime]);

    // Get total error count
    const totalErrors = await dbGet<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM client_error_reports 
      WHERE created_at > ?
    `, [cutoffTime]);

    res.json({
      success: true,
      timeframe,
      stats: {
        total: totalErrors?.count || 0,
        byLevel: errorsByLevel,
        byComponent: errorsByComponent,
        recent: recentErrors.map(error => ({
          id: error.error_id,
          message: error.message,
          name: error.name,
          timestamp: error.timestamp,
          level: error.level,
          component: error.component,
          url: error.url
        }))
      }
    });

  } catch (error) {
    throw new AppError(
      'Failed to retrieve error statistics',
      ErrorCode.DATABASE_QUERY_ERROR,
      500,
      true,
      { operation: 'get_error_stats', timeframe }
    );
  }
}));

/**
 * Get detailed error report
 */
router.get('/report/:errorId', asyncHandler(async (req: Request, res: Response) => {
  const { errorId } = req.params;
  
  if (!errorId) {
    throw new ValidationError('Error ID is required');
  }

  const errorReport = await dbGet<ErrorReportRow>(`
    SELECT * FROM client_error_reports WHERE error_id = ?
  `, [errorId]);

  if (!errorReport) {
    throw new AppError(
      'Error report not found',
      ErrorCode.RESOURCE_NOT_FOUND,
      404,
      true,
      { resource: 'error_report', identifier: errorId }
    );
  }

  // Parse context JSON
  let context;
  try {
    context = JSON.parse(errorReport.context);
  } catch {
    context = {};
  }

  res.json({
    success: true,
    report: {
      id: errorReport.error_id,
      message: errorReport.message,
      stack: errorReport.stack,
      name: errorReport.name,
      timestamp: errorReport.timestamp,
      userAgent: errorReport.user_agent,
      url: errorReport.url,
      userId: errorReport.user_id,
      sessionId: errorReport.session_id,
      level: errorReport.level,
      component: errorReport.component,
      context,
      createdAt: errorReport.created_at
    }
  });
}));

/**
 * Sanitize object to remove sensitive information
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  Object.keys(obj).forEach(key => {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (Array.isArray(obj[key])) {
        sanitized[key] = (obj[key] as unknown[]).map(item => 
          typeof item === 'object' && item !== null 
            ? sanitizeObject(item as Record<string, unknown>)
            : item
        );
      } else {
        sanitized[key] = sanitizeObject(obj[key] as Record<string, unknown>);
      }
    } else {
      sanitized[key] = obj[key];
    }
  });
  
  return sanitized;
}

function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /auth/i,
    /credential/i,
    /github_token/i
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(key));
}

export default router;