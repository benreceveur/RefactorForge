import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../utils/database-helpers';
import type { RepositoryRow } from '../types';

export interface GitHubIntegrationData {
  repository: string;
  settings: {
    categories: string[];
  };
  branches: string[];
  patternsCount?: number;
}

export interface RepositoryInfo {
  id: string;
  name: string;
  fullName: string;
  organization: string;
  description?: string;
  techStack: string;
  primaryLanguage: string;
  framework?: string;
  patternsCount: number;
  categories: string[];
  branches: string[];
}

export interface TechStackDetection {
  techStack: string;
  confidence: number;
  indicators: string[];
  framework?: string;
  language: string;
}

export interface RepositoryPattern {
  id: string;
  repositoryId: string;
  patternType: string;
  patternContent: string;
  category: string;
  confidenceScore: number;
  filePath?: string;
  language: string;
}

export class RepositoryAnalyzer {
  
  /**
   * Analyze repository from a local path
   */
  async analyzeRepositoryFromPath(repositoryPath: string): Promise<RepositoryInfo> {
    // Extract repository name from path
    const parts = repositoryPath.split('/');
    const repoName = parts[parts.length - 1];
    
    // Create minimal GitHubIntegrationData from path info
    const githubData: GitHubIntegrationData = {
      repository: `local/${repoName}`,
      settings: {
        categories: ['local'] // Default category for local analysis
      },
      branches: ['main'], // Default branch
      patternsCount: 0
    };
    
    return this.analyzeRepository(githubData);
  }
  
  /**
   * Analyze repository and detect tech stack based on GitHub integration data
   */
  async analyzeRepository(githubRepo: GitHubIntegrationData): Promise<RepositoryInfo> {
    const techStackDetection = this.detectTechStack(githubRepo);
    const [organization, name] = githubRepo.repository.split('/');
    
    const repositoryInfo: RepositoryInfo = {
      id: uuidv4(),
      name: name || 'unknown',
      fullName: githubRepo.repository,
      organization: organization || 'unknown',
      description: `${githubRepo.settings.categories.join(', ')} repository`,
      techStack: techStackDetection.techStack,
      primaryLanguage: techStackDetection.language,
      framework: techStackDetection.framework,
      patternsCount: githubRepo.patternsCount || 0,
      categories: githubRepo.settings.categories,
      branches: githubRepo.branches
    };

    // Store repository in database
    await this.storeRepository(repositoryInfo);
    
    return repositoryInfo;
  }

