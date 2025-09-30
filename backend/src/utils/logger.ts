/**
 * Centralized Logging Utility
 * Structured logging with security-first approach
 */

export interface LogContext {
  [key: string]: unknown;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  correlationId?: string;
  component?: string;
}

class Logger {
  private isProduction: boolean;
  private logLevel: LogLevel;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    switch (level) {
      case 'debug': return LogLevel.DEBUG;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    component?: string
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context ? this.sanitizeContext(context) : undefined,
      correlationId: context?.correlationId as string || undefined,
      component
    };
  }

  private sanitizeContext(context: LogContext): LogContext {
    const sanitized: LogContext = {};
    
    Object.keys(context).forEach(key => {
      const value = context[key];
      
      // Remove sensitive information
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeNestedObject(value);
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  }

  private sanitizeNestedObject(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map(item => 
        typeof item === 'object' && item !== null 
          ? this.sanitizeNestedObject(item) 
          : item
      );
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: Record<string, unknown> = {};
      Object.keys(obj).forEach(key => {
        const value = (obj as Record<string, unknown>)[key];
        if (this.isSensitiveKey(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = value;
        }
      });
      return sanitized;
    }
    
    return obj;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i,
      /credential/i,
      /github_token/i,
      /bearer/i,
      /authorization/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(key));
  }

  private formatForConsole(entry: LogEntry): string {
    const emoji = this.getLogEmoji(entry.level);
    const timestamp = entry.timestamp;
    const component = entry.component ? `[${entry.component}]` : '';
    const correlationId = entry.correlationId ? `(${entry.correlationId})` : '';
    
    let output = `${emoji} ${timestamp} ${component}${correlationId} ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      if (this.isProduction) {
        // In production, output JSON for log aggregation
        output += `\n${JSON.stringify(entry.context, null, 2)}`;
      } else {
        // In development, pretty print context
        output += `\nContext: ${JSON.stringify(entry.context, null, 2)}`;
      }
    }
    
    return output;
  }

  private getLogEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return '🚨';
      case LogLevel.WARN: return '⚠️ ';
      case LogLevel.INFO: return 'ℹ️ ';
      case LogLevel.DEBUG: return '🔍';
      default: return '📝';
    }
  }

  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    if (this.isProduction) {
      // Structured JSON output for production log aggregation
      console.log(JSON.stringify(entry));
    } else {
      // Human-readable format for development
      const formatted = this.formatForConsole(entry);
      
      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        case LogLevel.DEBUG:
          console.debug(formatted);
          break;
        default:
          console.log(formatted);
      }
    }
  }

  error(message: string, context?: LogContext, component?: string): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, component);
    this.output(entry);
  }

  warn(message: string, context?: LogContext, component?: string): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, context, component);
    this.output(entry);
  }

  info(message: string, context?: LogContext, component?: string): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, context, component);
    this.output(entry);
  }

  debug(message: string, context?: LogContext, component?: string): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context, component);
    this.output(entry);
  }

  /**
   * Log with custom level and additional metadata
   */
  log(level: LogLevel, message: string, context?: LogContext, component?: string): void {
    const entry = this.createLogEntry(level, message, context, component);
    this.output(entry);
  }

  /**
   * Create a child logger with component context
   */
  child(component: string, additionalContext?: LogContext): Logger {
    const childLogger = new Logger();
    
    // Override output to include component and additional context
    const originalOutput = childLogger.output.bind(childLogger);
    childLogger.output = (entry: LogEntry) => {
      entry.component = component;
      if (additionalContext) {
        entry.context = {
          ...additionalContext,
          ...entry.context
        };
      }
      originalOutput(entry);
    };
    
    return childLogger;
  }

  /**
   * Performance logging helper
   */
  performance(operation: string, startTime: number, context?: LogContext): void {
    const duration = Date.now() - startTime;
    this.info(`Performance: ${operation} completed`, {
      ...context,
      operation,
      duration,
      durationMs: `${duration}ms`
    }, 'PERFORMANCE');
  }

  /**
   * Audit logging for security-sensitive operations
   */
  audit(operation: string, context?: LogContext): void {
    this.info(`Audit: ${operation}`, {
      ...context,
      audit: true,
      operation
    }, 'AUDIT');
  }

  /**
   * Database operation logging
   */
  database(operation: string, query?: string, context?: LogContext): void {
    this.debug(`Database: ${operation}`, {
      ...context,
      operation,
      query: query ? this.sanitizeQuery(query) : undefined
    }, 'DATABASE');
  }

  /**
   * GitHub API operation logging
   */
  github(operation: string, endpoint?: string, context?: LogContext): void {
    this.debug(`GitHub API: ${operation}`, {
      ...context,
      operation,
      endpoint
    }, 'GITHUB');
  }

  private sanitizeQuery(query: string): string {
    // Remove potentially sensitive values from SQL queries
    return query.replace(/'[^']*'/g, "'[REDACTED]'")
                .replace(/"[^"]*"/g, '"[REDACTED]"');
  }
}

// Export singleton instance
export const logger = new Logger();

// Export factory for child loggers
export const createLogger = (component: string, context?: LogContext): Logger => {
  return logger.child(component, context);
};