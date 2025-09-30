/**
 * Security Middleware
 * Provides rate limiting, content validation, and JSON error handling
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Store for rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware
 * Limits requests per IP address
 */
export function rateLimiter(options: {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
} = {}) {
  const {
    windowMs = 60000, // 1 minute default
    maxRequests = process.env.NODE_ENV === 'test' ? 50 : 100, // Lower limit for tests
    message = 'Too many requests, please try again later'
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create rate limit entry for this IP
    let entry = rateLimitStore.get(ip);

    if (!entry || entry.resetTime < now) {
      // Create new window
      entry = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(ip, entry);
    } else {
      // Increment count in current window
      entry.count++;
    }

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip,
        count: entry.count,
        limit: maxRequests
      });

      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

    next();
  };
}

/**
 * JSON error handler middleware
 * Handles malformed JSON in request bodies
 */
export function jsonErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof SyntaxError && 'body' in err && err.message.includes('JSON')) {
    logger.warn('Malformed JSON in request', {
      ip: req.ip,
      path: req.path,
      error: err.message
    });

    return res.status(400).json({
      error: 'Invalid JSON format in request body',
      details: 'Please ensure your request contains valid JSON'
    });
  }

  // Pass to next error handler if not JSON error
  next(err);
}

/**
 * Content type validation middleware
 * Ensures proper content type for JSON endpoints
 */
export function validateContentType(req: Request, res: Response, next: NextFunction) {
  // Skip validation for GET, DELETE, HEAD, OPTIONS
  if (['GET', 'DELETE', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const contentType = req.get('Content-Type');

  // Check if content type is present and valid for JSON endpoints
  if (req.path.startsWith('/api/') && req.method !== 'GET') {
    if (!contentType) {
      return res.status(400).json({
        error: 'Content-Type header is required'
      });
    }

    // Accept both application/json and multipart/form-data (for file uploads)
    if (!contentType.includes('application/json') &&
        !contentType.includes('multipart/form-data') &&
        !contentType.includes('application/x-www-form-urlencoded')) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        details: 'Content-Type must be application/json, multipart/form-data, or application/x-www-form-urlencoded'
      });
    }
  }

  next();
}

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(ip);
    }
  }
}, 60000); // Clean up every minute