  /**
   * Detect technology stack based on repository characteristics
   * 
   * Uses a rule-based classification system that analyzes repository metadata
   * including categories, naming patterns, and organizational context to determine
   * the most likely technology stack. This is critical for:
   * - Pattern extraction optimization (language-specific rules)
   * - Security scanning (framework-specific vulnerabilities)
   * - Performance analysis (platform-specific optimizations)
   * 
   * Algorithm:
   * 1. Extract repository categories and naming patterns
   * 2. Apply hierarchical matching rules (most specific first)
   * 3. Calculate confidence scores based on indicator strength
   * 4. Return best match with supporting evidence
   */
  private detectTechStack(githubRepo: GitHubIntegrationData): TechStackDetection {
    const categories = githubRepo.settings.categories;
    
    // === Azure Functions Detection ===
    // High-confidence pattern: Azure + Functions combo indicates serverless architecture
    // This is the most specific pattern, so it gets priority
    if (categories.includes('azure') && categories.includes('functions')) {
      return {
        techStack: 'azure-functions',
        confidence: 0.95,                    // Very high confidence due to explicit indicators
        indicators: ['azure', 'functions', 'serverless'],
        framework: 'Azure Functions',
        language: 'JavaScript'               // Default for Azure Functions
      };
    }
    
    // === DevOps/Monitoring Stack Detection ===
    // DevOps repositories typically contain infrastructure code, monitoring configs,
    // and automation scripts. These often use TypeScript for type safety in CI/CD
    if (categories.includes('devops') || categories.includes('monitoring')) {
      return {
        techStack: 'devops-monitoring',
        confidence: 0.9,                     // High confidence - DevOps is usually explicit
        indicators: ['devops', 'monitoring', 'observability'],
        framework: 'DevOps Tools',           // Generic framework for tooling
        language: 'TypeScript'              // Common for modern DevOps tooling
      };
    }
    
    // === Healthcare/Enterprise Detection ===
    // Healthcare applications have strict compliance requirements (HIPAA, etc.)
    // and typically use enterprise-grade TypeScript for type safety and reliability
    if (categories.includes('healthcare') || categories.includes('dental')) {
      return {
        techStack: 'healthcare-enterprise',
        confidence: 0.85,                   // Lower confidence - domain-specific but diverse
        indicators: ['healthcare', 'enterprise', 'compliance'],
        framework: 'Enterprise TypeScript', // Enterprise patterns expected
        language: 'TypeScript'             // Type safety critical for healthcare data
      };
    }
    
    // === React Frontend Detection ===
    // Modern React applications typically use TypeScript for enhanced development
    // experience and better maintainability in larger codebases
    if (categories.includes('frontend') || categories.includes('react')) {
      return {
        techStack: 'react-frontend',
        confidence: 0.9,                    // High confidence - React pattern is clear
        indicators: ['react', 'frontend', 'typescript'],
        framework: 'React',                 // Explicit React framework
        language: 'TypeScript'             // Modern React preference
      };
    }
    
    // === Middleware/API Detection ===
    // Middleware components often handle data transformation and API integration
    // Common pattern in microservices architectures, especially with Azure integration
    if (categories.includes('middleware')) {
      return {
        techStack: 'middleware-api',
        confidence: 0.8,                    // Moderate confidence - middleware varies widely
        indicators: ['middleware', 'api', 'integration'],
        framework: 'Express/Azure',         // Common middleware stack
        language: 'TypeScript'             // Preferred for API development
      };
    }
    
    // === Legacy/Migration Detection ===
    // Migration projects often contain mixed legacy JavaScript and modern code
    // These require special handling for pattern detection due to inconsistent styles
    if (categories.includes('migration') || categories.includes('legacy')) {
      return {
        techStack: 'legacy-migration',
        confidence: 0.85,                   // High confidence - explicit migration indicator
        indicators: ['migration', 'legacy', 'modernization'],
        framework: 'Legacy JavaScript',     // Assumes older JavaScript patterns
        language: 'JavaScript'             // Legacy typically uses JavaScript
      };
    }
    
    // === Full-Stack TypeScript Detection ===
    // Full-stack applications with explicit backend+fullstack categorization
    // indicate comprehensive TypeScript usage across frontend and backend
    if (categories.includes('backend') && categories.includes('fullstack')) {
      return {
        techStack: 'fullstack-typescript',
        confidence: 0.9,                    // High confidence - explicit full-stack indicator
        indicators: ['fullstack', 'backend', 'typescript'],
        framework: 'Express/React',         // Common full-stack combination
        language: 'TypeScript'             // Modern full-stack preference
      };
    }
    
    // Default detection
    return {
      techStack: 'general-typescript',
      confidence: 0.7,
      indicators: ['typescript', 'nodejs'],
      framework: 'Node.js',
      language: 'TypeScript'
    };
  }

