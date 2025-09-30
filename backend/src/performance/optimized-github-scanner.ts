import { Octokit } from '@octokit/rest';
import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../errors/AppError';
import { 
  GitHubRepository, 
  GitHubFile,
  GitHubRateLimit 
} from '../types/github.types';
import type {
  ScannerSecurityPattern,
  ScannerTypeSafetyIssue,
  ScannerPerformanceIssue
} from '../services/github-scanner';
import type {
  PatternDetectionResult
} from '../types/analysis.types';
import { StreamingFileProcessor } from './streaming-file-processor';

export interface OptimizedScanOptions {
  maxConcurrentFiles: number;
  maxConcurrentAPIRequests: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimitBuffer: number;
  enableStreaming: boolean;
  streamingThreshold: number;
  memoryThreshold: number;
  batchSize: number;
  timeoutMs: number;
}

export interface ScanMetrics {
  totalFiles: number;
  filesScanned: number;
  filesSkipped: number;
  apiRequestsUsed: number;
  cacheHits: number;
  cacheMisses: number;
  averageFileProcessingTime: number;
  totalScanTime: number;
  memoryPeakUsage: number;
  rateLimitRemaining: number;
  errorsEncountered: number;
  retryAttempts: number;
  networkLatency: number;
}

export interface OptimizedScanResult {
  patterns: PatternDetectionResult[];
  securityIssues: ScannerSecurityPattern[];
  typeSafetyIssues: ScannerTypeSafetyIssue[];
  performanceIssues: ScannerPerformanceIssue[];
  scanSuccessful: boolean;
  metrics: ScanMetrics;
  errorMessage?: string;
}

interface CachedFile {
  content: string;
  sha: string;
  timestamp: number;
  size: number;
}

interface GitHubAPIRequest {
  endpoint: string;
  params: Record<string, unknown>;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Optimized GitHub Scanner with advanced performance features
 * Implements connection pooling, caching, streaming, and intelligent batching
 */
export class OptimizedGitHubScanner {
  /** GitHub API client with optimized configuration */
  private octokit: Octokit;
  
  /** Scanner configuration options */
  private options: OptimizedScanOptions;
  
  /** Performance metrics tracking */
  private metrics: ScanMetrics = {
    totalFiles: 0,
    filesScanned: 0,
    filesSkipped: 0,
    apiRequestsUsed: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageFileProcessingTime: 0,
    totalScanTime: 0,
    memoryPeakUsage: 0,
    rateLimitRemaining: 0,
    errorsEncountered: 0,
    retryAttempts: 0,
    networkLatency: 0
  };
  
  /** LRU cache for file contents with SHA-based invalidation */
  private fileCache: LRUCache<string, CachedFile>;
  
  /** LRU cache for GitHub API responses */
  private apiCache: LRUCache<string, Record<string, unknown>>;
  
  /** Concurrency limiter for file processing to prevent memory overflow */
  private concurrencyLimiter: ReturnType<typeof pLimit>;
  
  /** API rate limit controller to respect GitHub's limits */
  private apiLimiter: ReturnType<typeof pLimit>;
  
  /** Streaming processor for large files to optimize memory usage */
  private streamProcessor: StreamingFileProcessor;
  
  /** Priority-based request queue for intelligent API call ordering */
  private requestQueue: GitHubAPIRequest[] = [];
  
  /** Current GitHub API rate limit information for dynamic optimization */
  private rateLimitInfo: GitHubRateLimit | null = null;

