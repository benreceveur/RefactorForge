/**
 * GitHub API Error Handling Utilities
 * Comprehensive error handling for GitHub integrations with retry logic and circuit breaker
 */

import { GitHubError, ErrorCode, TimeoutError, ExternalServiceError } from '../errors/AppError';
import { logger } from './logger';

export interface GitHubRetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

const DEFAULT_RETRY_OPTIONS: GitHubRetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2
};

const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000 // 1 minute
};

/**
 * Circuit Breaker for GitHub API calls
 * Prevents cascading failures by temporarily blocking requests after repeated failures
 */
class GitHubCircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
  }

  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        const waitTime = Math.ceil((this.nextAttempt - Date.now()) / 1000);
        throw new GitHubError(
          `GitHub API circuit breaker is OPEN. Try again in ${waitTime} seconds`,
          ErrorCode.SERVICE_UNAVAILABLE,
          503,
          { constraint: 'circuit_breaker' },
          { operation: operationName, metadata: { state: this.state, waitTime } }
        );
      }
      this.state = CircuitBreakerState.HALF_OPEN;
      this.successCount = 0;
      logger.info('GitHub API circuit breaker transitioning to HALF_OPEN', { operation: operationName });
    }

    try {
      const result = await operation();
      return this.onSuccess(result, operationName);
    } catch (error) {
      return this.onFailure(error as Error, operationName);
    }
  }

  private onSuccess<T>(result: T, operationName: string): T {
    this.failureCount = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.successCount = 0;
        logger.info('GitHub API circuit breaker transitioned to CLOSED', { operation: operationName });
      }
    }
    
    return result;
  }

  private onFailure(error: Error, operationName: string): never {
    this.failureCount++;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = Date.now() + this.options.timeout;
      logger.warn('GitHub API circuit breaker transitioned to OPEN from HALF_OPEN', { 
        operation: operationName,
        failureCount: this.failureCount 
      });
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = Date.now() + this.options.timeout;
      logger.warn('GitHub API circuit breaker transitioned to OPEN', { 
        operation: operationName,
        failureCount: this.failureCount 
      });
    }
    
    throw error;
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics(): {
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
    nextAttempt: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt
    };
  }
}

// Global circuit breaker instance
const circuitBreaker = new GitHubCircuitBreaker();

/**
 * Enhanced GitHub API wrapper with comprehensive error handling
 */
export class GitHubApiClient {
  private octokit: {
    rest: {
      repos: Record<string, (...args: unknown[]) => Promise<unknown>>;
      rateLimit: {
        get: () => Promise<{
          data: {
            rate: {
              limit: number;
              remaining: number;
              reset: number;
              used: number;
            };
          };
        }>;
      };
    };
  } | null;
  private retryOptions: GitHubRetryOptions;

  constructor(token?: string, retryOptions: Partial<GitHubRetryOptions> = {}) {
    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
    
    if (token) {
      const { Octokit } = require('@octokit/rest');
      this.octokit = new Octokit({ 
        auth: token,
        request: {
          timeout: 30000 // 30 second timeout
        }
      }) as unknown as GitHubApiClient['octokit'];
    } else {
      this.octokit = null;
    }
  }

