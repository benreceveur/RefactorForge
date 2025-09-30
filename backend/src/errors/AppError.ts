/**
 * Application Error Classes
 * Comprehensive error handling with proper categorization and security
 */

export enum ErrorCode {
  // General Application Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Database Errors
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR = 'DATABASE_QUERY_ERROR',
  DATABASE_CONSTRAINT_ERROR = 'DATABASE_CONSTRAINT_ERROR',
  DATABASE_TRANSACTION_ERROR = 'DATABASE_TRANSACTION_ERROR',

  // GitHub API Errors
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',
  GITHUB_RATE_LIMIT_ERROR = 'GITHUB_RATE_LIMIT_ERROR',
  GITHUB_AUTHENTICATION_ERROR = 'GITHUB_AUTHENTICATION_ERROR',
  GITHUB_WEBHOOK_ERROR = 'GITHUB_WEBHOOK_ERROR',
  GITHUB_REPOSITORY_ACCESS_ERROR = 'GITHUB_REPOSITORY_ACCESS_ERROR',

  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SCHEMA_VALIDATION_ERROR = 'SCHEMA_VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Business Logic Errors
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',

  // External Service Errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_TIMEOUT = 'SERVICE_TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Security Errors
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',

  // Processing Errors
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',
  STREAM_PROCESSING_ERROR = 'STREAM_PROCESSING_ERROR'
}

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  resource?: string;
  operation?: string;
  timeframe?: string;
  identifier?: string;
  repository?: string;
  error?: string;
  chunkIndex?: number;
  filePath?: string;
  chunk?: number;
  batchIndex?: number;
  batchSize?: number;
  metadata?: Record<string, unknown>;
}

export interface ErrorDetails {
  field?: string;
  constraint?: string;
  value?: unknown;
  expected?: unknown;
  received?: unknown;
}

/**
 * Base Application Error class with comprehensive error handling
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: ErrorContext;
  public readonly details?: ErrorDetails | ErrorDetails[];
  public readonly timestamp: Date;
  public readonly correlationId: string;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    isOperational = true,
    context?: ErrorContext,
    details?: ErrorDetails | ErrorDetails[]
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.details = details;
    this.timestamp = new Date();
    this.correlationId = this.generateCorrelationId();

    Error.captureStackTrace(this, this.constructor);
  }

  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert error to a safe object for client response
   */
  toClientSafe(): Record<string, unknown> {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const clientSafe: Record<string, unknown> = {
      error: true,
      code: this.code,
      message: isProduction ? this.getProductionMessage() : this.message,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId
    };

    // Add details only in development or for operational errors
    if (!isProduction || this.isOperational) {
      if (this.details) {
        clientSafe.details = this.sanitizeDetails(this.details);
      }
    }

    return clientSafe;
  }

  /**
   * Get sanitized error details safe for client
   */
  private sanitizeDetails(details: ErrorDetails | ErrorDetails[]): ErrorDetails | ErrorDetails[] {
    if (Array.isArray(details)) {
      return details.map(detail => this.sanitizeSingleDetail(detail));
    }
    return this.sanitizeSingleDetail(details);
  }

  private sanitizeSingleDetail(detail: ErrorDetails): ErrorDetails {
    const sanitized: ErrorDetails = {};
    
    if (detail.field) sanitized.field = detail.field;
    if (detail.constraint) sanitized.constraint = detail.constraint;
    if (detail.expected) sanitized.expected = detail.expected;
    
    // Only include received value if it's not sensitive
    if (detail.received && !this.isSensitiveValue(detail.received)) {
      sanitized.received = detail.received;
    }
    
    return sanitized;
  }

  private isSensitiveValue(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i,
      /credential/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(String(value)));
  }

  /**
   * Get production-safe error message
   */
  private getProductionMessage(): string {
    switch (this.code) {
      case ErrorCode.INTERNAL_SERVER_ERROR:
        return 'An unexpected error occurred. Please try again later.';
      case ErrorCode.DATABASE_CONNECTION_ERROR:
      case ErrorCode.DATABASE_QUERY_ERROR:
        return 'Database service is temporarily unavailable. Please try again later.';
      case ErrorCode.GITHUB_API_ERROR:
      case ErrorCode.GITHUB_RATE_LIMIT_ERROR:
        return 'GitHub service is temporarily unavailable. Please try again later.';
      case ErrorCode.SERVICE_TIMEOUT:
        return 'The request took too long to process. Please try again.';
      default:
        return this.message;
    }
  }

  /**
   * Convert error to detailed object for logging
   */
  toLogObject(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      context: this.context,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      stack: this.stack
    };
  }
}

