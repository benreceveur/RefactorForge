/**
 * Global Error Handling Middleware
 * Centralized error handling with security-first approach
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../errors/AppError';
import { logger } from '../utils/logger';

export interface RequestWithId extends Request {
  id?: string;
  startTime?: number;
}

/**
 * Global error handling middleware
 * Handles all errors thrown in the application
 */
export function globalErrorHandler(
  error: Error | AppError,
  req: RequestWithId,
  res: Response,
  _next: NextFunction
): void {
  // Calculate request duration if available
  const duration = req.startTime ? Date.now() - req.startTime : undefined;
  
  // Create correlation ID if not exists
  const correlationId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  let appError: AppError;

  // Convert unknown errors to AppError
  if (error instanceof AppError) {
    appError = error;
  } else {
    appError = convertToAppError(error, req);
  }

  // Enhance context with request information
  if (appError.context) {
    appError.context.requestId = correlationId;
    appError.context.metadata = {
      ...appError.context.metadata,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      duration
    };
  }

  // Log the error
  logError(appError, req);

  // Send client response
  const clientResponse = appError.toClientSafe();
  
  // Add request correlation ID to response
  res.set('X-Correlation-ID', correlationId);
  
  // Set appropriate cache headers for error responses
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  res.status(appError.statusCode).json(clientResponse);
}

/**
 * Convert unknown errors to AppError instances
 */
function convertToAppError(error: Error, req: Request): AppError {
  const context = {
    operation: `${req.method} ${req.path}`,
    resource: extractResourceFromPath(req.path)
  };

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return new AppError(
      error.message,
      ErrorCode.VALIDATION_ERROR,
      400,
      true,
      context
    );
  }

  if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    return new AppError(
      'Invalid JSON in request body',
      ErrorCode.BAD_REQUEST,
      400,
      true,
      context
    );
  }

  if (error.name === 'TimeoutError') {
    return new AppError(
      'Request timeout',
      ErrorCode.SERVICE_TIMEOUT,
      408,
      true,
      context
    );
  }

  // Handle database errors
  if (isDatabaseError(error)) {
    return new AppError(
      'Database operation failed',
      ErrorCode.DATABASE_QUERY_ERROR,
      500,
      true,
      context
    );
  }

  // Handle GitHub API errors
  if (isGitHubError(error)) {
    return convertGitHubError(error, context);
  }

  // Default to internal server error
  return new AppError(
    process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    ErrorCode.INTERNAL_SERVER_ERROR,
    500,
    false, // Non-operational for unknown errors
    context
  );
}

/**
 * Check if error is from database operations
 */
function isDatabaseError(error: Error): boolean {
  const dbErrorIndicators = [
    'SQLITE_',
    'database',
    'connection',
    'constraint',
    'foreign key',
    'unique constraint'
  ];
  
  return dbErrorIndicators.some(indicator => 
    error.message.toLowerCase().includes(indicator.toLowerCase())
  );
}

/**
 * Check if error is from GitHub API
 */
function isGitHubError(error: Error): boolean {
  return error.message.includes('GitHub') || 
         error.message.includes('Octokit') ||
         error.name === 'HttpError';
}

/**
 * Convert GitHub-specific errors to AppError
 */
function convertGitHubError(error: Error, context: Record<string, unknown>): AppError {
  const message = error.message.toLowerCase();
  
  if (message.includes('rate limit')) {
    return new AppError(
      'GitHub API rate limit exceeded',
      ErrorCode.GITHUB_RATE_LIMIT_ERROR,
      429,
      true,
      context
    );
  }
  
  if (message.includes('unauthorized') || message.includes('authentication')) {
    return new AppError(
      'GitHub authentication failed',
      ErrorCode.GITHUB_AUTHENTICATION_ERROR,
      401,
      true,
      context
    );
  }
  
  if (message.includes('forbidden')) {
    return new AppError(
      'GitHub repository access denied',
      ErrorCode.GITHUB_REPOSITORY_ACCESS_ERROR,
      403,
      true,
      context
    );
  }
  
  return new AppError(
    'GitHub API error',
    ErrorCode.GITHUB_API_ERROR,
    502,
    true,
    context
  );
}

/**
 * Extract resource name from request path
 */
function extractResourceFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length >= 2 && segments[0] === 'api') {
    return segments[1] ?? 'unknown';
  }
  return segments[0] ?? 'unknown';
}

/**
 * Log error with appropriate level and context
 */
function logError(error: AppError, req: Request): void {
  const logContext = {
    ...error.toLogObject(),
    request: {
      method: req.method,
      url: req.url,
      headers: sanitizeHeaders(req.headers),
      body: sanitizeRequestBody(req.body),
      params: req.params,
      query: req.query,
      ip: req.ip
    }
  };

  // Log based on error severity
  if (error.statusCode >= 500) {
    logger.error('Server error occurred', logContext);
  } else if (error.statusCode >= 400) {
    logger.warn('Client error occurred', logContext);
  } else {
    logger.info('Error handled', logContext);
  }

  // Additional logging for critical errors
  if (error.code === ErrorCode.SECURITY_VIOLATION || 
      error.code === ErrorCode.SUSPICIOUS_ACTIVITY) {
    logger.error('SECURITY ALERT', {
      ...logContext,
      alert: true,
      severity: 'critical'
    });
  }
}

/**
 * Sanitize request headers to remove sensitive information
 */
function sanitizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, unknown> {
  const sanitized = { ...headers };
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'x-github-token'
  ];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || body === null) {
    return body;
  }
  
  // Type guard to ensure we have a record-like object
  if (!(body instanceof Object) || Array.isArray(body)) {
    return body;
  }
  
  const sanitized = { ...body as Record<string, unknown> };
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'credential',
    'github_token'
  ] as const;
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Async error wrapper for route handlers
 */
export function asyncErrorHandler<T extends readonly unknown[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Re-throw to be caught by global error handler
      throw error;
    }
  };
}

/**
 * Express async wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle unhandled promise rejections
 */
export function setupGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString()
    });
    
    // In production, gracefully shutdown
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Exit immediately for uncaught exceptions
    process.exit(1);
  });
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs: number = 30000) {
  return (req: RequestWithId, res: Response, next: NextFunction): void => {
    // Set request timeout
    const timeout = setTimeout(() => {
      const error = new AppError(
        `Request timeout after ${timeoutMs}ms`,
        ErrorCode.SERVICE_TIMEOUT,
        408,
        true,
        {
          operation: `${req.method} ${req.path}`,
          requestId: req.id
        }
      );
      
      next(error);
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

/**
 * Request ID and timing middleware
 */
export function requestTracking(req: RequestWithId, res: Response, next: NextFunction): void {
  // Generate unique request ID
  req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.startTime = Date.now();
  
  // Add request ID to response headers
  res.set('X-Request-ID', req.id);
  
  next();
}