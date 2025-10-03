
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import {
  globalErrorHandler,
  requestTracking,
  requestTimeout,
  asyncHandler
} from './middleware/errorHandler';
import {
  rateLimiter,
  jsonErrorHandler,
  validateContentType
} from './middleware/security';
import { logger } from './utils/logger';
import { getPerformanceMonitor } from './performance/performance-monitor';

// Import routes
import contactRoutes from './routes/contacts';
import refactorRoutes from './routes/refactor';
import memoryRoutes from './routes/memory';
import githubRoutes from './routes/github';
import webhookRoutes from './routes/webhooks';
import searchesRoutes from './routes/searches';
import timelineRoutes from './routes/timeline';
import patternsRoutes from './routes/patterns';
import repositoriesRoutes from './routes/repositories';
import improvementsRoutes from './routes/improvements';
import analyticsRoutes from './routes/analytics';
import analysisRoutes from './routes/analysis';
import templatesRoutes from './routes/templates';
import errorRoutes from './routes/errors';
import performanceRoutes from './routes/performance';
import healthRoutes from './routes/health';
import scannerRoutes from './routes/scanner';

const app = express();

// Initialize performance monitoring
const performanceMonitor = getPerformanceMonitor({
  responseTime: { warning: 1000, critical: 5000 },
  memoryUsage: { warning: 0.8, critical: 0.9 },
  cpuUsage: { warning: 70, critical: 90 },
  errorRate: { warning: 0.05, critical: 0.1 },
  eventLoopDelay: { warning: 10, critical: 50 },
  throughput: { minimum: 10 }
});

// Performance monitoring middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    performanceMonitor.recordRequest(
      requestId,
      req.path,
      req.method,
      res.statusCode,
      responseTime,
      req.headers['user-agent'],
      req.ip
    );
  });
  
  next();
});

// Core Middleware
app.use(requestTracking);
app.use(requestTimeout(30000));
app.use(helmet());
app.use(cors());

// Security middleware
app.use(rateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Too many requests from this IP, please try again later'
}));
app.use(validateContentType);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// JSON error handling
app.use(jsonErrorHandler);
app.use(morgan('combined', {
  stream: {
    write: (message: string) => {
      logger.info(message.trim(), {}, 'HTTP');
    }
  }
}));

// API Routes
app.use('/api', healthRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/refactor', refactorRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/searches', searchesRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/patterns', patternsRoutes);
app.use('/api/repositories', repositoriesRoutes);
app.use('/api/improvements', improvementsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/scanner', scannerRoutes);

// Event tracking endpoint
app.post('/api/events', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const eventData = req.body;
    logger.info('📊 Event tracked:', { 
      type: eventData.type, 
      category: eventData.category,
      title: eventData.title
    });
    res.json({
      success: true,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      message: 'Event tracked successfully'
    });
  } catch (error) {
    logger.error('Error tracking event:', { error: String(error) });
    res.status(500).json({ 
      error: 'Failed to track event',
      success: false 
    });
  }
}));

// Root Endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'RefactorForge Multi-Repository API',
    version: '2.2.0',
    description: 'Advanced code intelligence platform with live GitHub scanning and automated recommendation generation',
    features: [
      'Live GitHub repository scanning',
      'Real-time pattern extraction',
      'Automated recommendation generation',
      'Periodic repository analysis',
      'Security, type safety, and performance detection',
      'Multi-repository support',
      'Intelligent caching and performance optimization'
    ],
    endpoints: {
      health: '/api/health',
      analysis: '/api/analysis',
      scanner: '/api/scanner',
      repositories: '/api/repositories',
      improvements: '/api/improvements',
      patterns: '/api/patterns',
      analytics: '/api/analytics'
    },
    timestamp: new Date().toISOString()
  });
});

// Error Handling Middleware
app.use(globalErrorHandler);
app.use('*', (req: Request, res: Response) => {
  const error = {
    error: true,
    code: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  };
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  res.status(404).json(error);
});

export default app;