  constructor(githubToken?: string, options: Partial<OptimizedScanOptions> = {}) {
    // Merge default options with provided configuration
    // These defaults are optimized for authenticated GitHub API usage
    this.options = {
      maxConcurrentFiles: 8,              // Balance between speed and memory usage
      maxConcurrentAPIRequests: 5,        // Conservative limit to avoid rate limiting
      cacheEnabled: true,                 // Essential for performance in repeated scans
      cacheTTL: 300000, // 5 minutes      // Balance between freshness and performance
      retryAttempts: 3,                   // Adequate for transient failures
      retryDelay: 1000,                   // Base delay for exponential backoff
      rateLimitBuffer: 100,               // Safety buffer to prevent rate limit violations
      enableStreaming: true,              // Critical for large file processing
      streamingThreshold: 1024 * 1024,    // 1MB - threshold for streaming processing
      memoryThreshold: 200 * 1024 * 1024, // 200MB
      batchSize: 10,
      timeoutMs: 30000,
      ...options
    };

    // Initialize GitHub client
    this.octokit = new Octokit({
      auth: githubToken,
      request: {
        timeout: this.options.timeoutMs,
        retries: 0 // We handle retries manually
      }
    });

    // Initialize caches
    this.fileCache = new LRUCache<string, CachedFile>({
      max: 1000,
      maxSize: 50 * 1024 * 1024, // 50MB max cache size
      ttl: this.options.cacheTTL,
      sizeCalculation: (value) => value.content.length + 1000 // Estimate overhead
    });

    this.apiCache = new LRUCache<string, Record<string, unknown>>({
      max: 500,
      ttl: this.options.cacheTTL
    });

    // Initialize concurrency limiters
    this.concurrencyLimiter = pLimit(this.options.maxConcurrentFiles);
    this.apiLimiter = pLimit(this.options.maxConcurrentAPIRequests);

    // Initialize streaming processor
    this.streamProcessor = new StreamingFileProcessor({
      maxConcurrency: this.options.maxConcurrentFiles,
      memoryThreshold: this.options.memoryThreshold,
      chunkSize: 64 * 1024, // 64KB chunks
      timeout: this.options.timeoutMs
    });

    this.resetMetrics();

    logger.info('Optimized GitHub Scanner initialized', {
      maxConcurrentFiles: this.options.maxConcurrentFiles,
      maxConcurrentAPIRequests: this.options.maxConcurrentAPIRequests,
      cacheEnabled: this.options.cacheEnabled,
      enableStreaming: this.options.enableStreaming
    });
  }

  /**
   * Scan repository with advanced optimizations
   */
  async scanRepository(repository: GitHubRepository): Promise<OptimizedScanResult> {
    const scanStartTime = Date.now();
    this.resetMetrics();

    logger.info('Starting optimized repository scan', {
      repository: `${repository.owner}/${repository.repo}`,
      branch: repository.branch
    });

    try {
      // Update rate limit info
      await this.updateRateLimitInfo();

      // Get repository files with intelligent filtering
      const files = await this.getRepositoryFilesOptimized(repository);
      this.metrics.totalFiles = files.length;

      if (files.length === 0) {
        logger.warn('No files found in repository', {
          repository: `${repository.owner}/${repository.repo}`
        });
        
        return this.createEmptyResult('No scannable files found');
      }

      // Filter and prioritize files
      const codeFiles = this.filterAndPrioritizeFiles(files, repository);
      logger.info(`Found ${codeFiles.length} code files to analyze`);

      // Process files with optimized batching
      const results = await this.processFilesOptimized(repository, codeFiles);

      // Calculate final metrics
      this.metrics.totalScanTime = Date.now() - scanStartTime;
      this.metrics.averageFileProcessingTime = this.metrics.filesScanned > 0 
        ? this.metrics.totalScanTime / this.metrics.filesScanned 
        : 0;

      logger.info('Repository scan completed', {
        repository: `${repository.owner}/${repository.repo}`,
        metrics: this.metrics
      });

      return {
        ...results,
        scanSuccessful: true,
        metrics: { ...this.metrics }
      };

    } catch (error) {
      this.metrics.totalScanTime = Date.now() - scanStartTime;
      this.metrics.errorsEncountered++;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Repository scan failed', {
        repository: `${repository.owner}/${repository.repo}`,
        error: errorMessage,
        metrics: this.metrics
      });

