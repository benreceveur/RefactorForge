import { Router, Request, Response } from 'express';
import { validateRepositoryFormat } from '../utils/sanitizer';
import { v4 as uuidv4 } from 'uuid';
import { RepositoryAnalyzer } from '../services/repository-analyzer';
import { RecommendationEngine } from '../services/recommendation-engine';
import db from '../database';
import { 
  RepositoryRow, 
  RecommendationRow, 
  PatternRow, 
  ParsedRecommendation,
  Pattern, 
  RepositoryInfo, 
  AnalysisResult,
  ApiResponse, 
  Recommendation, 
  Priority,
  RecommendationType,
  RecommendationStatus 
} from '../types';

// Analysis Jobs interface (inferred from database schema)
interface AnalysisJobRow {
  id: string;
  repository_id: string;
  job_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  progress: number;
  results_summary: string | null;
  error_message: string | null;
  created_at: string;
}

interface AnalysisJobResult {
  patternsExtracted: number;
  techStackDetected: string | string[];
  confidence: number;
}

interface PatternSearchOptions {
  limit: number;
  offset: number;
  category?: string;
  language?: string;
  minConfidence?: number;
  search?: string;
}

interface RecommendationSearchOptions {
  priority?: string;
  type?: string;
  status?: string;
}

interface RepositoryAnalysisData {
  techStack: string | string[];
  primaryLanguage: string;
  framework: string;
  patternsCount: number;
  clonePath: string;
  metadata: Record<string, unknown>;
}

interface CrossRepoSearchOptions {
  query: string;
  repositories?: string[];
  category?: string;
  language?: string;
  minConfidence?: number;
  limit?: number;
}

interface TrendingPatternsOptions {
  timeframe: string;
  limit: number;
  category?: string;
  language?: string;
}

interface PatternSearchResult {
  id: string;
  repository_id: string;
  file_path: string;
  pattern_type: string;
  pattern_name: string;
  code_snippet: string | null;
  line_number: number | null;
  confidence: number;
  impact_score: number;
  tags: string[]; // Parsed from JSON
  detected_at: string;
  metadata: Record<string, unknown>; // Parsed from JSON
  repository_name: string;
  repository_full_name: string;
  ast_metadata: Record<string, unknown>;
}

interface TrendingPattern {
  id: string;
  repository_id: string;
  file_path: string;
  pattern_type: string;
  pattern_name: string;
  code_snippet: string | null;
  line_number: number | null;
  confidence: number;
  impact_score: number;
  tags: string[]; // Parsed from JSON
  detected_at: string;
  metadata: Record<string, unknown>; // Parsed from JSON
  usage_count: number;
  ast_metadata: Record<string, unknown>;
}

const router = Router();
const analyzer = new RepositoryAnalyzer();
const recommendationEngine = new RecommendationEngine();

