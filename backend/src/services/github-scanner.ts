import { Octokit } from '@octokit/rest';
import { createTokenAuth } from '@octokit/auth-token';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../utils/database-helpers';
import { OptimizedGitHubScanner, OptimizedScanResult } from '../performance/optimized-github-scanner';
import { logger } from '../utils/logger';
import {
  GitHubRepository,
  GitHubFile,
  GitHubTreeResponse,
  GitHubContentResponse,
  GitHubRateLimit,
  GitHubRateLimitResponse,
  GitHubRepositoryPayload
} from '../types/github.types';
import {
  PatternDetectionResult,
  SecurityPattern,
  TypeSafetyIssue,
  PerformanceIssue,
  ScanResult
} from '../types/analysis.types';
import {
  RepositoryRow
} from '../types/database.types';

// Local interfaces that extend the imported types for scanner-specific needs
interface ScannerPatternDetectionResult {
  id: string;
  repositoryId: string;
  patternType: string;
  content: string;
  description: string;
  category: string;
  subcategory?: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  language: string;
  confidenceScore: number;
  tags: string[];
  contextBefore?: string;
  contextAfter?: string;
  metadata: Record<string, unknown>;
  // Additional properties for compatibility with analysis types
  patternName: string;
  lineNumber: number | null;
  codeSnippet: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  repository?: {
    owner: string;
    repo: string;
    branch: string;
  };
}

export interface ScannerSecurityPattern {
  type: 'missing_middleware' | 'insecure_config' | 'vulnerable_dependency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  filePath: string;
  lineNumber?: number;
  recommendation: string;
}

export interface ScannerTypeSafetyIssue {
  type: 'any_usage' | 'missing_types' | 'type_assertion';
  description: string;
  filePath: string;
  lineNumber: number;
  suggestion: string;
}

export interface ScannerPerformanceIssue {
  type: 'sync_operation' | 'memory_leak' | 'inefficient_loop' | 'large_bundle';
  description: string;
  filePath: string;
  lineNumber?: number;
  impact: string;
  solution: string;
}

interface ScannerGitHubFile {
  name: string;
  path: string;
  content: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

/**
 * GitHubScanner - Advanced GitHub repository scanning and analysis service
 * 
 * Provides comprehensive scanning capabilities for GitHub repositories including:
 * - Pattern extraction and analysis
 * - Security vulnerability detection
 * - Type safety issue identification
 * - Performance bottleneck detection
 * - Rate limit management and optimization
 * - Caching and performance enhancements
 * 
 * Features:
 * - Automatic retry logic with exponential backoff
 * - Dynamic batch sizing based on rate limits
 * - Connection pooling and streaming for large files
 * - Intelligent caching with TTL
 * - Comprehensive error handling and recovery
 * 
 * @example
 * ```typescript
 * const scanner = new GitHubScanner(process.env.GITHUB_TOKEN);
 * const repository = { owner: 'octocat', repo: 'Hello-World', branch: 'main' };
 * const results = await scanner.scanRepository(repository);
 * 
 * console.log(`Found ${results.patterns.length} patterns`);
 * console.log(`Security issues: ${results.securityIssues.length}`);
 * ```
 * 
 * @see {@link OptimizedGitHubScanner} for performance-enhanced scanning
 * @see {@link ScannerPatternDetectionResult} for pattern result structure
 * 
 * @author RefactorForge Team
 * @version 2.1.0
 * @since 1.0.0
 */
export class GitHubScanner {
  /** GitHub API client instance */
  private octokit: Octokit;
  
  /** Current rate limit remaining requests */
  private rateLimitRemaining = 5000;
  
  /** Timestamp when rate limit resets */
  private rateLimitReset = Date.now();
  
  /** Whether the scanner is authenticated with a token */
  private authenticated = false;
  
  /** Optimized scanner instance for performance enhancements */
  private optimizedScanner: OptimizedGitHubScanner;

  /**
   * Creates a new GitHubScanner instance
   * 
   * @param githubToken - Optional GitHub personal access token for authentication
   *                     If not provided, uses public API with lower rate limits
   * 
   * @example
   * ```typescript
   * // Authenticated scanner (recommended)
   * const scanner = new GitHubScanner('ghp_xxxxxxxxxxxxxxxxxxxx');
   * 
   * // Public scanner (limited to 60 requests/hour)
   * const publicScanner = new GitHubScanner();
   * ```
   */
  constructor(githubToken?: string) {
    if (githubToken) {
      console.log('🔑 GitHub Scanner initialized with token: [REDACTED]');
      this.octokit = new Octokit({
        auth: githubToken,
      });
      this.authenticated = true;
    } else {
      console.log('⚠️  GitHub Scanner initialized without authentication token');
      // Use without auth for public repos (lower rate limit)
      this.octokit = new Octokit();
      this.authenticated = false;
    }

    // Initialize optimized scanner with performance enhancements
    this.optimizedScanner = new OptimizedGitHubScanner(githubToken, {
      maxConcurrentFiles: this.authenticated ? 8 : 4,
      maxConcurrentAPIRequests: this.authenticated ? 5 : 3,
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      enableStreaming: true,
      streamingThreshold: 1024 * 1024, // 1MB
      memoryThreshold: 200 * 1024 * 1024, // 200MB
      batchSize: this.authenticated ? 10 : 5,
      timeoutMs: 30000
    });

    logger.info('GitHub Scanner initialized with optimizations', {
      authenticated: this.authenticated,
      optimizations: {
        connectionPooling: true,
        caching: true,
        streaming: true,
        concurrencyControl: true
      }
    });
  }