/**
 * Validation Error for input validation failures
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    details?: ErrorDetails | ErrorDetails[],
    context?: ErrorContext
  ) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, true, context, details);
  }

  static missingField(field: string, context?: ErrorContext): ValidationError {
    return new ValidationError(
      `Missing required field: ${field}`,
      { field, constraint: 'required' },
      context
    );
  }

  static invalidFormat(field: string, expected: string, received: unknown, context?: ErrorContext): ValidationError {
    return new ValidationError(
      `Invalid format for field: ${field}`,
      { field, constraint: 'format', expected, received },
      context
    );
  }
}

/**
 * Database Error for database operation failures
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.DATABASE_QUERY_ERROR,
    details?: ErrorDetails,
    context?: ErrorContext
  ) {
    super(message, code, 500, true, context, details);
  }

  static connectionError(_originalError: Error, context?: ErrorContext): DatabaseError {
    return new DatabaseError(
      'Database connection failed',
      ErrorCode.DATABASE_CONNECTION_ERROR,
      { constraint: 'connection' },
      context
    );
  }

  static constraintError(constraint: string, context?: ErrorContext): DatabaseError {
    return new DatabaseError(
      `Database constraint violation: ${constraint}`,
      ErrorCode.DATABASE_CONSTRAINT_ERROR,
      { constraint },
      context
    );
  }
}

/**
 * GitHub API Error for GitHub integration failures
 */
export class GitHubError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.GITHUB_API_ERROR,
    statusCode = 502,
    details?: ErrorDetails,
    context?: ErrorContext
  ) {
    super(message, code, statusCode, true, context, details);
  }

  static rateLimitExceeded(resetTime: Date, context?: ErrorContext): GitHubError {
    return new GitHubError(
      'GitHub API rate limit exceeded',
      ErrorCode.GITHUB_RATE_LIMIT_ERROR,
      429,
      { expected: 'rate limit available', received: 'rate limit exceeded' },
      { ...context, metadata: { resetTime: resetTime.toISOString() } }
    );
  }

  static authenticationError(context?: ErrorContext): GitHubError {
    return new GitHubError(
      'GitHub authentication failed',
      ErrorCode.GITHUB_AUTHENTICATION_ERROR,
      401,
      { constraint: 'authentication' },
      context
    );
  }
}

/**
 * Resource Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string, context?: ErrorContext) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
      
    super(message, ErrorCode.RESOURCE_NOT_FOUND, 404, true, context, {
      field: 'id',
      constraint: 'exists',
      received: identifier
    });
  }
}

/**
 * Service Timeout Error
 */
export class TimeoutError extends AppError {
  constructor(
    service: string, 
    timeoutMs: number, 
    context?: ErrorContext
  ) {
    super(
      `${service} operation timed out after ${timeoutMs}ms`,
      ErrorCode.SERVICE_TIMEOUT,
      408,
      true,
      context,
      { 
        constraint: 'timeout',
        expected: `response within ${timeoutMs}ms`,
        received: 'timeout'
      }
    );
  }
}

/**
 * External Service Error
 */
export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    _originalError: Error,
    context?: ErrorContext
  ) {
    super(
      `External service error: ${service}`,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      502,
      true,
      context,
      { constraint: 'external_service', field: service }
    );
  }
}

/**
 * Security Error for security violations
 */
export class SecurityError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.SECURITY_VIOLATION,
    statusCode = 403,
    context?: ErrorContext
  ) {
    super(message, code, statusCode, true, context);
  }

  static suspiciousActivity(activity: string, context?: ErrorContext): SecurityError {
    return new SecurityError(
      'Suspicious activity detected',
      ErrorCode.SUSPICIOUS_ACTIVITY,
      403,
      { ...context, metadata: { activity } }
    );
  }
}