  /**
   * Execute GitHub API call with retry logic and circuit breaker
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: Partial<GitHubRetryOptions> = {}
  ): Promise<T> {
    const retryOptions = { ...this.retryOptions, ...options };
    
    return circuitBreaker.execute(async () => {
      return this.executeWithRetry(operation, operationName, retryOptions);
    }, operationName);
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryOptions: GitHubRetryOptions,
    attempt = 1
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      logger.github(operationName, undefined, { attempt, maxRetries: retryOptions.maxRetries });
      
      const result = await this.withTimeout(operation(), 30000);
      
      logger.performance(`GitHub API ${operationName}`, startTime, { attempt });
      
      return result;
      
    } catch (error) {
      const githubError = this.convertToGitHubError(error as Error, operationName);
      
      // Check if we should retry
      if (attempt < retryOptions.maxRetries && this.isRetryableError(githubError)) {
        const delay = this.calculateBackoffDelay(attempt, retryOptions);
        
        logger.warn(`GitHub API ${operationName} failed, retrying in ${delay}ms`, {
          attempt,
          maxRetries: retryOptions.maxRetries,
          error: githubError.message,
          delayMs: delay
        });
        
        await this.sleep(delay);
        return this.executeWithRetry(operation, operationName, retryOptions, attempt + 1);
      }
      
      // Log final error
      logger.error(`GitHub API ${operationName} failed after ${attempt} attempts`, {
        duration: Date.now() - startTime,
        error: githubError.toLogObject()
      });
      
      throw githubError;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError('GitHub API', timeoutMs));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private convertToGitHubError(error: Error, operationName: string): GitHubError {
    const context = { operation: operationName };

    // Handle Octokit HttpError
    if (error.name === 'HttpError') {
      const httpError = error as Error & {
        status?: number;
        response?: {
          status?: number;
          data?: {
            message?: string;
          };
          headers?: Record<string, string>;
        };
      };
      const status = httpError.status || httpError.response?.status;
      const responseData = httpError.response?.data;

      switch (status) {
        case 401:
          return GitHubError.authenticationError(context);
        
        case 403:
          // Check if it's rate limiting
          if (responseData?.message?.includes('rate limit')) {
            const resetTime = this.parseRateLimitReset(httpError);
            return GitHubError.rateLimitExceeded(resetTime, context);
          }
          return new GitHubError(
            'GitHub repository access denied',
            ErrorCode.GITHUB_REPOSITORY_ACCESS_ERROR,
            403,
            undefined,
            context
          );
        
        case 404:
          return new GitHubError(
            'GitHub resource not found',
            ErrorCode.GITHUB_API_ERROR,
            404,
            { constraint: 'not_found' },
            context
          );
        
        case 422:
          return new GitHubError(
            'GitHub API validation error',
            ErrorCode.GITHUB_API_ERROR,
            422,
            { constraint: 'validation' },
            context
          );
        
        default:
          return new GitHubError(
            httpError.message || 'GitHub API error',
            ErrorCode.GITHUB_API_ERROR,
            status || 502,
            undefined,
            context
          );
      }
    }

    // Handle timeout errors
    if (error instanceof TimeoutError) {
      return error;
    }

    // Handle network errors
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT')) {
      return new ExternalServiceError('GitHub API', error, context);
    }

    // Default to generic GitHub error
    return new GitHubError(
      error.message || 'Unknown GitHub API error',
      ErrorCode.GITHUB_API_ERROR,
      502,
      undefined,
      context
    );
  }

  private parseRateLimitReset(httpError: {
    response?: {
      headers?: Record<string, string>;
    };
  }): Date {
    const resetHeader = httpError.response?.headers?.['x-ratelimit-reset'];
    if (resetHeader && !isNaN(Number(resetHeader))) {
      return new Date(parseInt(resetHeader) * 1000);
    }
    // Default to 1 hour from now if header is missing
    return new Date(Date.now() + 60 * 60 * 1000);
  }

  private isRetryableError(error: GitHubError): boolean {
    // Don't retry authentication errors, validation errors, or not found
    const nonRetryableErrors = [
      ErrorCode.GITHUB_AUTHENTICATION_ERROR,
      ErrorCode.GITHUB_REPOSITORY_ACCESS_ERROR,
    ];
    
    if (nonRetryableErrors.includes(error.code)) {
      return false;
    }

    // Don't retry 4xx errors except for rate limiting and server errors
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return error.code === ErrorCode.GITHUB_RATE_LIMIT_ERROR;
    }

    // Retry 5xx errors and network errors
    return error.statusCode >= 500 || 
           error.code === ErrorCode.EXTERNAL_SERVICE_ERROR ||
           error.code === ErrorCode.SERVICE_TIMEOUT;
  }

  private calculateBackoffDelay(attempt: number, options: GitHubRetryOptions): number {
    const exponentialDelay = options.baseDelayMs * Math.pow(options.backoffFactor, attempt - 1);
    const jitterDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
    return Math.min(jitterDelay, options.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit information
   */
  async getRateLimitInfo(): Promise<RateLimitInfo> {
    if (!this.octokit) {
      throw new GitHubError(
        'GitHub client not authenticated',
        ErrorCode.GITHUB_AUTHENTICATION_ERROR,
        401
      );
    }

    return this.execute(async () => {
      const response = await this.octokit!.rest.rateLimit.get();
      const rateLimit = response.data.rate;
      
      return {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        reset: new Date(rateLimit.reset * 1000),
        used: rateLimit.used
      };
    }, 'getRateLimitInfo');
  }

  /**
   * Check if we have sufficient rate limit for an operation
   */
  async checkRateLimit(requiredCalls = 1): Promise<boolean> {
    try {
      const rateLimitInfo = await this.getRateLimitInfo();
      return rateLimitInfo.remaining >= requiredCalls;
    } catch (error) {
      // If we can't check rate limit, assume we have capacity
      logger.warn('Could not check GitHub rate limit', { error: String(error) });
      return true;
    }
  }

  /**
   * Wait until rate limit resets if necessary
   */
  async waitForRateLimit(): Promise<void> {
    try {
      const rateLimitInfo = await this.getRateLimitInfo();
      
      if (rateLimitInfo.remaining <= 0) {
        const waitTime = rateLimitInfo.reset.getTime() - Date.now();
        if (waitTime > 0) {
          logger.info(`Waiting ${Math.ceil(waitTime / 1000)}s for GitHub rate limit reset`);
          await this.sleep(waitTime);
        }
      }
    } catch (error) {
      logger.warn('Could not wait for rate limit reset', { error: String(error) });
    }
  }
}

/**
 * Factory function to create GitHub API client with error handling
 */
export function createGitHubClient(
  token?: string, 
  retryOptions?: Partial<GitHubRetryOptions>
): GitHubApiClient {
  return new GitHubApiClient(token, retryOptions);
}

/**
 * Get circuit breaker status for monitoring
 */
export function getCircuitBreakerStatus(): {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  nextAttempt: number;
} {
  return circuitBreaker.getMetrics();
}

/**
 * Webhook signature verification with enhanced error handling
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const crypto = require('crypto');
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Webhook signature verification failed', {
      error: error instanceof Error ? error.message : String(error),
      hasSignature: !!signature,
      hasSecret: !!secret,
      payloadLength: payload.length
    });
    throw new GitHubError(
      'Webhook signature verification failed',
      ErrorCode.GITHUB_WEBHOOK_ERROR,
      400,
      { constraint: 'signature_verification' },
      { operation: 'webhook_verification' }
    );
  }
}