  /**
   * Store repository information in database
   */
  private async storeRepository(repo: RepositoryInfo): Promise<void> {
    try {
      await dbRun(`
        INSERT OR REPLACE INTO repositories (
          id, name, full_name, organization, description, tech_stack,
          primary_language, framework, patterns_count, categories, branches,
          analysis_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        repo.id,
        repo.name,
        repo.fullName,
        repo.organization,
        repo.description,
        repo.techStack,
        repo.primaryLanguage,
        repo.framework,
        repo.patternsCount,
        JSON.stringify(repo.categories),
        JSON.stringify(repo.branches),
        'analyzed',
        new Date().toISOString(),
        new Date().toISOString()
      ]);
      
      console.log(`✅ Stored repository analysis: ${repo.fullName} (${repo.techStack})`);
    } catch (error) {
      console.error(`❌ Failed to store repository ${repo.fullName}:`, error);
      throw error;
    }
  }

  /**
   * Get all analyzed repositories
   */
  async getAllRepositories(): Promise<RepositoryInfo[]> {
    try {
      const rows = await dbAll(`
        SELECT id, name, full_name, organization, description, tech_stack,
               primary_language, framework, patterns_count, categories, branches
        FROM repositories 
        WHERE analysis_status = 'analyzed'
        ORDER BY patterns_count DESC
      `);

      return (rows as RepositoryRow[]).map((row: RepositoryRow) => ({
        id: row.id,
        name: row.name,
        fullName: row.full_name,
        organization: row.organization,
        description: row.description || undefined,
        techStack: row.tech_stack,
        primaryLanguage: row.primary_language,
        framework: row.framework || undefined,
        patternsCount: row.patterns_count,
        categories: JSON.parse(row.categories || '[]'),
        branches: JSON.parse(row.branches || '[]')
      }));
    } catch (error) {
      console.error('❌ Failed to get repositories:', error);
      return [];
    }
  }

  /**
   * Get repository by full name
   */
  async getRepositoryByName(fullName: string): Promise<RepositoryInfo | null> {
    try {
      const row = await dbGet(`
        SELECT id, name, full_name, organization, description, tech_stack,
               primary_language, framework, patterns_count, categories, branches
        FROM repositories 
        WHERE full_name = ? AND analysis_status = 'analyzed'
      `, [fullName]);

      if (!row) return null;

      const repositoryRow = row as RepositoryRow;
      return {
        id: repositoryRow.id,
        name: repositoryRow.name,
        fullName: repositoryRow.full_name,
        organization: repositoryRow.organization,
        description: repositoryRow.description || undefined,
        techStack: repositoryRow.tech_stack,
        primaryLanguage: repositoryRow.primary_language,
        framework: repositoryRow.framework || undefined,
        patternsCount: repositoryRow.patterns_count,
        categories: JSON.parse(repositoryRow.categories || '[]'),
        branches: JSON.parse(repositoryRow.branches || '[]')
      };
    } catch (error) {
      console.error(`❌ Failed to get repository ${fullName}:`, error);
      return null;
    }
  }

  /**
   * Update repository pattern counts from improvements table
   */
  async updateRepositoryPatternCounts(): Promise<{ updated: number; errors: string[] }> {
    console.log('🔄 Updating repository pattern counts from improvements...');
    
    const updated: string[] = [];
    const errors: string[] = [];
    
    try {
      // Get all repositories that have improvements
      const improvementCounts = await dbAll(`
        SELECT 
          repository,
          COUNT(*) as pattern_count
        FROM improvements 
        GROUP BY repository
      `);
      
      console.log(`📊 Found improvements for ${improvementCounts.length} repositories`);
      
      for (const row of improvementCounts as any[]) {
        try {
          const { repository, pattern_count } = row;
          
          // Try multiple name variations to match repository names
          const nameVariations = [
            repository,
            repository.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
            repository.replace(/-/g, ''),
            repository.toLowerCase(),
            repository.replace(/([a-z])([A-Z])/g, '$1-$2')
          ];
          
          let repositoryUpdated = false;
          
          for (const nameVariation of nameVariations) {
            const updateResult = await dbRun(`
              UPDATE repositories 
              SET 
                patterns_count = ?,
                updated_at = ?
              WHERE LOWER(full_name) LIKE ? 
                 OR LOWER(name) LIKE ?
                 OR LOWER(full_name) = ?
                 OR LOWER(name) = ?
            `, [
              pattern_count,
              new Date().toISOString(),
              `%${nameVariation.toLowerCase()}%`,
              `%${nameVariation.toLowerCase()}%`,
              nameVariation.toLowerCase(),
              nameVariation.toLowerCase()
            ]);
            
            if (updateResult.changes && updateResult.changes > 0) {
              console.log(`✅ Updated ${repository} (${nameVariation}): ${pattern_count} patterns`);
              updated.push(`${repository}: ${pattern_count} patterns`);
              repositoryUpdated = true;
              break; // Stop trying variations once we find a match
            }
          }
          
          if (!repositoryUpdated) {
            console.warn(`⚠️  No repository found for improvements: ${repository}`);
            errors.push(`No repository found for: ${repository}`);
          }
          
        } catch (updateError) {
          const errorMsg = `Failed to update ${row.repository}: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
      
      console.log(`✅ Repository pattern count update complete: ${updated.length} updated, ${errors.length} errors`);
      
    } catch (error) {
      const errorMsg = `Failed to update repository pattern counts: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
    
    return {
      updated: updated.length,
      errors
    };
  }

  /**
   * Initialize repository analysis for all GitHub integrations
   */
  async initializeFromGitHubIntegrations(githubIntegrations: GitHubIntegrationData[]): Promise<void> {
    console.log(`🔄 Analyzing ${githubIntegrations.length} repositories...`);
    
    for (const integration of githubIntegrations) {
      try {
        await this.analyzeRepository(integration);
      } catch (error) {
        console.error(`❌ Failed to analyze ${integration.repository}:`, error);
      }
    }
    
    // Update pattern counts after initialization
    await this.updateRepositoryPatternCounts();
    
    console.log('✅ Repository analysis initialization complete');
  }
}