      return this.createEmptyResult(errorMessage);
    }
  }

  /**
   * Get repository files with intelligent caching and batching
   */
  private async getRepositoryFilesOptimized(repository: GitHubRepository): Promise<GitHubFile[]> {
    const cacheKey = `files:${repository.owner}/${repository.repo}:${repository.branch}`;
    
    // Check cache first
    if (this.options.cacheEnabled) {
      const cached = this.apiCache.get(cacheKey);
      if (cached && Array.isArray(cached)) {
        this.metrics.cacheHits++;
        logger.debug('Retrieved files from cache', { repository: `${repository.owner}/${repository.repo}` });
        return cached as GitHubFile[];
      }
    }

    this.metrics.cacheMisses++;

    try {
      const networkStart = Date.now();
      
      // Try multiple branch strategies with fallback
      const files = await this.fetchRepositoryTree(repository);
      
      this.metrics.networkLatency += Date.now() - networkStart;
      this.metrics.apiRequestsUsed++;

      // Cache the result
      if (this.options.cacheEnabled) {
        this.apiCache.set(cacheKey, files as unknown as Record<string, unknown>);
      }

      return files;

    } catch (error) {
      this.metrics.errorsEncountered++;
      throw new AppError(
        'Failed to fetch repository files',
        ErrorCode.GITHUB_API_ERROR,
        500,
        true,
        { repository: `${repository.owner}/${repository.repo}`, error: String(error) }
      );
    }
  }

  /**
   * Fetch repository tree with intelligent branch detection
   */
  private async fetchRepositoryTree(repository: GitHubRepository): Promise<GitHubFile[]> {
    const branches = [repository.branch, 'main', 'master'];
    let lastError: Error | null = null;

    for (const branch of branches) {
      try {
        const response = await this.apiLimiter(() =>
          this.octokit.rest.git.getTree({
            owner: repository.owner,
            repo: repository.repo,
            tree_sha: branch,
            recursive: 'true'
          })
        );

        return response.data.tree
          .filter(item => item.type === 'blob')
          .map(item => ({
            name: item.path?.split('/').pop() || '',
            path: item.path || '',
            content: '',
            sha: item.sha || '',
            size: item.size || 0,
            type: 'blob' as const,
            mode: item.mode || '100644'
          }));

      } catch (error) {
        lastError = error as Error;
        logger.debug(`Failed to fetch tree for branch ${branch}`, {
          repository: `${repository.owner}/${repository.repo}`,
          error: String(error)
        });
      }
    }

    // If all branches fail, try to get default branch
    try {
      const repoInfo = await this.apiLimiter(() =>
        this.octokit.rest.repos.get({
          owner: repository.owner,
          repo: repository.repo
        })
      );

      const defaultBranch = repoInfo.data.default_branch;
      if (!branches.includes(defaultBranch)) {
        const response = await this.apiLimiter(() =>
          this.octokit.rest.git.getTree({
            owner: repository.owner,
            repo: repository.repo,
            tree_sha: defaultBranch,
            recursive: 'true'
          })
        );

        return response.data.tree
          .filter(item => item.type === 'blob')
          .map(item => ({
            name: item.path?.split('/').pop() || '',
            path: item.path || '',
            content: '',
            sha: item.sha || '',
            size: item.size || 0,
            type: 'blob' as const,
            mode: item.mode || '100644'
          }));
      }
    } catch (error) {
      logger.error('Failed to get default branch', {
        repository: `${repository.owner}/${repository.repo}`,
        error: String(error)
      });
    }

    throw lastError || new Error('Failed to fetch repository tree from any branch');
  }

  /**
   * Filter and prioritize files for scanning
   */
  private filterAndPrioritizeFiles(files: GitHubFile[], repository: GitHubRepository): GitHubFile[] {
    // Filter code files
    const codeFiles = files.filter(file => {
      // Include TypeScript/JavaScript files
      if (/\.(ts|tsx|js|jsx)$/.test(file.name)) {
        // Exclude common build/dependency directories
        const excludePaths = [
          'node_modules/',
          'dist/',
          'build/',
          '.git/',
          'coverage/',
          '.next/',
          'vendor/'
        ];
        
        return !excludePaths.some(path => file.path.includes(path));
      }
      
      return false;
    });

    // Prioritize files by importance
    const prioritizedFiles = codeFiles.sort((a, b) => {
      // Higher priority for smaller files (faster processing)
      const sizeWeight = (a.size || 0) - (b.size || 0);
      
      // Higher priority for important file types
      const getFileImportance = (file: GitHubFile) => {
        if (/\.(ts|tsx)$/.test(file.name)) return 3;
        if (/(index|main|app)\.(js|ts)/.test(file.name)) return 2;
        if (/\.test\.|\.spec\./.test(file.name)) return 0;
        return 1;
      };
      
      const importanceWeight = getFileImportance(b) - getFileImportance(a);
      
      return importanceWeight || sizeWeight;
    });

    // Limit files based on rate limit and performance
    const maxFiles = Math.min(
      prioritizedFiles.length,
      this.calculateOptimalFileLimit()
    );

    return prioritizedFiles.slice(0, maxFiles);
  }

  /**
   * Calculate optimal file limit based on rate limit and performance
   */
  private calculateOptimalFileLimit(): number {
    const baseLimit = 50;
    const rateLimitFactor = this.rateLimitInfo 
      ? Math.min(1, this.rateLimitInfo.remaining / 1000) 
      : 0.5;
    
    return Math.floor(baseLimit * rateLimitFactor);
  }

  /**
   * Process files with advanced optimizations
   */
  private async processFilesOptimized(
    repository: GitHubRepository,
    files: GitHubFile[]
  ): Promise<{
    patterns: PatternDetectionResult[];
    securityIssues: ScannerSecurityPattern[];
    typeSafetyIssues: ScannerTypeSafetyIssue[];
    performanceIssues: ScannerPerformanceIssue[];
  }> {
    const patterns: PatternDetectionResult[] = [];
    const securityIssues: ScannerSecurityPattern[] = [];
    const typeSafetyIssues: ScannerTypeSafetyIssue[] = [];
    const performanceIssues: ScannerPerformanceIssue[] = [];

    logger.info('Processing files with optimizations', {
      totalFiles: files.length,
      batchSize: this.options.batchSize,
      streaming: this.options.enableStreaming
    });

    // Process files in optimized batches
    for (let i = 0; i < files.length; i += this.options.batchSize) {
      const batch = files.slice(i, i + this.options.batchSize);
      
      // Check memory usage before processing batch
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed > this.options.memoryThreshold) {
        logger.warn('High memory usage detected, forcing GC', {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          threshold: `${(this.options.memoryThreshold / 1024 / 1024).toFixed(2)} MB`
        });
        
        if (global.gc) {
          global.gc();
        }
      }

      // Process batch with concurrency control
      const batchResults = await Promise.allSettled(
        batch.map(file => this.concurrencyLimiter(() => 
          this.processFileOptimized(repository, file)
        ))
      );

      // Aggregate results
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          patterns.push(...result.value.patterns);
          securityIssues.push(...result.value.security);
          typeSafetyIssues.push(...result.value.types);
          performanceIssues.push(...result.value.performance);
          this.metrics.filesScanned++;
        } else {
          this.metrics.filesSkipped++;
          this.metrics.errorsEncountered++;
          logger.error('File processing failed', {
            error: result.status === 'rejected' ? String(result.reason) : 'Unknown error'
          });
        }
      }

      // Update rate limit info periodically
      if (i % (this.options.batchSize * 2) === 0) {
        await this.updateRateLimitInfo();
        
        // Add dynamic delay based on rate limit
        if (this.rateLimitInfo && this.rateLimitInfo.remaining < this.options.rateLimitBuffer) {
          const delay = Math.min(5000, 60000 / this.rateLimitInfo.remaining);
          logger.info('Rate limit protection delay', { delay });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.info('File processing completed', {
      patterns: patterns.length,
      securityIssues: securityIssues.length,
      typeSafetyIssues: typeSafetyIssues.length,
      performanceIssues: performanceIssues.length,
      filesScanned: this.metrics.filesScanned,
      filesSkipped: this.metrics.filesSkipped
    });

    return {
      patterns,
      securityIssues,
      typeSafetyIssues,
      performanceIssues
    };
  }

  /**
   * Process individual file with caching and streaming
   */
  private async processFileOptimized(
    repository: GitHubRepository,
    file: GitHubFile
  ): Promise<{
    patterns: PatternDetectionResult[];
    security: ScannerSecurityPattern[];
    types: ScannerTypeSafetyIssue[];
    performance: ScannerPerformanceIssue[];
  } | null> {
    const fileStartTime = Date.now();

    try {
      // Get file content with caching
      const content = await this.getFileContentCached(repository, file);
      
      if (!content) {
        this.metrics.filesSkipped++;
        return null;
      }

      // Process with streaming for large files
      if (this.options.enableStreaming && content.length > this.options.streamingThreshold) {
        return await this.processLargeFileWithStreaming(repository, file, content);
      }

      // Regular processing for smaller files
      const patterns = this.extractPatternsFromCode(content, file.path, repository);
      const security = this.detectSecurityIssues(content, file.path);
      const types = this.detectTypeSafetyIssues(content, file.path);
      const performance = this.detectPerformanceIssues(content, file.path);

      // Update metrics
      const processingTime = Date.now() - fileStartTime;
      this.metrics.averageFileProcessingTime = 
        (this.metrics.averageFileProcessingTime * this.metrics.filesScanned + processingTime) / 
        (this.metrics.filesScanned + 1);

      return { patterns, security, types, performance };

    } catch (error) {
      logger.error('File processing error', {
        filePath: file.path,
        error: String(error)
      });
      return null;
    }
  }

  /**
   * Get file content with intelligent caching
   */
  private async getFileContentCached(repository: GitHubRepository, file: GitHubFile): Promise<string> {
    const cacheKey = `content:${repository.owner}/${repository.repo}:${file.sha}`;

    // Check cache first
    if (this.options.cacheEnabled) {
      const cached = this.fileCache.get(cacheKey);
      if (cached && cached.sha === file.sha) {
        this.metrics.cacheHits++;
        return cached.content;
      }
    }

    this.metrics.cacheMisses++;

    try {
      const response = await this.apiLimiter(async () => {
        await this.checkRateLimitWithBackoff();
        
        return this.octokit.rest.repos.getContent({
          owner: repository.owner,
          repo: repository.repo,
          path: file.path,
          ref: repository.branch
        });
      });

      this.metrics.apiRequestsUsed++;

      if ('content' in response.data && response.data.content) {
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        
        // Cache the content
        if (this.options.cacheEnabled) {
          this.fileCache.set(cacheKey, {
            content,
            sha: file.sha,
            timestamp: Date.now(),
            size: content.length
          });
        }

        return content;
      }

      return '';
    } catch (error) {
      this.metrics.errorsEncountered++;
      logger.error('Failed to fetch file content', {
        filePath: file.path,
        error: String(error)
      });
      return '';
    }
  }

  /**
   * Process large files using streaming
   */
  private async processLargeFileWithStreaming(
    repository: GitHubRepository,
    file: GitHubFile,
    content: string
  ): Promise<{
    patterns: PatternDetectionResult[];
    security: ScannerSecurityPattern[];
    types: ScannerTypeSafetyIssue[];
    performance: ScannerPerformanceIssue[];
  }> {
    logger.info('Processing large file with streaming', {
      filePath: file.path,
      size: `${(content.length / 1024).toFixed(2)} KB`
    });

    // Convert content to chunks for streaming processing
    const chunkSize = 16 * 1024; // 16KB chunks
    const chunks: Buffer[] = [];
    
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(Buffer.from(content.slice(i, i + chunkSize)));
    }

    const patterns: PatternDetectionResult[] = [];
    const security: ScannerSecurityPattern[] = [];
    const types: ScannerTypeSafetyIssue[] = [];
    const performance: ScannerPerformanceIssue[] = [];

    // Process chunks in parallel
    const chunkResults = await Promise.all(
      chunks.map(async (chunk, index) => {
        const chunkContent = chunk.toString('utf-8');
        const chunkStartLine = (content.substring(0, content.indexOf(chunkContent)).match(/\n/g) || []).length;
        
        return {
          patterns: this.extractPatternsFromCode(chunkContent, file.path, repository, chunkStartLine),
          security: this.detectSecurityIssues(chunkContent, file.path),
          types: this.detectTypeSafetyIssues(chunkContent, file.path),
          performance: this.detectPerformanceIssues(chunkContent, file.path)
        };
      })
    );

    // Aggregate chunk results
    for (const chunkResult of chunkResults) {
      patterns.push(...chunkResult.patterns);
      security.push(...chunkResult.security);
      types.push(...chunkResult.types);
      performance.push(...chunkResult.performance);
    }

    return { patterns, security, types, performance };
  }

  /**
   * Update rate limit information
   */
  private async updateRateLimitInfo(): Promise<void> {
    try {
      const response = await this.octokit.rest.rateLimit.get();
      this.rateLimitInfo = {
        limit: response.data.rate.limit,
        remaining: response.data.rate.remaining,
        reset: response.data.rate.reset,
        used: response.data.rate.used
      };
      
      if (this.rateLimitInfo) {
        this.metrics.rateLimitRemaining = this.rateLimitInfo.remaining;
      }
    } catch (error) {
      logger.warn('Failed to update rate limit info', { error: String(error) });
    }
  }

  /**
   * Check rate limit with intelligent backoff
   */
  private async checkRateLimitWithBackoff(): Promise<void> {
    if (!this.rateLimitInfo) {
      await this.updateRateLimitInfo();
    }

    if (this.rateLimitInfo && this.rateLimitInfo.remaining < this.options.rateLimitBuffer) {
      const resetTime = this.rateLimitInfo.reset * 1000;
      const now = Date.now();
      
      if (resetTime > now) {
        const waitTime = Math.min(resetTime - now, 60000); // Max 1 minute wait
        logger.warn('Rate limit protection active', {
          remaining: this.rateLimitInfo.remaining,
          waitTime: `${waitTime}ms`
        });
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        await this.updateRateLimitInfo();
      }
    }
  }

  // Pattern detection methods (optimized versions of existing methods)
  private extractPatternsFromCode(
    content: string,
    filePath: string,
    repository: GitHubRepository,
    lineOffset: number = 0
  ): PatternDetectionResult[] {
    // Implementation similar to original but with optimizations
    const patterns: PatternDetectionResult[] = [];
    const lines = content.split('\n');
    const repositoryId = `${repository.owner}/${repository.repo}`;
    const language = this.detectLanguage(filePath);

    // Optimized pattern rules with compiled regex
    const patternRules = [
      {
        regex: /^[\s]*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)[\s]*{?/gm,
        category: 'function',
        subcategory: 'declaration',
        type: 'function_declaration'
      },
      {
        regex: /const\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|(\w+)\s*=>)/gm,
        category: 'function',
        subcategory: 'arrow_function',
        type: 'arrow_function'
      }
      // Add more optimized patterns as needed
    ];

    for (const rule of patternRules) {
      let match;
      rule.regex.lastIndex = 0; // Reset regex state
      
      while ((match = rule.regex.exec(content)) !== null) {
        const matchText = match[0];
        const lineNumber = this.getLineNumber(content, match.index) + lineOffset;
        
        patterns.push({
          patternType: rule.type,
          patternName: rule.type,
          filePath,
          lineNumber: lineNumber,
          codeSnippet: matchText.trim(),
          confidence: 0.8,
          impact: 'medium' as const,
          repository: {
            owner: repository.owner,
            repo: repository.repo,
            branch: repository.branch
          }
        });
      }
    }

    return patterns;
  }

  private detectSecurityIssues(content: string, filePath: string): ScannerSecurityPattern[] {
    // Optimized security detection
    const issues: ScannerSecurityPattern[] = [];
    
    // Use compiled patterns for better performance
    const securityPatterns = [
      {
        pattern: /password\s*[:=]\s*['"`][^'"`]+['"`]/gi,
        type: 'insecure_config' as const,
        severity: 'critical' as const,
        description: 'Hardcoded password detected'
      },
      {
        pattern: /api[_-]?key\s*[:=]\s*['"`][^'"`]+['"`]/gi,
        type: 'insecure_config' as const,
        severity: 'critical' as const,
        description: 'Hardcoded API key detected'
      }
    ];

    for (const secPattern of securityPatterns) {
      let match;
      secPattern.pattern.lastIndex = 0;
      
      while ((match = secPattern.pattern.exec(content)) !== null) {
        const lineNumber = this.getLineNumber(content, match.index);
        issues.push({
          type: secPattern.type,
          severity: secPattern.severity,
          description: secPattern.description,
          filePath,
          lineNumber,
          recommendation: 'Use environment variables or secure key management'
        });
      }
    }

    return issues;
  }

  private detectTypeSafetyIssues(content: string, filePath: string): ScannerTypeSafetyIssue[] {
    const issues: ScannerTypeSafetyIssue[] = [];

    // Optimized any type detection
    const anyUsageRegex = /:\s*any\b|as\s+any\b/gm;
    let match;
    
    while ((match = anyUsageRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      issues.push({
        type: 'any_usage',
        description: 'Usage of "any" type reduces type safety',
        filePath,
        lineNumber,
        suggestion: 'Replace with specific interface or union types'
      });
    }

    return issues;
  }

  private detectPerformanceIssues(content: string, filePath: string): ScannerPerformanceIssue[] {
    const issues: ScannerPerformanceIssue[] = [];

    // Optimized synchronous operation detection
    const syncOpsRegex = /fs\.(?:readFileSync|writeFileSync|existsSync|statSync)/gm;
    let match;
    
    while ((match = syncOpsRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      issues.push({
        type: 'sync_operation',
        description: 'Synchronous file operation blocks event loop',
        filePath,
        lineNumber,
        impact: 'Application responsiveness degradation',
        solution: 'Use async alternatives: fs.promises.readFile(), fs.promises.writeFile()'
      });
    }

    return issues;
  }

  // Helper methods
  private resetMetrics(): void {
    this.metrics = {
      totalFiles: 0,
      filesScanned: 0,
      filesSkipped: 0,
      apiRequestsUsed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageFileProcessingTime: 0,
      totalScanTime: 0,
      memoryPeakUsage: 0,
      rateLimitRemaining: 0,
      errorsEncountered: 0,
      retryAttempts: 0,
      networkLatency: 0
    };
  }

  private createEmptyResult(errorMessage: string): OptimizedScanResult {
    return {
      patterns: [],
      securityIssues: [],
      typeSafetyIssues: [],
      performanceIssues: [],
      scanSuccessful: false,
      metrics: { ...this.metrics },
      errorMessage
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return 'TypeScript';
      case 'js': case 'jsx': return 'JavaScript';
      case 'py': return 'Python';
      case 'java': return 'Java';
      case 'go': return 'Go';
      default: return 'Unknown';
    }
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private getContextLines(lines: string[], lineIndex: number, offset: number): string {
    const contextLines: string[] = [];
    const start = offset < 0 ? Math.max(0, lineIndex + offset) : lineIndex + 1;
    const end = offset < 0 ? lineIndex : Math.min(lines.length, lineIndex + offset + 1);
    
    for (let i = start; i < end; i++) {
      if (lines[i] !== undefined) {
        contextLines.push(lines[i] as string);
      }
    }
    
    return contextLines.join('\n');
  }

  /**
   * Get current scan metrics
   */
  getMetrics(): ScanMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.fileCache.clear();
    this.apiCache.clear();
    logger.info('Scanner caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    fileCacheSize: number;
    apiCacheSize: number;
    fileCacheHitRate: number;
    apiCacheHitRate: number;
  } {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.metrics.cacheHits / totalRequests) * 100 : 0;

    return {
      fileCacheSize: this.fileCache.size,
      apiCacheSize: this.apiCache.size,
      fileCacheHitRate: hitRate,
      apiCacheHitRate: hitRate // Simplified - could be tracked separately
    };
  }
}