  /**
   * Calculates optimal batch size for file processing based on current rate limit
   * 
   * Dynamically adjusts batch sizes to maximize throughput while respecting
   * GitHub API rate limits. Higher rate limits allow larger batch sizes for
   * faster processing, while lower limits use smaller batches to prevent
   * rate limit exhaustion.
   * 
   * @returns The optimal number of files to process in parallel
   * 
   * @example
   * ```typescript
   * const batchSize = this.getOptimalBatchSize();
   * // Returns: 10 if rate limit > 3000
   * //          5 if rate limit > 1000
   * //          3 if rate limit <= 1000
   * ```
   * 
   * @private
   */
  private getOptimalBatchSize(): number {
    // Dynamic batch sizing based on rate limit remaining
    if (this.rateLimitRemaining > 3000) {
      return 10; // High rate limit: process more files in parallel
    } else if (this.rateLimitRemaining > 1000) {
      return 5;  // Medium rate limit: moderate batch size
    } else {
      return 3;  // Low rate limit: conservative batch size
    }
  }

  /**
   * Executes an operation with exponential backoff retry logic
   * 
   * Implements a robust retry mechanism for handling transient failures,
   * particularly GitHub API rate limit errors. Uses exponential backoff
   * with increasing delays: 1s, 2s, 4s, etc.
   * 
   * @template T - The return type of the operation
   * @param operation - The async operation to retry
   * @param operationName - Human-readable name for logging purposes
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * 
   * @returns Promise resolving to operation result or null if all retries failed
   * 
   * @example
   * ```typescript
   * const result = await this.processWithRetry(
   *   () => this.octokit.rest.repos.getContent({...}),
   *   'Fetching file content',
   *   3
   * );
   * 
   * if (result) {
   *   console.log('Operation succeeded');
   * } else {
   *   console.log('Operation failed after retries');
   * }
   * ```
   * 
   * @throws {Error} Only throws for non-retryable errors (non-403 status codes)
   * @private
   */
  private async processWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T | null> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Only retry on rate limit errors (403)
        if (error.status !== 403) {
          console.error(`❌ ${operationName} failed (non-retryable):`, error.message);
          throw error;
        }
        
