
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { DependencyHealth } from '../types';
import { optimizedDbGet } from '../performance/optimized-database-helpers';
import { Octokit } from '@octokit/rest';

const router = Router();

// Health check cache (5 second TTL)
let healthCheckCache: { data: unknown; timestamp: number } | null = null;
const HEALTH_CHECK_CACHE_TTL = 5000; // 5 seconds

/**
 * Health Check Endpoint - Comprehensive System Status Monitoring
 * @route GET /api/health
 */
router.get('/health', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  // Check cache first
  const now = Date.now();
  if (healthCheckCache && (now - healthCheckCache.timestamp) < HEALTH_CHECK_CACHE_TTL) {
    res.json(healthCheckCache.data);
    return;
  }
  const healthCheck = {
    status: 'ok',
    service: 'RefactorForge Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: 'unknown' } as DependencyHealth,
      memory: { status: 'ok', usage: process.memoryUsage() },
      github: { status: 'unknown' } as DependencyHealth,
      environment: {
        nodeVersion: process.version,
        platform: process.platform
      }
    }
  };

  // Check SQLite database connection and get stats (optimized)
  try {
    const connectionTest = await optimizedDbGet<{ test: number }>('SELECT 1 as test', [], {
      enableCaching: true,
      cacheTTL: 30000,
      timeout: 5000
    });
    
    if (!connectionTest.data) {
      throw new Error('Database connection test failed');
    }
    
    const statsResult = await optimizedDbGet<{ 
      contacts_count: number; 
      memory_count: number; 
      refactor_count: number;
      repositories_count: number;
      patterns_count: number;
    }>(`SELECT 
      (SELECT COUNT(*) FROM contacts) as contacts_count,
      (SELECT COUNT(*) FROM memory) as memory_count,
      (SELECT COUNT(*) FROM refactor_history) as refactor_count,
      (SELECT COUNT(*) FROM repositories) as repositories_count,
      (SELECT COUNT(*) FROM repository_patterns) as patterns_count
    `, [], {
      enableCaching: true,
      cacheTTL: 60000,
      timeout: 10000
    });
    
    healthCheck.checks.database = {
      status: 'healthy',
      tables: statsResult.data || { contacts_count: 0, memory_count: 0, refactor_count: 0, repositories_count: 0, patterns_count: 0 },
      type: 'SQLite3',
      latency: connectionTest.executionTime,
      message: `Query time: ${connectionTest.executionTime}ms (cached: ${connectionTest.fromCache})`
    };
  } catch (error: unknown) {
    healthCheck.status = 'degraded';
    healthCheck.checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
      type: 'SQLite3',
      message: 'Database connection failed'
    };
  }

  // Check GitHub API status (with timeout and caching)
  try {
    if (process.env.GITHUB_TOKEN) {
      const githubCheck = Promise.race([
        (async () => {
          const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
          const rateLimit = await octokit.rest.rateLimit.get();
          
          return {
            status: 'authenticated',
            rateLimitRemaining: rateLimit.data.rate.remaining,
            rateLimitReset: new Date(rateLimit.data.rate.reset * 1000).toISOString(),
            type: 'GitHub API v4'
          };
        })(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GitHub API timeout')), 5000);
        })
      ]);
      
      healthCheck.checks.github = await githubCheck as DependencyHealth;
    } else {
      healthCheck.checks.github = {
        status: 'unauthenticated',
        message: 'Public access only - limited to 60 requests/hour',
        type: 'GitHub API v4'
      };
    }
  } catch (error: unknown) {
    healthCheck.status = 'degraded';
    healthCheck.checks.github = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown GitHub API error',
      type: 'GitHub API v4'
    };
  }

  // Cache the result
  healthCheckCache = {
    data: healthCheck,
    timestamp: Date.now()
  };

  const statusCode = healthCheck.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
}));

export default router;