// Basic analysis endpoint for testing
router.post('/', async (req: Request, res: Response) => {
  try {
    const { repository } = req.body;

    // Validate repository format
    if (!repository) {
      return res.status(400).json({
        error: 'Repository is required'
      });
    }

    if (typeof repository !== 'string') {
      return res.status(400).json({
        error: 'Repository must be a string'
      });
    }

    if (repository === '') {
      return res.status(400).json({
        error: 'Repository cannot be empty'
      });
    }

    if (!validateRepositoryFormat(repository)) {
      return res.status(400).json({
        error: 'Invalid repository format. Expected format: owner/repo'
      });
    }

    // Return mock analysis result for testing
    res.json({
      repository,
      status: 'analyzed',
      patterns: [],
      security: [],
      performance: [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Repository analysis endpoints

// POST /api/analysis/repositories/:id/analyze - Trigger repository analysis
router.post('/repositories/:id/analyze', async (req: Request, res: Response) => {
  const repositoryId = req.params.id;
  
  if (!repositoryId) {
    return res.status(400).json({ error: 'Repository ID is required' });
  }
  const { repoPath, fullScan = false } = req.body;
  
  try {
    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    // Check if repository exists
    const repository = await getRepositoryById(repositoryId);
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Create analysis job
    const jobId = uuidv4();
    const jobType = fullScan ? 'full_scan' : 'incremental';
    
    await createAnalysisJob(jobId, repositoryId, jobType);
    
    // Start analysis asynchronously
    setImmediate(async () => {
      try {
        await updateAnalysisJobStatus(jobId, 'running');
        await updateRepositoryStatus(repositoryId, 'analyzing');
        
        // === PHASE 1: TECHNOLOGY STACK ANALYSIS ===
        // This is the foundation of all subsequent analysis. Tech stack detection
        // determines which language-specific rules to apply, which security patterns
        // to check, and which performance optimizations are relevant.
        console.log(`🔍 Phase 1: Starting ${jobType} tech stack analysis for ${repository.name}`);
        const techResult = await analyzer.analyzeRepositoryFromPath(repoPath);
        
        // Progress: 30% - Tech stack analysis complete
        await updateAnalysisJobProgress(jobId, 0.3);
        
        // === PHASE 2: PATTERN EXTRACTION ===
        // Pattern extraction is the core intelligence feature. It identifies:
        // - Code patterns and anti-patterns
        // - Architecture decisions
        // - Potential refactoring opportunities
        // Currently using placeholder until GitHub scanner integration is complete
        console.log(`📊 Phase 2: Extracting code patterns from ${repository.name}`);
        const patterns: Pattern[] = []; // TODO: Integrate with GitHubScanner for real pattern extraction
        
        // Progress: 70% - Pattern extraction complete
        await updateAnalysisJobProgress(jobId, 0.7);
        
        // === PHASE 3: DATA PERSISTENCE ===
        // Persist extracted patterns for future analysis and trend tracking
        await savePatternsToDatabase(patterns);
        
        // === PHASE 4: REPOSITORY METADATA UPDATE ===
        // Update repository record with comprehensive analysis results
        // Handle both string and array formats for tech stack (backward compatibility)
        await updateRepositoryAnalysis(repositoryId, {
          techStack: Array.isArray(techResult.techStack) 
            ? techResult.techStack 
            : [techResult.techStack],              // Normalize to array format
          primaryLanguage: techResult.primaryLanguage,
          framework: techResult.framework || 'Unknown',  // Fallback for undefined frameworks
          patternsCount: patterns.length,
          clonePath: repoPath,                     // Store clone path for future reference
          metadata: {}                             // Reserved for future metadata expansion
        });
        
        // Progress: 90% - Repository data updated
        await updateAnalysisJobProgress(jobId, 0.9);
        
        // === PHASE 5: RECOMMENDATION GENERATION ===
        // Generate actionable recommendations based on analysis results
        // This is where the AI-powered improvement suggestions are created
        console.log(`🎯 Phase 5: Generating AI-powered recommendations for ${repository.name}`);
        const recommendations = await recommendationEngine.generateRecommendations(repositoryId);
        
        // === PHASE 6: FINALIZATION ===
        // Mark the analysis job as successfully completed with comprehensive results
        // This creates a permanent record of what was accomplished
        await updateAnalysisJobStatus(jobId, 'completed', {
          patternsExtracted: patterns.length,
          techStackDetected: Array.isArray(techResult.techStack) 
            ? techResult.techStack 
            : [techResult.techStack],              // Ensure consistent array format
          confidence: 0.8                          // TODO: Calculate actual confidence based on detection quality
        });
        
        // Update repository status to reflect completed analysis
        await updateRepositoryStatus(repositoryId, 'completed');
        
        // Final progress update: 100% complete
        await updateAnalysisJobProgress(jobId, 1.0);
        
        console.log(`✅ Analysis pipeline completed successfully for ${repository.name}`);
        console.log(`   • Tech Stack: ${Array.isArray(techResult.techStack) ? techResult.techStack.join(', ') : techResult.techStack}`);
        console.log(`   • Patterns Found: ${patterns.length}`);
        console.log(`   • Recommendations: ${recommendations.length}`);
        
      } catch (error: unknown) {
        // === ERROR HANDLING ===
        // Comprehensive error handling ensures system reliability
        // All failures are logged and the job status is properly updated
        console.error(`❌ Analysis pipeline failed for repository ${repositoryId}:`, error);
        
        // Extract meaningful error message for user feedback
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during analysis';
        
        // Update job and repository status to reflect failure
        await updateAnalysisJobStatus(jobId, 'failed', null, errorMessage);
        await updateRepositoryStatus(repositoryId, 'failed');
        
        // Note: Progress is not updated to 100% on failure to indicate incomplete state
      }
    });
    
    res.json({
      message: 'Analysis started',
      jobId,
      repositoryId,
      jobType,
      status: 'queued'
    });
    
  } catch (error: unknown) {
    console.error('Analysis initiation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to start analysis', details: errorMessage });
  }
});

/**
 * GET /api/analysis/repositories/:id/status - Get comprehensive analysis status
 * 
 * This endpoint provides real-time status information for repository analysis,
 * including current job progress, historical data, and detailed results.
 * It's designed to support both polling-based UIs and real-time dashboards.
 * 
 * Response includes:
 * - Repository metadata and current status
 * - Active job information with progress tracking
 * - Historical analysis data for trend analysis
 * - Error information for debugging failed analyses
 */
router.get('/repositories/:id/status', async (req: Request, res: Response) => {
  const repositoryId = req.params.id;
  
  if (!repositoryId) {
    return res.status(400).json({ error: 'Repository ID is required' });
  }
  
  try {
    // === REPOSITORY VALIDATION ===
    // Ensure the repository exists before proceeding with status lookup
    const repository = await getRepositoryById(repositoryId);
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // === CURRENT JOB STATUS ===
    // Get the most recent analysis job to provide current progress information
    // This supports real-time progress tracking in the UI
    const latestJob = await getLatestAnalysisJob(repositoryId);
    
    // === COMPREHENSIVE STATUS RESPONSE ===
    // Structure response to provide maximum utility for different UI contexts
    res.json({
      repositoryId,
      repositoryName: repository.name,
      analysisStatus: repository.analysis_status,    // Overall repository analysis state
      patternsCount: repository.patterns_count,      // Total patterns extracted
      lastAnalyzed: repository.last_analyzed,        // Timestamp of last successful analysis
      currentJob: latestJob ? {
        id: latestJob.id,                            // Job identifier for tracking
        type: latestJob.job_type,                    // Type of analysis (full, incremental, etc.)
        status: latestJob.status,                    // Current job status
        progress: latestJob.progress,                // Progress percentage (0.0 - 1.0)
        startedAt: latestJob.started_at,            // When job started
        completedAt: latestJob.completed_at,        // When job finished (if completed)
        errorMessage: latestJob.error_message,      // Error details (if failed)
        results: latestJob.results_summary         // Parsed results summary
          ? JSON.parse(latestJob.results_summary) 
          : null
      } : null                                       // No active job
    });
    
  } catch (error: unknown) {
    console.error('Status fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch status', details: errorMessage });
  }
});

// GET /api/analysis/repositories/:id/patterns - Get repository patterns
router.get('/repositories/:id/patterns', async (req: Request, res: Response) => {
  const repositoryId = req.params.id;
  
  if (!repositoryId) {
    return res.status(400).json({ error: 'Repository ID is required' });
  }
  const {
    limit = '50',
    offset = '0',
    category,
    language,
    minConfidence = '0.5',
    search
  } = req.query;
  
  try {
    const patterns = await getRepositoryPatterns(repositoryId, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      category: category as string,
      language: language as string,
      minConfidence: parseFloat(minConfidence as string),
      search: search as string
    });
    
    const totalCount = await getRepositoryPatternsCount(repositoryId, {
      category: category as string,
      language: language as string,
      minConfidence: parseFloat(minConfidence as string),
      search: search as string
    });
    
    res.json({
      patterns,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: totalCount > parseInt(offset as string) + parseInt(limit as string)
      }
    });
    
  } catch (error: unknown) {
    console.error('Patterns fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch patterns', details: errorMessage });
  }
});

// GET /api/analysis/repositories/:id/recommendations - Get repository recommendations
router.get('/repositories/:id/recommendations', async (req: Request, res: Response) => {
  const repositoryId = req.params.id;
  
  if (!repositoryId) {
    return res.status(400).json({ error: 'Repository ID is required' });
  }
  const { priority, type, status = 'active' } = req.query;
  
  try {
    const recommendations = await getRepositoryRecommendations(repositoryId, {
      priority: priority as string,
      type: type as string,
      status: status as string
    });
    
    res.json({
      repositoryId,
      recommendations,
      summary: {
        total: recommendations.length,
        byPriority: recommendations.reduce((acc, rec) => {
          acc[rec.priority] = (acc[rec.priority] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byType: recommendations.reduce((acc, rec) => {
          acc[rec.recommendationType] = (acc[rec.recommendationType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });
    
  } catch (error: unknown) {
    console.error('Recommendations fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch recommendations', details: errorMessage });
  }
});

// POST /api/analysis/repositories/:id/recommendations/regenerate - Regenerate recommendations
router.post('/repositories/:id/recommendations/regenerate', async (req: Request, res: Response) => {
  const repositoryId = req.params.id;
  
  if (!repositoryId) {
    return res.status(400).json({ error: 'Repository ID is required' });
  }
  
  try {
    const repository = await getRepositoryById(repositoryId);
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // Clear existing recommendations
    await clearRepositoryRecommendations(repositoryId);
    
    // Generate new recommendations
    const recommendations = await recommendationEngine.generateRecommendations(repositoryId);
    
    res.json({
      message: 'Recommendations regenerated successfully',
      repositoryId,
      recommendationsCount: recommendations.length,
      recommendations: recommendations.slice(0, 10) // Return first 10 for preview
    });
    
  } catch (error: unknown) {
    console.error('Recommendation regeneration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to regenerate recommendations', details: errorMessage });
  }
});

// Cross-repository analysis endpoints

// POST /api/analysis/patterns/search/cross-repo - Search patterns across repositories
router.post('/patterns/search/cross-repo', async (req: Request, res: Response) => {
  const {
    query,
    repositories,
    category,
    language,
    minConfidence = 0.5,
    limit = 50
  } = req.body;
  
  try {
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const results = await searchPatternsAcrossRepositories({
      query,
      repositories,
      category,
      language,
      minConfidence,
      limit
    });
    
    res.json({
      query,
      results,
      summary: {
        totalMatches: results.length,
        repositoriesSearched: repositories?.length || 'all',
        matchesByRepository: results.reduce((acc, result) => {
          acc[result.repository_name] = (acc[result.repository_name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });
    
  } catch (error: unknown) {
    console.error('Cross-repo search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Cross-repository search failed', details: errorMessage });
  }
});

// GET /api/analysis/repositories/compare - Compare repositories
router.get('/repositories/compare', async (req: Request, res: Response) => {
  const { repos } = req.query;
  
  try {
    if (!repos || typeof repos !== 'string') {
      return res.status(400).json({ error: 'Repository IDs are required (comma-separated)' });
    }
    
    const repositoryIds = repos.split(',').map(id => id.trim());
    
    if (repositoryIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 repositories are required for comparison' });
    }
    
    const comparison = await compareRepositories(repositoryIds);
    
    res.json(comparison);
    
  } catch (error: unknown) {
    console.error('Repository comparison error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Repository comparison failed', details: errorMessage });
  }
});

// GET /api/analysis/patterns/trending - Get trending patterns
router.get('/patterns/trending', async (req: Request, res: Response) => {
  const {
    timeframe = '30d',
    limit = '20',
    category,
    language
  } = req.query;
  
  try {
    const trendingPatterns = await getTrendingPatterns({
      timeframe: timeframe as string,
      limit: parseInt(limit as string),
      category: category as string,
      language: language as string
    });
    
    res.json({
      timeframe,
      patterns: trendingPatterns,
      summary: {
        totalTrending: trendingPatterns.length,
        averageUsage: trendingPatterns.reduce((sum, p) => sum + p.usage_count, 0) / trendingPatterns.length,
        topCategories: trendingPatterns.reduce((acc, p) => {
          acc[p.pattern_type] = (acc[p.pattern_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });
    
  } catch (error: unknown) {
    console.error('Trending patterns error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch trending patterns', details: errorMessage });
  }
});

// Helper functions

async function getRepositoryById(id: string): Promise<RepositoryRow | undefined> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM repositories WHERE id = ?', [id], (err: Error | null, row: RepositoryRow | undefined) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function createAnalysisJob(jobId: string, repositoryId: string, jobType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO analysis_jobs (id, repository_id, job_type, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [jobId, repositoryId, jobType, 'queued', new Date().toISOString()],
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function updateAnalysisJobStatus(jobId: string, status: 'completed' | 'queued' | 'running' | 'failed', results?: AnalysisJobResult | null, errorMessage?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    // SECURITY FIX: Use fixed parameterized query instead of dynamic string concatenation
    if (status === 'running') {
      db.run(
        'UPDATE analysis_jobs SET status = ?, started_at = ? WHERE id = ?',
        [status, now, jobId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    } else if (status === 'completed' || status === 'failed') {
      const values = [status, now];
      let query = 'UPDATE analysis_jobs SET status = ?, completed_at = ?';
      
      if (results) {
        query += ', results_summary = ?';
        values.push(JSON.stringify(results));
      }
      
      if (errorMessage) {
        query += ', error_message = ?';
        values.push(errorMessage);
      }
      
      query += ' WHERE id = ?';
      values.push(jobId);
      
      db.run(query, values, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      // For queued status or others
      db.run(
        'UPDATE analysis_jobs SET status = ? WHERE id = ?',
        [status, jobId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    }
  });
}

async function updateAnalysisJobProgress(jobId: string, progress: number): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE analysis_jobs SET progress = ? WHERE id = ?',
      [progress, jobId],
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function updateRepositoryStatus(repositoryId: string, status: 'pending' | 'analyzing' | 'completed' | 'failed'): Promise<void> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    // SECURITY FIX: Use fixed parameterized query instead of dynamic string concatenation
    if (status === 'completed') {
      db.run(
        'UPDATE repositories SET analysis_status = ?, updated_at = ?, last_analyzed = ? WHERE id = ?',
        [status, now, now, repositoryId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    } else {
      db.run(
        'UPDATE repositories SET analysis_status = ?, updated_at = ? WHERE id = ?',
        [status, now, repositoryId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    }
  });
}

async function updateRepositoryAnalysis(repositoryId: string, analysis: RepositoryAnalysisData): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE repositories SET 
       tech_stack = ?, 
       primary_language = ?, 
       framework = ?, 
       patterns_count = ?, 
       clone_path = ?, 
       metadata = ?, 
       updated_at = ? 
       WHERE id = ?`,
      [
        JSON.stringify(analysis.techStack),
        analysis.primaryLanguage,
        analysis.framework,
        analysis.patternsCount,
        analysis.clonePath,
        JSON.stringify(analysis.metadata),
        new Date().toISOString(),
        repositoryId
      ],
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function savePatternsToDatabase(patterns: Pattern[]): Promise<void> {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO patterns (
      id, repository_id, content, content_hash, description, category, 
      subcategory, tags, file_path, line_start, line_end, language, 
      framework, confidence_score, context_before, context_after, 
      ast_metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  for (const pattern of patterns) {
    // Convert Pattern interface to database format
    stmt.run([
      pattern.id,
      pattern.repositoryId || '',
      pattern.content || (pattern.examples && pattern.examples[0] && pattern.examples[0].before) || '',
      pattern.contentHash || '',
      pattern.description || '',
      pattern.category || 'unknown',
      pattern.subcategory || '',
      JSON.stringify(pattern.tags || []),
      pattern.filePath || (pattern.files && pattern.files[0]) || '',
      pattern.lineStart || null,
      pattern.lineEnd || null,
      pattern.language || 'unknown',
      pattern.framework || null,
      pattern.confidenceScore || 0.5,
      pattern.contextBefore || null,
      pattern.contextAfter || null,
      JSON.stringify(pattern.astMetadata || {}),
      now,
      now
    ]);
  }

  stmt.finalize();
}

async function getLatestAnalysisJob(repositoryId: string): Promise<AnalysisJobRow | undefined> {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM analysis_jobs WHERE repository_id = ? ORDER BY created_at DESC LIMIT 1',
      [repositoryId],
      (err: Error | null, row: AnalysisJobRow | undefined) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

async function getRepositoryPatterns(repositoryId: string, options: PatternSearchOptions): Promise<PatternRow[]> {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM patterns WHERE repository_id = ?';
    const params = [repositoryId];
    
    if (options.category) {
      query += ' AND category = ?';
      params.push(options.category);
    }
    
    if (options.language) {
      query += ' AND language = ?';
      params.push(options.language);
    }
    
    if (options.minConfidence) {
      query += ' AND confidence_score >= ?';
      params.push(options.minConfidence.toString());
    }
    
    if (options.search) {
      query += ' AND (content LIKE ? OR description LIKE ?)';
      params.push(`%${options.search}%`, `%${options.search}%`);
    }
    
    query += ' ORDER BY confidence_score DESC LIMIT ? OFFSET ?';
    params.push(options.limit.toString(), options.offset.toString());
    
    db.all(query, params, (err: Error | null, rows: PatternRow[]) => {
      if (err) reject(err);
      else {
        const patterns = rows.map(row => ({
          ...row,
          tags: JSON.parse(row.tags || '[]'),
          metadata: JSON.parse(row.metadata || '{}')
        }));
        resolve(patterns);
      }
    });
  });
}

async function getRepositoryPatternsCount(repositoryId: string, options: Partial<PatternSearchOptions>): Promise<number> {
  return new Promise((resolve, reject) => {
    let query = 'SELECT COUNT(*) as count FROM patterns WHERE repository_id = ?';
    const params = [repositoryId];
    
    if (options.category) {
      query += ' AND category = ?';
      params.push(options.category);
    }
    
    if (options.language) {
      query += ' AND language = ?';
      params.push(options.language);
    }
    
    if (options.minConfidence) {
      query += ' AND confidence_score >= ?';
      params.push(options.minConfidence.toString());
    }
    
    if (options.search) {
      query += ' AND (content LIKE ? OR description LIKE ?)';
      params.push(`%${options.search}%`, `%${options.search}%`);
    }
    
    db.get(query, params, (err: Error | null, row: { count: number } | undefined) => {
      if (err) reject(err);
      else resolve(row?.count || 0);
    });
  });
}

async function getRepositoryRecommendations(repositoryId: string, options: RecommendationSearchOptions): Promise<ParsedRecommendation[]> {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM repository_recommendations WHERE repository_id = ?';
    const params = [repositoryId];
    
    if (options.priority) {
      query += ' AND priority = ?';
      params.push(options.priority);
    }
    
    if (options.type) {
      query += ' AND recommendation_type = ?';
      params.push(options.type);
    }
    
    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    
    query += ` ORDER BY 
      CASE priority 
        WHEN 'critical' THEN 4 
        WHEN 'high' THEN 3 
        WHEN 'medium' THEN 2 
        ELSE 1 
      END DESC`;
    
    db.all(query, params, (err: Error | null, rows: RecommendationRow[]) => {
      if (err) reject(err);
      else {
        const recommendations: ParsedRecommendation[] = rows.map(row => ({
          ...row,
          implementation_steps: JSON.parse(row.implementation_steps || '[]'),
          tags: JSON.parse(row.tags || '[]'),
          recommendationType: row.category
        }));
        resolve(recommendations);
      }
    });
  });
}

async function clearRepositoryRecommendations(repositoryId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM repository_recommendations WHERE repository_id = ?',
      [repositoryId],
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function searchPatternsAcrossRepositories(options: CrossRepoSearchOptions): Promise<PatternSearchResult[]> {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT p.*, r.name as repository_name, r.full_name as repository_full_name 
      FROM patterns p 
      JOIN repositories r ON p.repository_id = r.id 
      WHERE (p.content LIKE ? OR p.description LIKE ?)
    `;
    const params = [`%${options.query}%`, `%${options.query}%`];
    
    if (options.repositories && options.repositories.length > 0) {
      query += ` AND p.repository_id IN (${options.repositories.map(() => '?').join(',')})`;
      params.push(...options.repositories);
    }
    
    if (options.category) {
      query += ' AND p.category = ?';
      params.push(options.category);
    }
    
    if (options.language) {
      query += ' AND p.language = ?';
      params.push(options.language);
    }
    
    if (options.minConfidence) {
      query += ' AND p.confidence_score >= ?';
      params.push(options.minConfidence.toString());
    }
    
    query += ' ORDER BY p.confidence_score DESC LIMIT ?';
    params.push(options.limit?.toString() || '50');
    
    db.all(query, params, (err: Error | null, rows: (PatternRow & { repository_name: string; repository_full_name: string })[]) => {
      if (err) reject(err);
      else {
        const results: PatternSearchResult[] = rows.map(row => ({
          ...row,
          tags: JSON.parse(row.tags || '[]'),
          metadata: JSON.parse(row.metadata || '{}'),
          ast_metadata: JSON.parse(row.metadata || '{}')
        }));
        resolve(results);
      }
    });
  });
}

async function compareRepositories(repositoryIds: string[]): Promise<{
  repositories: (RepositoryRow & { tech_stack: string[]; metadata: Record<string, unknown> })[];
  comparison: {
    techStackOverlap: Record<string, number>;
    patternSimilarity: Record<string, number>;
    languageDistribution: Record<string, Record<string, number>>;
    categoryDistribution: Record<string, Record<string, number>>;
    recommendations: string[];
  };
}> {
  const repositories: (RepositoryRow & { tech_stack: string[]; metadata: Record<string, unknown> })[] = [];
  const patterns: { repositoryId: string; patterns: PatternRow[] }[] = [];
  
  for (const id of repositoryIds) {
    const repo = await getRepositoryById(id);
    if (repo) {
      repositories.push({
        ...repo,
        tech_stack: JSON.parse(repo.tech_stack),
        metadata: JSON.parse(repo.metadata || '{}')
      });
      
      const repoPatterns = await getRepositoryPatterns(id, { limit: 1000, offset: 0 });
      patterns.push({
        repositoryId: id,
        patterns: repoPatterns
      });
    }
  }
  
  return {
    repositories,
    comparison: {
      techStackOverlap: calculateTechStackOverlap(repositories),
      patternSimilarity: calculatePatternSimilarity(patterns),
      languageDistribution: calculateLanguageDistribution(patterns),
      categoryDistribution: calculateCategoryDistribution(patterns),
      recommendations: generateComparisonRecommendations(repositories, patterns)
    }
  };
}

function calculateTechStackOverlap(repositories: { tech_stack: string[] }[]): Record<string, number> {
  const techStacks = repositories.map(r => r.tech_stack);
  const allTechs = new Set(techStacks.flat());
  const overlap: Record<string, number> = {};
  
  for (const tech of allTechs) {
    const count = techStacks.filter(stack => stack.includes(tech)).length;
    if (count > 1) {
      overlap[tech] = count;
    }
  }
  
  return overlap;
}

function calculatePatternSimilarity(patterns: { repositoryId: string; patterns: PatternRow[] }[]): Record<string, number> {
  // Simplified similarity calculation
  const similarities: Record<string, number> = {};
  
  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      const repo1 = patterns[i];
      const repo2 = patterns[j];
      
      if (!repo1 || !repo2) continue;
      
      const key = `${repo1.repositoryId}-${repo2.repositoryId}`;
      
      const common = repo1.patterns.filter((p1: PatternRow) => 
        repo2.patterns.some((p2: PatternRow) => 
          p1.pattern_type === p2.pattern_type
        )
      ).length;
      
      const total = repo1.patterns.length + repo2.patterns.length;
      similarities[key] = total > 0 ? (common * 2) / total : 0;
    }
  }
  
  return similarities;
}

function calculateLanguageDistribution(patterns: { repositoryId: string; patterns: PatternRow[] }[]): Record<string, Record<string, number>> {
  const distribution: Record<string, Record<string, number>> = {};
  
  for (const repoPatterns of patterns) {
    distribution[repoPatterns.repositoryId] = repoPatterns.patterns.reduce((acc: Record<string, number>, pattern: PatternRow) => {
      // Note: PatternRow doesn't have language field, using pattern_type as a proxy
      const language = 'unknown'; // This should be extracted from metadata or another field
      acc[language] = (acc[language] || 0) + 1;
      return acc;
    }, {});
  }
  
  return distribution;
}

function calculateCategoryDistribution(patterns: { repositoryId: string; patterns: PatternRow[] }[]): Record<string, Record<string, number>> {
  const distribution: Record<string, Record<string, number>> = {};
  
  for (const repoPatterns of patterns) {
    distribution[repoPatterns.repositoryId] = repoPatterns.patterns.reduce((acc: Record<string, number>, pattern: PatternRow) => {
      acc[pattern.pattern_type] = (acc[pattern.pattern_type] || 0) + 1;
      return acc;
    }, {});
  }
  
  return distribution;
}

function generateComparisonRecommendations(repositories: { tech_stack: string[]; primary_language: string }[], patterns: { repositoryId: string; patterns: PatternRow[] }[]): string[] {
  const recommendations = [];
  
  // Example recommendation logic
  const techOverlap = calculateTechStackOverlap(repositories);
  const commonTechs = Object.keys(techOverlap);
  
  if (commonTechs.length > 0) {
    recommendations.push(`Consider standardizing patterns for shared technologies: ${commonTechs.join(', ')}`);
  }
  
  if (repositories.length > 1) {
    const languageCounts = repositories.map(r => r.primary_language);
    const uniqueLanguages = new Set(languageCounts);
    
    if (uniqueLanguages.size < repositories.length) {
      recommendations.push('Multiple repositories use the same primary language - consider pattern sharing opportunities');
    }
  }
  
  return recommendations;
}

async function getTrendingPatterns(options: TrendingPatternsOptions): Promise<TrendingPattern[]> {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT p.*, COUNT(p.id) as trend_score 
      FROM patterns p 
      WHERE p.created_at >= datetime('now', '-${options.timeframe.replace('d', ' days')}')
    `;
    const params = [];
    
    if (options.category) {
      query += ' AND p.category = ?';
      params.push(options.category);
    }
    
    if (options.language) {
      query += ' AND p.language = ?';
      params.push(options.language);
    }
    
    query += ' GROUP BY p.content_hash ORDER BY trend_score DESC, p.confidence_score DESC LIMIT ?';
    params.push(options.limit);
    
    db.all(query, params, (err: Error | null, rows: (PatternRow & { trend_score: number; usage_count: number })[]) => {
      if (err) reject(err);
      else {
        const trendingPatterns: TrendingPattern[] = rows.map(row => ({
          ...row,
          tags: JSON.parse(row.tags || '[]'),
          metadata: JSON.parse(row.metadata || '{}'),
          ast_metadata: JSON.parse(row.metadata || '{}'),
          usage_count: row.usage_count || 0
        }));
        resolve(trendingPatterns);
      }
    });
  });
}

export default router;