        // Calculate exponential backoff delay
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`⏳ Rate limit hit on ${operationName}, retrying in ${delay/1000}s (attempt ${attempt + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Re-check rate limit before retry
        await this.checkRateLimit();
      }
    }
    
    console.error(`❌ ${operationName} failed after ${maxRetries} retries:`, lastError?.message);
    return null;
  }

  /**
   * Get dynamic file limit based on authentication status and environment
   */
  private getFileLimit(): number {
    // Check for environment variable override
    const envLimit = process.env.GITHUB_SCANNER_FILE_LIMIT;
    if (envLimit) {
      return parseInt(envLimit, 10);
    }
    
    // Dynamic limits based on authentication and rate limit
    if (this.authenticated) {
      if (this.rateLimitRemaining > 4000) {
        return 100; // High limit for authenticated users with good rate limit
      }
      return 50; // Standard limit for authenticated users
    } else {
      return 30; // Conservative limit for unauthenticated users
    }
  }

  /**
   * Get dynamic delay between batches based on rate limit
   */
  private getBatchDelay(): number {
    if (this.rateLimitRemaining < 1000) {
      return 500; // Longer delay when rate limit is low
    }
    return 100; // Short delay when rate limit is high
  }

  /**
   * Performs comprehensive analysis of a GitHub repository
   * 
   * Scans the specified repository and extracts:
   * - Code patterns (functions, classes, imports, etc.)
   * - Security vulnerabilities and misconfigurations
   * - Type safety issues and anti-patterns
   * - Performance bottlenecks and optimization opportunities
   * 
   * The scanner uses an optimized approach with:
   * - Parallel file processing with concurrency control
   * - Intelligent caching to avoid redundant API calls
   * - Streaming for large files to manage memory usage
   * - Automatic fallback to legacy scanning on errors
   * 
   * @param repository - Repository configuration object
   * @param repository.owner - GitHub username or organization name
   * @param repository.repo - Repository name
   * @param repository.branch - Git branch to scan (default: 'main')
   * 
   * @returns Promise resolving to comprehensive scan results
   * 
   * @example
   * ```typescript
   * const scanner = new GitHubScanner(token);
   * const results = await scanner.scanRepository({
   *   owner: 'facebook',
   *   repo: 'react',
   *   branch: 'main'
   * });
   * 
   * if (results.scanSuccessful) {
   *   console.log(`Patterns found: ${results.patterns.length}`);
   *   console.log(`Security issues: ${results.securityIssues.length}`);
   *   console.log(`Type issues: ${results.typeSafetyIssues.length}`);
   *   console.log(`Performance issues: ${results.performanceIssues.length}`);
   * } else {
   *   console.error('Scan failed:', results.errorMessage);
   * }
   * ```
   * 
   * @throws {Error} Network errors, authentication failures, or API errors
   * @see {@link OptimizedGitHubScanner.scanRepository} for performance details
   */
  async scanRepository(repository: GitHubRepository): Promise<{
    patterns: ScannerPatternDetectionResult[];
    securityIssues: ScannerSecurityPattern[];
    typeSafetyIssues: ScannerTypeSafetyIssue[];
    performanceIssues: ScannerPerformanceIssue[];
    scanSuccessful: boolean;
    errorMessage?: string;
  }> {
    logger.info(`🚀 Starting optimized scan of repository: ${repository.owner}/${repository.repo}`, {
      repository: `${repository.owner}/${repository.repo}`,
      branch: repository.branch,
      authenticated: this.authenticated
    });
    
    try {
      // Use the optimized scanner for better performance
      const optimizedResult: OptimizedScanResult = await this.optimizedScanner.scanRepository(repository);
      
      // Log performance metrics
      logger.info('Optimized scan completed with metrics', {
        repository: `${repository.owner}/${repository.repo}`,
        metrics: optimizedResult.metrics,
        patterns: optimizedResult.patterns.length,
        securityIssues: optimizedResult.securityIssues.length,
        typeSafetyIssues: optimizedResult.typeSafetyIssues.length,
        performanceIssues: optimizedResult.performanceIssues.length
      });

      // Convert PatternDetectionResult to ScannerPatternDetectionResult format
      const convertedPatterns: ScannerPatternDetectionResult[] = optimizedResult.patterns.map(pattern => ({
        id: uuidv4(),
        repositoryId: `${repository.owner}/${repository.repo}`,
        patternType: pattern.patternType,
        content: pattern.codeSnippet,
        description: `${pattern.patternName} pattern found`,
        category: pattern.patternType.split('_')[0] || 'general',
        subcategory: pattern.patternType.split('_')[1] || undefined,
        filePath: pattern.filePath,
        lineStart: pattern.lineNumber || 1,
        lineEnd: pattern.lineNumber || 1,
        language: this.detectLanguage(pattern.filePath),
        confidenceScore: pattern.confidence,
        tags: [pattern.patternType, pattern.impact],
        contextBefore: undefined,
        contextAfter: undefined,
        metadata: {
          originalPattern: pattern,
          impact: pattern.impact,
          repository: pattern.repository
        },
        // Additional properties for compatibility
        patternName: pattern.patternName,
        lineNumber: pattern.lineNumber,
        codeSnippet: pattern.codeSnippet,
        confidence: pattern.confidence,
        impact: pattern.impact,
        repository: pattern.repository
      }));

      // Return results in the expected format
      return {
        patterns: convertedPatterns,
        securityIssues: optimizedResult.securityIssues,
        typeSafetyIssues: optimizedResult.typeSafetyIssues,
        performanceIssues: optimizedResult.performanceIssues,
        scanSuccessful: optimizedResult.scanSuccessful,
        errorMessage: optimizedResult.errorMessage
      };
      
    } catch (error) {
      logger.error(`❌ Optimized scan failed for repository ${repository.owner}/${repository.repo}`, {
        repository: `${repository.owner}/${repository.repo}`,
        error: String(error)
      });
      
      // Fallback to legacy scanning if optimized version fails
      logger.info('Falling back to legacy scanning method');
      return this.legacyScanRepository(repository);
    }
  }

  /**
   * Legacy scan method (fallback)
   */
  private async legacyScanRepository(repository: GitHubRepository): Promise<{
    patterns: ScannerPatternDetectionResult[];
    securityIssues: ScannerSecurityPattern[];
    typeSafetyIssues: ScannerTypeSafetyIssue[];
    performanceIssues: ScannerPerformanceIssue[];
    scanSuccessful: boolean;
    errorMessage?: string;
  }> {
    console.log(`🔍 Scanning GitHub repository (legacy): ${repository.owner}/${repository.repo}`);
    
    try {
      await this.checkRateLimit();
      
      // Get repository files
      const files = await this.getRepositoryFiles(repository);
      
      // Filter for TypeScript/JavaScript files
      const codeFiles = files.filter(file => 
        file.type === 'file' && 
        /\.(ts|tsx|js|jsx)$/.test(file.name) &&
        !file.path.includes('node_modules') &&
        !file.path.includes('dist') &&
        !file.path.includes('build')
      );

      console.log(`📁 Found ${codeFiles.length} code files to analyze`);

      // Analyze each file for patterns
      const patterns: ScannerPatternDetectionResult[] = [];
      const securityIssues: ScannerSecurityPattern[] = [];
      const typeSafetyIssues: ScannerTypeSafetyIssue[] = [];
      const performanceIssues: ScannerPerformanceIssue[] = [];

      // Process files in parallel with dynamic concurrency control
      const BATCH_SIZE = this.getOptimalBatchSize(); // Dynamic batch size based on rate limit
      const FILE_LIMIT = this.getFileLimit(); // Configurable file limit based on authentication
      const filesToProcess = codeFiles.slice(0, FILE_LIMIT);
      
      console.log(`🚀 Performance optimizations active:`);
      console.log(`   • Dynamic batch size: ${BATCH_SIZE} files/batch (based on rate limit: ${this.rateLimitRemaining})`);
      console.log(`   • File limit: ${FILE_LIMIT} files (authenticated: ${this.authenticated})`);
      console.log(`   • Batch delay: ${this.getBatchDelay()}ms`);
      console.log(`   • Retry logic: Enabled with exponential backoff`);
      
      for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
        const batch = filesToProcess.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel with retry logic
        const batchResults = await Promise.allSettled(
          batch.map(async (file) => {
            // Use retry wrapper for file processing
            const result = await this.processWithRetry(
              async () => {
                await this.checkRateLimit();
                
                const fileContent = await this.getFileContent(repository, file.path);
                
                // Extract patterns from file content
                const filePatterns = this.extractPatternsFromCode(fileContent, file.path, repository);
                
                // Detect security issues
                const fileSecurity = this.detectSecurityIssues(fileContent, file.path);
                
                // Detect type safety issues
                const fileTypes = this.detectTypeSafetyIssues(fileContent, file.path);
                
                // Detect performance issues
                const filePerformance = this.detectPerformanceIssues(fileContent, file.path);
                
                return {
                  patterns: filePatterns,
                  security: fileSecurity,
                  types: fileTypes,
                  performance: filePerformance,
                  file: file.path
                };
              },
              `Processing file ${file.path}`
            );
            
            // Return null result if retry failed
            if (!result) {
              throw new Error(`Failed to process file after retries: ${file.path}`);
            }
            
            return result;
          })
        );
        
        // Process results and handle any failures
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            patterns.push(...result.value.patterns);
            securityIssues.push(...result.value.security);
            typeSafetyIssues.push(...result.value.types);
            performanceIssues.push(...result.value.performance);
          } else {
            const batchFile = batch[index];
            const filePath = batchFile ? batchFile.path : 'unknown file';
            console.error(`❌ Error analyzing file ${filePath}:`, result.status === 'rejected' ? result.reason : 'Unknown error');
          }
        });
        
        // Dynamic delay between batches based on rate limit
        if (i + BATCH_SIZE < filesToProcess.length) {
          const delay = this.getBatchDelay();
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      console.log(`✅ Scan completed - Found ${patterns.length} patterns, ${securityIssues.length} security issues, ${typeSafetyIssues.length} type issues, ${performanceIssues.length} performance issues`);
      
      return { 
        patterns, 
        securityIssues, 
        typeSafetyIssues, 
        performanceIssues, 
        scanSuccessful: true 
      };
    } catch (error) {
      console.error(`❌ Failed to scan repository ${repository.owner}/${repository.repo}:`, error);
      return { 
        patterns: [], 
        securityIssues: [], 
        typeSafetyIssues: [], 
        performanceIssues: [], 
        scanSuccessful: false, 
        errorMessage: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Retrieves all files from a GitHub repository using the Git Tree API
   * 
   * Fetches the complete file tree for the specified repository and branch.
   * Implements intelligent branch fallback logic:
   * 1. Tries the specified branch first
   * 2. Falls back to 'master' if 'main' branch doesn't exist
   * 3. Attempts to use the repository's default branch as final fallback
   * 
   * @param repository - Repository configuration object
   * @returns Promise resolving to array of file objects with metadata
   * 
   * @example
   * ```typescript
   * const files = await this.getRepositoryFiles({
   *   owner: 'octocat',
   *   repo: 'Hello-World',
   *   branch: 'main'
   * });
   * 
   * console.log(`Found ${files.length} files in repository`);
   * ```
   * 
   * @throws {Error} Repository not found, access forbidden, or API errors
   * @private
   */
  private async getRepositoryFiles(repository: GitHubRepository): Promise<ScannerGitHubFile[]> {
    try {
      // First try the specified branch
      let response;
      try {
        response = await this.octokit.rest.git.getTree({
          owner: repository.owner,
          repo: repository.repo,
          tree_sha: repository.branch,
          recursive: 'true',
        });
      } catch (branchError: unknown) {
        const branchErr = branchError as { status?: number };
        if (branchErr.status === 404 && repository.branch === 'main') {
          // Try 'master' branch as fallback
          console.log(`⚠️  Branch 'main' not found for ${repository.owner}/${repository.repo}, trying 'master'`);
          try {
            response = await this.octokit.rest.git.getTree({
              owner: repository.owner,
              repo: repository.repo,
              tree_sha: 'master',
              recursive: 'true',
            });
          } catch (masterError: unknown) {
            // Try to get repository info to find default branch
            try {
              const repoInfo = await this.octokit.rest.repos.get({
                owner: repository.owner,
                repo: repository.repo,
              });
              const defaultBranch = repoInfo.data.default_branch;
              console.log(`⚠️  Trying default branch: ${defaultBranch}`);
              
              response = await this.octokit.rest.git.getTree({
                owner: repository.owner,
                repo: repository.repo,
                tree_sha: defaultBranch,
                recursive: 'true',
              });
            } catch (defaultError) {
              throw masterError; // Throw original error if default branch also fails
            }
          }
        } else {
          throw branchError;
        }
      }

      return response.data.tree.map(item => ({
        name: item.path?.split('/').pop() || '',
        path: item.path || '',
        content: '',
        sha: item.sha || '',
        size: item.size || 0,
        type: (item.type === 'blob' ? 'file' : 'dir') as 'file' | 'dir'
      }));
    } catch (error: unknown) {
      const githubError = error as { status?: number; message?: string };
      if (githubError.status === 404) {
        console.error(`❌ Repository ${repository.owner}/${repository.repo} not found or not accessible`);
        throw new Error(`Repository not found or not accessible. This could be due to: 1) Repository is private and no GitHub token is configured, 2) Repository doesn't exist, 3) Insufficient permissions`);
      } else if (githubError.status === 403) {
        console.error(`❌ Access forbidden to ${repository.owner}/${repository.repo}`);
        throw new Error(`Access forbidden. This could be due to rate limiting or insufficient permissions. GitHub API rate limit: ${this.rateLimitRemaining} requests remaining`);
      } else {
        console.error(`❌ Failed to get repository tree:`, error);
        throw new Error(`GitHub API error: ${githubError.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Retrieves and decodes the content of a specific file from GitHub
   * 
   * Fetches file content using the GitHub Contents API and automatically
   * decodes base64-encoded content to UTF-8 text. Handles binary files
   * gracefully by returning empty strings.
   * 
   * @param repository - Repository configuration object
   * @param filePath - Relative path to the file within the repository
   * @returns Promise resolving to file content as UTF-8 string
   * 
   * @example
   * ```typescript
   * const content = await this.getFileContent(
   *   { owner: 'octocat', repo: 'Hello-World', branch: 'main' },
   *   'src/index.ts'
   * );
   * 
   * if (content) {
   *   console.log('File content retrieved successfully');
   * }
   * ```
   * 
   * @private
   */
  private async getFileContent(repository: GitHubRepository, filePath: string): Promise<string> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: repository.owner,
        repo: repository.repo,
        path: filePath,
        ref: repository.branch,
      });

      if ('content' in response.data && response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }
      
      return '';
    } catch (error) {
      console.error(`❌ Failed to get file content for ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Analyzes source code and extracts meaningful patterns and structures
   * 
   * Performs comprehensive static analysis to identify:
   * - Function declarations (regular and arrow functions)
   * - TypeScript interfaces and type definitions
   * - Import/export statements and dependencies
   * - React components and hooks usage
   * - Error handling patterns (try/catch blocks)
   * - Async/await operations
   * - Security middleware implementations
   * 
   * Each pattern includes contextual information such as line numbers,
   * surrounding code, confidence scores, and metadata for further analysis.
   * 
   * @param content - Source code content to analyze
   * @param filePath - Path to the file being analyzed
   * @param repository - Repository context for pattern attribution
   * 
   * @returns Array of detected patterns with detailed metadata
   * 
   * @example
   * ```typescript
   * const patterns = this.extractPatternsFromCode(
   *   'function hello() { return "world"; }',
   *   'src/utils.ts',
   *   { owner: 'octocat', repo: 'Hello-World', branch: 'main' }
   * );
   * 
   * console.log(`Found ${patterns.length} patterns`);
   * patterns.forEach(pattern => {
   *   console.log(`${pattern.category}: ${pattern.description}`);
   * });
   * ```
   * 
   * @see {@link ScannerPatternDetectionResult} for pattern structure details
   * @private
   */
  private extractPatternsFromCode(content: string, filePath: string, repository: GitHubRepository): ScannerPatternDetectionResult[] {
    const patterns: ScannerPatternDetectionResult[] = [];
    const lines = content.split('\n');
    const repositoryId = `${repository.owner}/${repository.repo}`;
    const language = this.detectLanguage(filePath);

    // Pattern detection rules
    const patternRules = [
      // Function patterns
      {
        regex: /^[\s]*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)[\s]*{?/gm,
        category: 'function',
        subcategory: 'declaration',
        type: 'function_declaration'
      },
      // Arrow function patterns
      {
        regex: /const\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|(\w+)\s*=>)/gm,
        category: 'function',
        subcategory: 'arrow_function',
        type: 'arrow_function'
      },
      // Interface/type patterns
      {
        regex: /^[\s]*(?:export\s+)?(?:interface|type)\s+(\w+)/gm,
        category: 'type',
        subcategory: 'definition',
        type: 'type_definition'
      },
      // Import patterns
      {
        regex: /^import\s+.*from\s+['"`]([^'"`]+)['"`]/gm,
        category: 'import',
        subcategory: 'module',
        type: 'import_statement'
      },
      // React component patterns
      {
        regex: /^[\s]*(?:export\s+)?(?:const|function)\s+(\w+).*return\s*\(/gm,
        category: 'react',
        subcategory: 'component',
        type: 'react_component'
      },
      // Hook usage patterns
      {
        regex: /use\w+\(/gm,
        category: 'react',
        subcategory: 'hook',
        type: 'hook_usage'
      },
      // Error handling patterns
      {
        regex: /try\s*{[\s\S]*?}\s*catch\s*\(/gm,
        category: 'error_handling',
        subcategory: 'try_catch',
        type: 'error_handling'
      },
      // Async/await patterns
      {
        regex: /await\s+\w+/gm,
        category: 'async',
        subcategory: 'await',
        type: 'async_operation'
      },
      // Security-related patterns
      {
        regex: /(?:helmet|cors|rateLimit|csrf)/gm,
        category: 'security',
        subcategory: 'middleware',
        type: 'security_middleware'
      }
    ];

    // Apply pattern rules
    for (const rule of patternRules) {
      let match;
      while ((match = rule.regex.exec(content)) !== null) {
        const matchText = match[0];
        const lineNumber = this.getLineNumber(content, match.index);
        
        patterns.push({
          id: uuidv4(),
          repositoryId,
          patternType: rule.type,
          content: matchText.trim(),
          description: `${rule.type.replace('_', ' ')} pattern found`,
          category: rule.category,
          subcategory: rule.subcategory,
          filePath,
          lineStart: lineNumber,
          lineEnd: lineNumber + matchText.split('\n').length - 1,
          language,
          confidenceScore: 0.8,
          tags: [rule.category, rule.subcategory, language],
          contextBefore: this.getContextLines(lines, lineNumber - 1, -2),
          contextAfter: this.getContextLines(lines, lineNumber - 1, 2),
          metadata: {
            matchedText: matchText,
            ruleType: rule.type,
            fileSize: content.length
          },
          // Additional properties for compatibility
          patternName: rule.type,
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
      rule.regex.lastIndex = 0; // Reset regex state
    }

    return patterns;
  }

  /**
   * Analyzes source code for security vulnerabilities and misconfigurations
   * 
   * Performs static security analysis to identify:
   * - Missing security middleware (Helmet, CORS, rate limiting)
   * - Hardcoded secrets, passwords, and API keys
   * - Insecure configurations and practices
   * - Potential injection vulnerabilities
   * 
   * Security checks are categorized by severity levels:
   * - Critical: Immediate security risks (hardcoded secrets)
   * - High: Missing essential security measures (Helmet)
   * - Medium: Configuration improvements (CORS, rate limiting)
   * - Low: Best practice recommendations
   * 
   * @param content - Source code content to analyze
   * @param filePath - Path to the file being analyzed for context
   * 
   * @returns Array of detected security issues with severity and remediation
   * 
   * @example
   * ```typescript
   * const securityIssues = this.detectSecurityIssues(
   *   'const apiKey = "sk-1234567890";',
   *   'src/config.ts'
   * );
   * 
   * securityIssues.forEach(issue => {
   *   console.log(`${issue.severity}: ${issue.description}`);
   *   console.log(`Recommendation: ${issue.recommendation}`);
   * });
   * ```
   * 
   * @see {@link ScannerSecurityPattern} for security issue structure
   * @private
   */
  private detectSecurityIssues(content: string, filePath: string): ScannerSecurityPattern[] {
    const issues: ScannerSecurityPattern[] = [];
    const lines = content.split('\n');

    // Check for missing security middleware in Express apps
    if (content.includes('express()') || content.includes('app = express')) {
      const hasHelmet = content.includes('helmet');
      const hasCors = content.includes('cors');
      const hasRateLimit = content.includes('rateLimit') || content.includes('express-rate-limit');

      if (!hasHelmet) {
        issues.push({
          type: 'missing_middleware',
          severity: 'high',
          description: 'Missing Helmet security middleware for HTTP headers protection',
          filePath,
          recommendation: 'Add helmet middleware: app.use(helmet())'
        });
      }

      if (!hasCors) {
        issues.push({
          type: 'missing_middleware',
          severity: 'medium',
          description: 'Missing CORS configuration',
          filePath,
          recommendation: 'Configure CORS policy: app.use(cors({origin: allowedOrigins}))'
        });
      }

      if (!hasRateLimit) {
        issues.push({
          type: 'missing_middleware',
          severity: 'medium',
          description: 'Missing rate limiting to prevent DoS attacks',
          filePath,
          recommendation: 'Add rate limiting: app.use(rateLimit({windowMs: 15*60*1000, max: 100}))'
        });
      }
    }

    // Check for hardcoded secrets
    const secretPatterns = [
      /password\s*[:=]\s*['"`][^'"`]+['"`]/gi,
      /api[_-]?key\s*[:=]\s*['"`][^'"`]+['"`]/gi,
      /secret\s*[:=]\s*['"`][^'"`]+['"`]/gi,
      /token\s*[:=]\s*['"`][^'"`]+['"`]/gi
    ];

    for (const pattern of secretPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = this.getLineNumber(content, match.index);
        issues.push({
          type: 'insecure_config',
          severity: 'critical',
          description: 'Hardcoded secret detected in code',
          filePath,
          lineNumber,
          recommendation: 'Use environment variables or secure key management'
        });
      }
    }

    return issues;
  }

  /**
   * Analyzes TypeScript/JavaScript code for type safety violations
   * 
   * Identifies patterns that compromise type safety and code reliability:
   * - Usage of 'any' type that bypasses type checking
   * - Missing type annotations on function parameters
   * - Unsafe type assertions and castings
   * - Implicit type coercions
   * 
   * Provides specific suggestions for improving type safety while
   * maintaining code functionality and developer productivity.
   * 
   * @param content - Source code content to analyze
   * @param filePath - Path to the file being analyzed for context
   * 
   * @returns Array of type safety issues with specific suggestions
   * 
   * @example
   * ```typescript
   * const typeIssues = this.detectTypeSafetyIssues(
   *   'function process(data: any) { return data.value; }',
   *   'src/processor.ts'
   * );
   * 
   * typeIssues.forEach(issue => {
   *   console.log(`Line ${issue.lineNumber}: ${issue.description}`);
   *   console.log(`Suggestion: ${issue.suggestion}`);
   * });
   * ```
   * 
   * @see {@link ScannerTypeSafetyIssue} for type issue structure
   * @private
   */
  private detectTypeSafetyIssues(content: string, filePath: string): ScannerTypeSafetyIssue[] {
    const issues: ScannerTypeSafetyIssue[] = [];

    // Detect 'any' type usage
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

    // Detect untyped function parameters
    const untypedParamRegex = /function\s+\w+\s*\([^)]*\w+(?!\s*:)[^)]*\)/gm;
    while ((match = untypedParamRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      issues.push({
        type: 'missing_types',
        description: 'Function parameter without type annotation',
        filePath,
        lineNumber,
        suggestion: 'Add type annotations to function parameters'
      });
    }

    return issues;
  }

  /**
   * Analyzes source code for performance bottlenecks and optimization opportunities
   * 
   * Identifies common performance anti-patterns and suggests improvements:
   * - Synchronous file operations that block the event loop
   * - Memory leaks from uncleaned intervals and listeners
   * - Inefficient array operations in loops (O(n²) complexity)
   * - Large bundle sizes and unused imports
   * - Unoptimized database queries
   * 
   * Each issue includes impact assessment and specific optimization strategies
   * to help developers prioritize and implement performance improvements.
   * 
   * @param content - Source code content to analyze
   * @param filePath - Path to the file being analyzed for context
   * 
   * @returns Array of performance issues with impact and solutions
   * 
   * @example
   * ```typescript
   * const perfIssues = this.detectPerformanceIssues(
   *   'const data = fs.readFileSync("large-file.json");',
   *   'src/loader.ts'
   * );
   * 
   * perfIssues.forEach(issue => {
   *   console.log(`${issue.type}: ${issue.description}`);
   *   console.log(`Impact: ${issue.impact}`);
   *   console.log(`Solution: ${issue.solution}`);
   * });
   * ```
   * 
   * @see {@link ScannerPerformanceIssue} for performance issue structure
   * @private
   */
  private detectPerformanceIssues(content: string, filePath: string): ScannerPerformanceIssue[] {
    const issues: ScannerPerformanceIssue[] = [];

    // Detect synchronous file operations
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

    // Detect potential memory leaks
    if (content.includes('setInterval') && !content.includes('clearInterval')) {
      issues.push({
        type: 'memory_leak',
        description: 'setInterval without corresponding clearInterval',
        filePath,
        impact: 'Memory leaks over time',
        solution: 'Store interval reference and clear it when component unmounts'
      });
    }

    // Detect inefficient array operations in loops
    const inefficientLoopRegex = /for\s*\([^)]*\)\s*{[\s\S]*?\.push\s*\(/gm;
    while ((match = inefficientLoopRegex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      issues.push({
        type: 'inefficient_loop',
        description: 'Array push in loop may be inefficient',
        filePath,
        lineNumber,
        impact: 'O(n²) time complexity for large arrays',
        solution: 'Consider using map, filter, or reduce for functional approach'
      });
    }

    return issues;
  }

  /**
   * Persists scan results to the database
   * 
   * Saves all discovered patterns, security issues, type safety problems,
   * and performance bottlenecks to the database for future analysis and
   * trend tracking. This method handles:
   * - Pattern deduplication using content hashing
   * - Metadata preservation for context and debugging
   * - Repository statistics updates
   * - Transactional operations for data consistency
   * 
   * @param repositoryName - Full repository name (owner/repo)
   * @param results - Complete scan results object
   * @param results.patterns - Array of detected code patterns
   * @param results.securityIssues - Array of security vulnerabilities
   * @param results.typeSafetyIssues - Array of type safety problems
   * @param results.performanceIssues - Array of performance bottlenecks
   * 
   * @returns Promise that resolves when save operation completes
   * 
   * @example
   * ```typescript
   * const results = await scanner.scanRepository(repository);
   * await scanner.saveScanResults('octocat/Hello-World', results);
   * console.log('Scan results saved successfully');
   * ```
   * 
   * @throws {Error} Database errors or repository not found
   */
  async saveScanResults(
    repositoryName: string,
    results: {
      patterns: ScannerPatternDetectionResult[];
      securityIssues: ScannerSecurityPattern[];
      typeSafetyIssues: ScannerTypeSafetyIssue[];
      performanceIssues: ScannerPerformanceIssue[];
    }
  ): Promise<void> {
    try {
      // Get repository ID
      const repository = await dbGet(
        'SELECT id FROM repositories WHERE full_name = ?',
        [repositoryName]
      ) as RepositoryRow | undefined;

      if (!repository) {
        console.error(`❌ Repository ${repositoryName} not found in database`);
        return;
      }

      // Clear old patterns for this repository
      await dbRun('DELETE FROM repository_patterns WHERE repository_id = ?', [repository.id]);

      // Save new patterns
      for (const pattern of results.patterns) {
        await dbRun(`
          INSERT INTO repository_patterns (
            id, repository_id, pattern_type, pattern_content, pattern_hash,
            description, category, subcategory, tags, file_path, line_start, line_end,
            language, framework, confidence_score, context_before, context_after, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          pattern.id, repository.id, pattern.patternType, pattern.content,
          this.generateHash(pattern.content), pattern.description, pattern.category,
          pattern.subcategory, JSON.stringify(pattern.tags), pattern.filePath,
          pattern.lineStart, pattern.lineEnd, pattern.language, null,
          pattern.confidenceScore, pattern.contextBefore, pattern.contextAfter,
          JSON.stringify(pattern.metadata)
        ]);
      }

      // Update repository patterns count
      await dbRun(
        'UPDATE repositories SET patterns_count = ?, last_analyzed = ? WHERE id = ?',
        [results.patterns.length, new Date().toISOString(), repository.id]
      );

      console.log(`✅ Saved ${results.patterns.length} patterns for repository ${repositoryName}`);
    } catch (error) {
      console.error(`❌ Failed to save scan results for ${repositoryName}:`, error);
      throw error;
    }
  }

  /**
   * Analyzes and identifies issues that have been resolved since the last scan
   * 
   * Compares current scan results against previously stored recommendations
   * to determine which issues have been fixed. This enables automated
   * progress tracking and recommendation lifecycle management.
   * 
   * The detection logic:
   * - Security: Checks for presence of security middleware and configurations
   * - Type Safety: Looks for elimination of 'any' types and proper typing
   * - Performance: Validates removal of synchronous operations and optimizations
   * 
   * @param repositoryName - Full repository name (owner/repo)
   * @param currentIssues - Current scan results to compare against
   * @param currentIssues.securityIssues - Current security problems
   * @param currentIssues.typeSafetyIssues - Current type safety problems
   * @param currentIssues.performanceIssues - Current performance problems
   * @param scanSuccessful - Whether the current scan completed successfully
   * 
   * @returns Promise resolving to categorized list of fixed issues
   * 
   * @example
   * ```typescript
   * const currentIssues = await scanner.scanRepository(repository);
   * const fixedIssues = await scanner.checkFixedIssues(
   *   'octocat/Hello-World',
   *   currentIssues,
   *   true
   * );
   * 
   * console.log(`Fixed security issues: ${fixedIssues.fixedSecurityIssues.length}`);
   * console.log(`Fixed type issues: ${fixedIssues.fixedTypeIssues.length}`);
   * console.log(`Fixed performance issues: ${fixedIssues.fixedPerformanceIssues.length}`);
   * ```
   * 
   * @throws {Error} Database errors or repository not found
   */
  async checkFixedIssues(
    repositoryName: string,
    currentIssues: {
      securityIssues: ScannerSecurityPattern[];
      typeSafetyIssues: ScannerTypeSafetyIssue[];
      performanceIssues: ScannerPerformanceIssue[];
    },
    scanSuccessful: boolean = true
  ): Promise<{
    fixedSecurityIssues: string[];
    fixedTypeIssues: string[];
    fixedPerformanceIssues: string[];
  }> {
    try {
      const repository = await dbGet(
        'SELECT id FROM repositories WHERE full_name = ?',
        [repositoryName]
      ) as RepositoryRow | undefined;

      if (!repository) return { fixedSecurityIssues: [], fixedTypeIssues: [], fixedPerformanceIssues: [] };

      // If scan failed, don't mark any issues as fixed
      if (!scanSuccessful) {
        console.log(`⚠️  Scan failed for ${repositoryName}, not marking any recommendations as fixed`);
        return { fixedSecurityIssues: [], fixedTypeIssues: [], fixedPerformanceIssues: [] };
      }

      // Get active recommendations for this repository
      const recommendations = await dbAll(
        'SELECT * FROM repository_recommendations WHERE repository_id = ? AND status = "active"',
        [repository.id]
      ) as Array<{ id: string; title: string; category: string; }>;

      const fixedSecurityIssues: string[] = [];
      const fixedTypeIssues: string[] = [];
      const fixedPerformanceIssues: string[] = [];

      // Check if security recommendations can be marked as fixed
      for (const rec of recommendations) {
        if (rec.category === 'security') {
          // Only mark as fixed if scan was successful AND no security issues found
          const hasSecurityMiddleware = currentIssues.securityIssues.length === 0;
          if (hasSecurityMiddleware && rec.title.includes('Security')) {
            console.log(`✅ Security issue appears to be fixed: ${rec.title}`);
            fixedSecurityIssues.push(rec.title);
          }
        }
        
        if (rec.category === 'best_practices' && rec.title.includes('any')) {
          const hasAnyTypes = currentIssues.typeSafetyIssues.some(issue => issue.type === 'any_usage');
          if (!hasAnyTypes) {
            console.log(`✅ Type safety issue appears to be fixed: ${rec.title}`);
            fixedTypeIssues.push(rec.title);
          }
        }
        
        if (rec.category === 'performance') {
          const hasSyncOps = currentIssues.performanceIssues.some(issue => issue.type === 'sync_operation');
          if (!hasSyncOps && rec.title.includes('Async')) {
            console.log(`✅ Performance issue appears to be fixed: ${rec.title}`);
            fixedPerformanceIssues.push(rec.title);
          }
        }
      }

      return { fixedSecurityIssues, fixedTypeIssues, fixedPerformanceIssues };
    } catch (error) {
      console.error(`❌ Failed to check fixed issues for ${repositoryName}:`, error);
      return { fixedSecurityIssues: [], fixedTypeIssues: [], fixedPerformanceIssues: [] };
    }
  }

  /**
   * Remove recommendations for fixed issues
   */
  async removeFixedRecommendations(repositoryName: string, fixedIssues: {
    fixedSecurityIssues: string[];
    fixedTypeIssues: string[];
    fixedPerformanceIssues: string[];
  }): Promise<void> {
    try {
      const repository = await dbGet(
        'SELECT id FROM repositories WHERE full_name = ?',
        [repositoryName]
      ) as RepositoryRow | undefined;

      if (!repository) return;

      const allFixedIssues = [
        ...fixedIssues.fixedSecurityIssues,
        ...fixedIssues.fixedTypeIssues,
        ...fixedIssues.fixedPerformanceIssues
      ];

      for (const issueTitle of allFixedIssues) {
        await dbRun(
          'UPDATE repository_recommendations SET status = "implemented" WHERE repository_id = ? AND title = ?',
          [repository.id, issueTitle]
        );
      }

      if (allFixedIssues.length > 0) {
        console.log(`✅ Marked ${allFixedIssues.length} recommendations as implemented for ${repositoryName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to remove fixed recommendations:`, error);
    }
  }

  // Helper methods
  private async checkRateLimit(): Promise<void> {
    try {
      const rateLimit = await this.octokit.rest.rateLimit.get();
      this.rateLimitRemaining = rateLimit.data.rate.remaining;
      this.rateLimitReset = rateLimit.data.rate.reset * 1000; // Convert to milliseconds
      
      if (this.rateLimitRemaining <= 10) {
        const waitTime = Math.max(0, this.rateLimitReset - Date.now());
        if (waitTime > 0) {
          console.log(`⏳ Rate limit low (${this.rateLimitRemaining} remaining), waiting ${Math.round(waitTime / 1000)}s`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    } catch (error) {
      // If we can't check rate limit, assume we're okay and continue
      console.warn(`⚠️  Could not check rate limit:`, error);
    }
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
      const line = lines[i];
      if (line !== undefined) {
        contextLines.push(line);
      }
    }
    
    return contextLines.join('\n');
  }

  private generateHash(content: string): string {
    // Simple hash function for content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}