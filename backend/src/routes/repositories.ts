import { Router, Request, Response } from 'express';
import { RepositoryAnalyzer, RepositoryInfo as ServiceRepositoryInfo } from '../services/repository-analyzer';
import { RecommendationEngine } from '../services/recommendation-engine';
import { GitHubScanner } from '../services/github-scanner';
const { LocalRepositoryDetector } = require('../services/local-repository-detector');
import { RepositoryInfo, ScanResult } from '../types/analysis.types';
import { GitHubRepository } from '../types/github.types';
import { ApiResponse, Recommendation } from '../types/common.types';
import { RepositoryRow } from '../types/database.types';
import { dbRun } from '../utils/database-helpers';
import { validateRepositoryFormat } from '../utils/sanitizer';

const router = Router();
const repositoryAnalyzer = new RepositoryAnalyzer();
const recommendationEngine = new RecommendationEngine();
const githubScanner = new GitHubScanner(process.env.GITHUB_TOKEN);
const localRepoDetector = new LocalRepositoryDetector();

// REMOVED: Mock repository data - now using real GitHub data only

// Initialize repository analysis from GitHub integrations - MUST BE FIRST
router.post('/initialize-analysis', async (req: Request, res: Response) => {
  try {
    console.log('🚀 Initializing multi-repository analysis...');
    
    // Get real GitHub repositories instead of using mock data
    console.log('🔍 Fetching real GitHub repositories for initialization...');
    
    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        success: false,
        error: 'GitHub token not configured. Cannot initialize with real repository data.'
      });
    }

    // Import GitHub service to get real repositories
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // Fetch user's repositories
    const userRepos = await octokit.rest.repos.listForAuthenticatedUser({
      visibility: 'all',
      sort: 'updated',
      per_page: 30
    });

    // Convert real GitHub repos to RefactorForge integration format
    const githubIntegrations = userRepos.data.map((repo: any) => ({
      repository: repo.full_name,
      settings: { 
        categories: repo.topics && repo.topics.length > 0 ? repo.topics : ['general'],
        autoSave: true,
        minStars: 0
      },
      patternsCount: 0, // Will be populated when scanned
      branches: [repo.default_branch || 'main']
    }));

    console.log(`📊 Found ${githubIntegrations.length} real repositories for initialization`);
    
    // Initialize repository analysis
    await repositoryAnalyzer.initializeFromGitHubIntegrations(githubIntegrations);
    
    // Generate recommendations for all repositories
    await recommendationEngine.generateAllRepositoryRecommendations();
    
    const repositories = await repositoryAnalyzer.getAllRepositories();
    
    res.json({
      success: true,
      message: 'Multi-repository analysis initialized successfully',
      repositoriesAnalyzed: repositories.length,
      totalPatterns: repositories.reduce((sum, repo) => sum + repo.patternsCount, 0),
      repositories: repositories.map(repo => ({
        name: repo.fullName,
        techStack: repo.techStack,
        patternsCount: repo.patternsCount,
        categories: repo.categories
      }))
    });
  } catch (error: unknown) {
    console.error('Error initializing repository analysis:', error);
    res.status(500).json({ 
      error: 'Failed to initialize repository analysis',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get repository analysis statistics
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const repositories = await repositoryAnalyzer.getAllRepositories();
    
    const stats = {
      totalRepositories: repositories.length,
      totalPatterns: repositories.reduce((sum, repo) => sum + repo.patternsCount, 0),
      techStackDistribution: repositories.reduce((acc: Record<string, number>, repo) => {
        acc[repo.techStack] = (acc[repo.techStack] || 0) + 1;
        return acc;
      }, {}),
      languageDistribution: repositories.reduce((acc: Record<string, number>, repo) => {
        acc[repo.primaryLanguage] = (acc[repo.primaryLanguage] || 0) + 1;
        return acc;
      }, {}),
      averagePatternsPerRepo: repositories.length > 0 
        ? Math.round(repositories.reduce((sum, repo) => sum + repo.patternsCount, 0) / repositories.length)
        : 0
    };
    
    res.json(stats);
  } catch (error: unknown) {
    console.error('Error fetching repository stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch repository statistics',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get all repositories from database
router.get('/', async (req: Request, res: Response) => {
  try {
    const repositories = await repositoryAnalyzer.getAllRepositories();
    
    // If no repositories in database, try to fetch from GitHub API
    if (repositories.length === 0) {
      console.log('📋 No repositories in database, attempting to fetch from GitHub API');
      
      if (!process.env.GITHUB_TOKEN) {
        console.log('⚠️  No GitHub token configured, returning empty array');
        return res.json([]);
      }

      try {
        // Import Octokit for direct GitHub API access
        const { Octokit } = require('@octokit/rest');
        const octokit = new Octokit({
          auth: process.env.GITHUB_TOKEN,
        });

        // Fetch both user repositories and organization repositories
        const userRepos = await octokit.rest.repos.listForAuthenticatedUser({
          visibility: 'all',
          sort: 'updated',
          per_page: 50
        });

        // Also fetch organization repositories (IntelliPact)
        let orgRepos = [];
        try {
          const intellipactRepos = await octokit.rest.repos.listForOrg({
            org: 'IntelliPact',
            sort: 'updated',
            per_page: 50
          });
          orgRepos = intellipactRepos.data;
          console.log(`📊 Found ${orgRepos.length} IntelliPact organization repositories`);
        } catch (orgError: unknown) {
          console.warn('⚠️  Could not fetch IntelliPact organization repositories:', orgError instanceof Error ? orgError.message : 'Unknown error');
        }

        // Combine user and organization repositories, removing duplicates
        const allRepos = [...userRepos.data, ...orgRepos];
        const uniqueRepos = allRepos.reduce((unique: any[], repo: any) => {
          if (!unique.find((r: any) => r.full_name === repo.full_name)) {
            unique.push(repo);
          }
          return unique;
        }, []);

        console.log(`📊 Combined repositories: ${userRepos.data.length} user + ${orgRepos.length} org = ${uniqueRepos.length} total`);

        // Convert GitHub repos to RefactorForge format
        const githubRepos = uniqueRepos.map((repo: any) => ({
          id: `repo-${repo.id}`,
          name: repo.name,
          fullName: repo.full_name,
          patternsCount: 0, // Will be populated when scanned
          language: repo.language || 'Unknown',
          lastUpdated: repo.updated_at,
          categories: repo.topics && repo.topics.length > 0 ? repo.topics : ['general'],
          // Additional GitHub data
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          description: repo.description,
          private: repo.private,
          size: repo.size
        }));

        console.log(`📊 Returning ${githubRepos.length} repositories from GitHub API`);
        res.json(githubRepos);
      } catch (githubError) {
        console.error('Error fetching from GitHub API:', githubError);
        console.log('📋 Returning empty array due to GitHub API error');
        res.json([]);
      }
    } else {
      console.log(`📊 Returning ${repositories.length} repositories from database`);
      res.json(repositories);
    }
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Enhanced repositories endpoint with local clone status
router.get('/with-local-status', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Fetching repositories with local clone status...');
    
    // Get repositories from database/API
    const repositories = await repositoryAnalyzer.getAllRepositories();
    
    // If no repositories in database, try to fetch from GitHub API
    if (repositories.length === 0) {
      console.log('📋 No repositories in database, attempting to fetch from GitHub API with full metadata');
      
      if (!process.env.GITHUB_TOKEN) {
        console.log('⚠️  No GitHub token configured');
        return res.json([]);
      }

      try {
        const { Octokit } = require('@octokit/rest');
        const octokit = new Octokit({
          auth: process.env.GITHUB_TOKEN,
        });

        // Fetch both user repositories and organization repositories
        const userRepos = await octokit.rest.repos.listForAuthenticatedUser({
          visibility: 'all',
          sort: 'updated',
          per_page: 50
        });

        // Also fetch organization repositories (IntelliPact)
        let orgRepos = [];
        try {
          const intellipactRepos = await octokit.rest.repos.listForOrg({
            org: 'IntelliPact',
            sort: 'updated',
            per_page: 50
          });
          orgRepos = intellipactRepos.data;
          console.log(`📊 Found ${orgRepos.length} IntelliPact organization repositories`);
        } catch (orgError: unknown) {
          console.warn('⚠️  Could not fetch IntelliPact organization repositories:', orgError instanceof Error ? orgError.message : 'Unknown error');
        }

        // Combine user and organization repositories, removing duplicates
        const allRepos = [...userRepos.data, ...orgRepos];
        const uniqueRepos = allRepos.reduce((unique: any[], repo: any) => {
          if (!unique.find((r: any) => r.full_name === repo.full_name)) {
            unique.push(repo);
          }
          return unique;
        }, []);

        console.log(`📊 Combined repositories: ${userRepos.data.length} user + ${orgRepos.length} org = ${uniqueRepos.length} total`);

        // Check local status for each GitHub repository and store in database
        const reposWithLocalStatus = await Promise.all(
          uniqueRepos.map(async (repo: any) => {
            const validation = await localRepoDetector.validateRepositorySync(repo.full_name);
            
            const repoData = {
              id: `repo-${repo.id}`,
              name: repo.name,
              fullName: repo.full_name,
              patternsCount: 0,
              language: repo.language || 'Unknown',
              lastUpdated: repo.updated_at,
              categories: repo.topics && repo.topics.length > 0 ? repo.topics : ['general'],
              description: repo.description || `${repo.language || 'Unknown'} repository`,
              stars: repo.stargazers_count || 0,
              forks: repo.forks_count || 0,
              private: repo.private || false,
              size: repo.size || 0,
              // Local status information
              isClonedLocally: validation.isCloned,
              localStatus: validation.isCloned ? {
                remoteMatches: validation.remoteMatches,
                hasLocalChanges: validation.hasLocalChanges,
                needsPush: validation.needsPush,
                currentBranch: validation.localInfo?.currentBranch,
                lastCommit: validation.localInfo?.lastCommit,
                localPath: validation.localInfo?.localPath
              } : null
            };

            // Store repository in database for future use if it's cloned locally or has significant activity
            if (validation.isCloned || repo.stargazers_count > 0 || repo.updated_at > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) {
              try {
                await repositoryAnalyzer.analyzeRepository({
                  repository: repo.full_name,
                  settings: {
                    categories: repoData.categories
                  },
                  branches: [repo.default_branch || 'main'],
                  patternsCount: 0
                });
              } catch (storeError) {
                console.warn(`Failed to store repository ${repo.full_name}:`, storeError);
              }
            }

            return repoData;
          })
        );

        console.log(`📊 Returning ${reposWithLocalStatus.length} repositories with local status from GitHub API`);
        res.json(reposWithLocalStatus);
      } catch (githubError) {
        console.error('Error fetching from GitHub API:', githubError);
        res.json([]);
      }
    } else {
      // Enhance existing repositories with local status and update GitHub metadata
      const reposWithLocalStatus = await Promise.all(
        repositories.map(async (repo) => {
          const validation = await localRepoDetector.validateRepositorySync(repo.fullName);
          
          // Try to get additional GitHub metadata if missing
          let githubMetadata = {};
          if (!repo.description || repo.description === `${repo.primaryLanguage} repository`) {
            try {
              const { Octokit } = require('@octokit/rest');
              const octokit = new Octokit({
                auth: process.env.GITHUB_TOKEN,
              });
              
              const [owner, repoName] = repo.fullName.split('/');
              const githubRepo = await octokit.rest.repos.get({
                owner,
                repo: repoName
              });
              
              githubMetadata = {
                description: githubRepo.data.description || repo.description,
                stars: githubRepo.data.stargazers_count,
                forks: githubRepo.data.forks_count,
                private: githubRepo.data.private,
                size: githubRepo.data.size,
                lastUpdated: githubRepo.data.updated_at
              };
            } catch (githubError) {
              console.warn(`Could not fetch GitHub metadata for ${repo.fullName}:`, githubError);
            }
          }
          
          return {
            ...repo,
            ...githubMetadata,
            isClonedLocally: validation.isCloned,
            localStatus: validation.isCloned ? {
              remoteMatches: validation.remoteMatches,
              hasLocalChanges: validation.hasLocalChanges,
              needsPush: validation.needsPush,
              currentBranch: validation.localInfo?.currentBranch,
              lastCommit: validation.localInfo?.lastCommit,
              localPath: validation.localInfo?.localPath
            } : null
          };
        })
      );

      console.log(`📊 Returning ${reposWithLocalStatus.length} repositories with local status from database`);
      res.json(reposWithLocalStatus);
    }
  } catch (error) {
    console.error('Error fetching repositories with local status:', error);
    res.status(500).json({ error: 'Failed to fetch repositories with local status' });
  }
});

// Get repository by ID or full name
router.get('/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    
    // Try to get by full name first, then by ID
    let repository = await repositoryAnalyzer.getRepositoryByName(identifier || '');
    if (!repository) {
      // If not found in database, try to fetch from GitHub API
      console.log(`🔍 Repository ${identifier} not found in database, checking GitHub API...`);
      
      if (!process.env.GITHUB_TOKEN) {
        return res.status(404).json({ error: 'Repository not found and no GitHub token configured' });
      }

      try {
        const { Octokit } = require('@octokit/rest');
        const octokit = new Octokit({
          auth: process.env.GITHUB_TOKEN,
        });

        // Try to get repository from GitHub API
        const [owner, repo] = identifier?.includes('/') ? identifier.split('/') : [null, identifier];
        if (!owner || !repo) {
          return res.status(404).json({ error: 'Repository not found' });
        }

        const githubRepo = await octokit.rest.repos.get({
          owner: owner as string,
          repo: repo as string
        });

        // Return GitHub repository data in RefactorForge format
        const repoData = {
          id: `repo-github-${githubRepo.data.id}`,
          name: githubRepo.data.name,
          fullName: githubRepo.data.full_name,
          patternsCount: 0, // Not scanned yet
          language: githubRepo.data.language || 'Unknown',
          lastUpdated: githubRepo.data.updated_at,
          categories: githubRepo.data.topics || ['general'],
          description: githubRepo.data.description,
          stars: githubRepo.data.stargazers_count,
          forks: githubRepo.data.forks_count,
          private: githubRepo.data.private
        };

        console.log(`✅ Found repository ${identifier} on GitHub`);
        return res.json(repoData);
      } catch (githubError: any) {
        if (githubError.status === 404) {
          return res.status(404).json({ error: 'Repository not found' });
        }
        console.error('Error fetching from GitHub:', githubError);
        return res.status(404).json({ error: 'Repository not found' });
      }
    }
    
    res.json(repository);
  } catch (error) {
    console.error('Error fetching repository:', error);
    res.status(500).json({ error: 'Failed to fetch repository' });
  }
});

// Generate recommendations for a specific repository
router.post('/:id/recommendations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`📊 Generating recommendations for repository: ${id}`);
    
    const recommendations = await recommendationEngine.generateRecommendations(id as string);
    
    res.json({
      success: true,
      repositoryId: id,
      recommendationsGenerated: recommendations.length,
      recommendations
    });
  } catch (error: unknown) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Refresh repository analysis with live GitHub scanning
router.post('/:id/refresh', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`🔄 Refreshing repository analysis: ${id}`);
    
    // Get repository information
    const repository = await repositoryAnalyzer.getRepositoryByName(id as string);
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // Parse repository name for GitHub API
    const [owner, repo] = repository.fullName.split('/');
    if (!owner || !repo) {
      return res.status(400).json({ error: 'Invalid repository format' });
    }
    const githubRepo = { owner, repo, branch: 'main' };
    
    // Perform live GitHub scan
    console.log(`🔍 Scanning live repository: ${repository.fullName}`);
    const scanResults = await githubScanner.scanRepository(githubRepo);
    
    // Save updated patterns to database
    await githubScanner.saveScanResults(repository.fullName, scanResults);
    
    // Check for fixed issues (only if scan was successful)
    const fixedIssues = await githubScanner.checkFixedIssues(repository.fullName, {
      securityIssues: scanResults.securityIssues,
      typeSafetyIssues: scanResults.typeSafetyIssues,
      performanceIssues: scanResults.performanceIssues
    }, scanResults.scanSuccessful);
    
    // Remove recommendations for fixed issues
    await githubScanner.removeFixedRecommendations(repository.fullName, fixedIssues);
    
    // Generate new recommendations based on current state - excluding fixed issues
    const newRecommendations = await recommendationEngine.generateRecommendationsFromScan(repository.id, scanResults);
    
    // Calculate summary statistics
    const totalFixedIssues = Object.values(fixedIssues).flat().length;
    
    res.json({
      success: true,
      repositoryId: id,
      repositoryName: repository.fullName,
      scanResults: {
        successful: scanResults.scanSuccessful,
        errorMessage: scanResults.errorMessage,
        patternsFound: scanResults.patterns.length,
        securityIssues: scanResults.securityIssues.length,
        typeSafetyIssues: scanResults.typeSafetyIssues.length,
        performanceIssues: scanResults.performanceIssues.length
      },
      fixedIssues: {
        total: totalFixedIssues,
        security: fixedIssues.fixedSecurityIssues.length,
        typeIssues: fixedIssues.fixedTypeIssues.length,
        performance: fixedIssues.fixedPerformanceIssues.length,
        details: fixedIssues
      },
      newRecommendations: {
        count: newRecommendations.length,
        recommendations: newRecommendations.slice(0, 5) // Return first 5 for preview
      },
      lastRefreshed: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Error refreshing repository:', error);
    res.status(500).json({ 
      error: 'Failed to refresh repository analysis',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get recommendations for a specific repository
router.get('/:id/recommendations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recommendations = await recommendationEngine.getRecommendationsForRepository(id as string);
    
    res.json({
      repositoryId: id,
      recommendationsCount: recommendations.length,
      recommendations
    });
  } catch (error: unknown) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recommendations',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * Cleanup duplicate recommendations
 */
router.post('/cleanup-duplicates', async (req: Request, res: Response) => {
  try {
    console.log('🧹 Starting duplicate recommendations cleanup...');
    const removedCount = await recommendationEngine.cleanupDuplicateRecommendations();
    
    res.json({
      success: true,
      message: `Successfully cleaned up ${removedCount} duplicate recommendations`,
      duplicatesRemoved: removedCount
    });
  } catch (error: unknown) {
    console.error('Error cleaning up duplicates:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup duplicates',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Scan all configured repositories
router.post('/scan-all', async (req: Request, res: Response) => {
  try {
    const { includeRefactorForge = true } = req.body;
    
    console.log('🚀 Starting batch repository scan...');
    
    // Get repositories from database or GitHub API instead of hardcoded list
    console.log('🔍 Getting repositories to scan from database...');
    
    let repositoriesFromDb: ServiceRepositoryInfo[] = await repositoryAnalyzer.getAllRepositories();
    
    // If no repositories in database, fetch from GitHub API
    if (repositoriesFromDb.length === 0) {
      console.log('📋 No repositories in database, fetching from GitHub API...');
      
      if (!process.env.GITHUB_TOKEN) {
        return res.status(400).json({
          success: false,
          error: 'No repositories found and GitHub token not configured'
        });
      }

      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });

      // Fetch both user repositories and organization repositories
      const userRepos = await octokit.rest.repos.listForAuthenticatedUser({
        visibility: 'all',
        sort: 'updated',
        per_page: 30
      });

      // Also fetch organization repositories (IntelliPact)
      let orgRepos = [];
      try {
        const intellipactRepos = await octokit.rest.repos.listForOrg({
          org: 'IntelliPact',
          sort: 'updated',
          per_page: 30
        });
        orgRepos = intellipactRepos.data;
        console.log(`📊 Found ${orgRepos.length} IntelliPact organization repositories for scan-all`);
      } catch (orgError: unknown) {
        console.warn('⚠️  Could not fetch IntelliPact organization repositories for scan-all:', orgError instanceof Error ? orgError.message : 'Unknown error');
      }

      // Combine user and organization repositories, removing duplicates
      const allRepos = [...userRepos.data, ...orgRepos];
      const uniqueRepos = allRepos.reduce((unique: any[], repo: any) => {
        if (!unique.find((r: any) => r.full_name === repo.full_name)) {
          unique.push(repo);
        }
        return unique;
      }, []);

      repositoriesFromDb = uniqueRepos.map((repo: any): ServiceRepositoryInfo => ({
        id: `repo-${repo.id}`,
        name: repo.name,
        fullName: repo.full_name,
        organization: repo.owner?.login || '',
        description: repo.description || undefined,
        techStack: repo.language || 'Unknown',
        primaryLanguage: repo.language || 'Unknown',
        framework: undefined,
        patternsCount: 0,
        categories: repo.topics || ['general'],
        branches: [repo.default_branch || 'main']
      }));
    }

    // Convert to scan format
    const repositoriesToScan = repositoriesFromDb
      .filter(repo => includeRefactorForge || !repo.fullName.toLowerCase().includes('refactorforge'))
      .map(repo => {
        const [owner, repoName] = repo.fullName.split('/');
        if (!owner || !repoName) {
          throw new Error(`Invalid repository format: ${repo.fullName}`);
        }
        return {
          owner,
          repo: repoName,
          branch: 'main' // Default branch, could be improved by fetching from GitHub API
        };
      });

    console.log(`📊 Will scan ${repositoriesToScan.length} repositories`);
    
    const scanResults: Array<{
      repository: string;
      success: boolean;
      patterns?: number;
      issues?: {
        security: number;
        typeSafety: number;
        performance: number;
      };
      recommendations?: number;
      error?: string;
    }> = [];
    const errors: Array<{ repository: string; error: string }> = [];
    
    // Process repositories in batches of 3 to avoid rate limiting
    const batchSize = 3;
    for (let i = 0; i < repositoriesToScan.length; i += batchSize) {
      const batch = repositoriesToScan.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(repositoriesToScan.length / batchSize)}`);
      
      const batchPromises = batch.map(async (repo) => {
        try {
          console.log(`🔍 Scanning ${repo.owner}/${repo.repo}...`);
          const scanResult = await githubScanner.scanRepository(repo);
          
          // Save results to database
          await githubScanner.saveScanResults(`${repo.owner}/${repo.repo}`, scanResult);
          
          // Generate recommendations
          const repositoryInfo = await repositoryAnalyzer.getRepositoryByName(`${repo.owner}/${repo.repo}`);
          let recommendations: Recommendation[] = [];
          if (repositoryInfo) {
            recommendations = await recommendationEngine.generateRecommendations(repositoryInfo.id);
          }
          
          return {
            repository: `${repo.owner}/${repo.repo}`,
            success: true,
            patterns: scanResult.patterns.length,
            issues: {
              security: scanResult.securityIssues.length,
              typeSafety: scanResult.typeSafetyIssues.length,
              performance: scanResult.performanceIssues.length
            },
            recommendations: recommendations.length
          };
        } catch (error) {
          console.error(`❌ Error scanning ${repo.owner}/${repo.repo}:`, error);
          errors.push({
            repository: `${repo.owner}/${repo.repo}`,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return {
            repository: `${repo.owner}/${repo.repo}`,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      scanResults.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < repositoriesToScan.length) {
        console.log('⏱️ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Calculate summary statistics
    const successful = scanResults.filter(r => r.success).length;
    const failed = scanResults.filter(r => !r.success).length;
    const totalPatterns = scanResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.patterns || 0), 0);
    const totalIssues = scanResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.issues?.security || 0) + (r.issues?.typeSafety || 0) + (r.issues?.performance || 0), 0);
    const totalRecommendations = scanResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.recommendations || 0), 0);
    
    res.json({
      success: true,
      message: `Batch scan completed: ${successful} successful, ${failed} failed`,
      summary: {
        repositoriesScanned: repositoriesToScan.length,
        successful,
        failed,
        totalPatterns,
        totalIssues,
        totalRecommendations
      },
      results: scanResults,
      errors: errors.length > 0 ? errors : undefined,
      scannedAt: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Error in batch scan:', error);
    res.status(500).json({ 
      error: 'Failed to complete batch scan',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Scan specific IntelliPact repository by name
router.post('/scan/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const { branch = 'main' } = req.body;
    
    console.log(`🔍 Initiating live scan of ${owner}/${repo}`);
    
    const githubRepo = { owner: owner as string, repo: repo as string, branch };
    const scanResults = await githubScanner.scanRepository(githubRepo);
    
    // Save results to database
    await githubScanner.saveScanResults(`${owner}/${repo}`, scanResults);
    
    // Get repository info to generate recommendations
    const repositoryInfo = await repositoryAnalyzer.getRepositoryByName(`${owner}/${repo}`);
    let newRecommendations: Recommendation[] = [];
    
    if (repositoryInfo) {
      newRecommendations = await recommendationEngine.generateRecommendations(repositoryInfo.id);
    }
    
    res.json({
      success: true,
      repository: `${owner}/${repo}`,
      branch,
      scanResults: {
        successful: scanResults.scanSuccessful,
        errorMessage: scanResults.errorMessage,
        patternsExtracted: scanResults.patterns.length,
        securityIssuesFound: scanResults.securityIssues.length,
        typeSafetyIssuesFound: scanResults.typeSafetyIssues.length,
        performanceIssuesFound: scanResults.performanceIssues.length
      },
      issues: {
        security: scanResults.securityIssues,
        typeSafety: scanResults.typeSafetyIssues,
        performance: scanResults.performanceIssues
      },
      recommendations: {
        count: newRecommendations.length,
        generated: newRecommendations.slice(0, 3) // Show first 3
      },
      scannedAt: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error(`Error scanning repository ${req.params.owner}/${req.params.repo}:`, error);
    res.status(500).json({ 
      error: 'Failed to scan repository',
      details: error instanceof Error ? error.message : 'Unknown error occurred',
      repository: `${req.params.owner}/${req.params.repo}`
    });
  }
});

// Get live GitHub scan status for repository
router.get('/:id/scan-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const repository = await repositoryAnalyzer.getRepositoryByName(id as string);
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    
    // Get latest scan results from database
    const patterns = await repositoryAnalyzer.getAllRepositories();
    const currentRepo = patterns.find(r => r.fullName === id);
    
    if (currentRepo) {
      res.json({
        repository: id,
        lastScanned: repository.patternsCount > 0 ? 'Recently' : 'Never',
        patternsCount: currentRepo.patternsCount,
        techStack: currentRepo.techStack,
        primaryLanguage: currentRepo.primaryLanguage,
        scanAvailable: true,
        status: currentRepo.patternsCount > 0 ? 'analyzed' : 'pending_scan'
      });
    } else {
      res.json({
        repository: id,
        lastScanned: 'Never',
        patternsCount: 0,
        scanAvailable: true,
        status: 'pending_scan'
      });
    }
  } catch (error: unknown) {
    console.error('Error getting scan status:', error);
    res.status(500).json({ 
      error: 'Failed to get scan status',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Local Repository Detection Endpoints

// Get all local repositories
router.get('/local/scan', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Starting local repository scan...');
    const result = await localRepoDetector.scanLocalRepositories();
    
    res.json({
      success: true,
      ...result,
      scannedAt: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Error scanning local repositories:', error);
    res.status(500).json({ 
      error: 'Failed to scan local repositories',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Check if a specific repository is cloned locally
router.get('/local/check/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;

    // Validate repository format
    if (!owner || owner === '') {
      return res.status(400).json({
        error: 'Invalid repository format: owner is required'
      });
    }

    if (!repo || repo === '') {
      return res.status(400).json({
        error: 'Invalid repository format: repository name is required'
      });
    }

    const fullName = `${owner}/${repo}`;

    if (!validateRepositoryFormat(fullName)) {
      return res.status(400).json({
        error: 'Invalid repository format. Expected format: owner/repo'
      });
    }

    const validation = await localRepoDetector.validateRepositorySync(fullName);

    res.json({
      repository: fullName,
      ...validation,
      checkedAt: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error(`Error checking local status for ${req.params.owner}/${req.params.repo}:`, error);
    res.status(500).json({
      error: 'Failed to check repository local status',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get detailed info about a local repository
router.get('/local/info/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const fullName = `${owner}/${repo}`;
    
    const localInfo = await localRepoDetector.getLocalRepositoryInfo(fullName);
    
    if (!localInfo) {
      return res.status(404).json({
        error: 'Repository not found locally',
        repository: fullName
      });
    }
    
    res.json({
      repository: fullName,
      localInfo,
      retrievedAt: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error(`Error getting local info for ${req.params.owner}/${req.params.repo}:`, error);
    res.status(500).json({ 
      error: 'Failed to get local repository information',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});


// Trigger repository re-scanning and local detection
router.post('/rescan-all', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Starting comprehensive repository rescan...');
    
    // Step 1: Scan local repositories
    console.log('📂 Scanning local repositories...');
    const localScanResult = await localRepoDetector.scanLocalRepositories();
    
    // Step 2: Fetch from GitHub API
    let githubRepos = [];
    if (process.env.GITHUB_TOKEN) {
      console.log('🐙 Fetching repositories from GitHub API...');
      try {
        const { Octokit } = require('@octokit/rest');
        const octokit = new Octokit({
          auth: process.env.GITHUB_TOKEN,
        });

        // Fetch both user repositories and organization repositories
        const userRepos = await octokit.rest.repos.listForAuthenticatedUser({
          visibility: 'all',
          sort: 'updated',
          per_page: 50
        });

        // Also fetch organization repositories (IntelliPact)
        let orgRepos = [];
        try {
          const intellipactRepos = await octokit.rest.repos.listForOrg({
            org: 'IntelliPact',
            sort: 'updated',
            per_page: 50
          });
          orgRepos = intellipactRepos.data;
          console.log(`📊 Found ${orgRepos.length} IntelliPact organization repositories for rescan`);
        } catch (orgError: unknown) {
          console.warn('⚠️  Could not fetch IntelliPact organization repositories for rescan:', orgError instanceof Error ? orgError.message : 'Unknown error');
        }

        // Combine user and organization repositories, removing duplicates
        const allRepos = [...userRepos.data, ...orgRepos];
        githubRepos = allRepos.reduce((unique: any[], repo: any) => {
          if (!unique.find((r: any) => r.full_name === repo.full_name)) {
            unique.push(repo);
          }
          return unique;
        }, []);
        console.log(`✅ Found ${githubRepos.length} repositories on GitHub`);
      } catch (githubError) {
        console.error('❌ Failed to fetch from GitHub API:', githubError);
      }
    }
    
    // Step 3: Merge and analyze repositories
    const mergedRepos = [];
    const processed = new Set<string>();
    
    // Process GitHub repositories
    for (const repo of githubRepos) {
      const validation = await localRepoDetector.validateRepositorySync(repo.full_name);
      
      const repoData = {
        id: `repo-${repo.id}`,
        name: repo.name,
        fullName: repo.full_name,
        patternsCount: 0,
        language: repo.language || 'Unknown',
        lastUpdated: repo.updated_at,
        categories: repo.topics && repo.topics.length > 0 ? repo.topics : ['general'],
        description: repo.description || `${repo.language || 'Unknown'} repository from GitHub`,
        stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0,
        private: repo.private || false,
        size: repo.size || 0,
        isClonedLocally: validation.isCloned,
        localStatus: validation.isCloned ? {
          remoteMatches: validation.remoteMatches,
          hasLocalChanges: validation.hasLocalChanges,
          needsPush: validation.needsPush,
          currentBranch: validation.localInfo?.currentBranch,
          lastCommit: validation.localInfo?.lastCommit,
          localPath: validation.localInfo?.localPath
        } : null
      };

      // Store in database
      try {
        await repositoryAnalyzer.analyzeRepository({
          repository: repo.full_name,
          settings: {
            categories: repoData.categories
          },
          branches: [repo.default_branch || 'main'],
          patternsCount: 0
        });
      } catch (storeError) {
        console.warn(`Failed to store repository ${repo.full_name}:`, storeError);
      }

      mergedRepos.push(repoData);
      processed.add(repo.full_name);
    }
    
    // Process local-only repositories (not on GitHub or not accessible)
    for (const localRepo of localScanResult.localRepositories) {
      if (localRepo.isGitRepository && localRepo.remoteUrl) {
        const fullName = localRepo.fullName;
        
        if (!processed.has(fullName)) {
          const repoData = {
            id: `local-${localRepo.name}`,
            name: localRepo.name,
            fullName: fullName,
            patternsCount: 0,
            language: 'Unknown',
            lastUpdated: new Date().toISOString(),
            categories: ['local'],
            description: `Local repository: ${localRepo.name}`,
            stars: 0,
            forks: 0,
            private: true, // Assume private for local-only repos
            size: 0,
            isClonedLocally: true,
            localStatus: {
              remoteMatches: true, // Local repo, so it matches by definition
              hasLocalChanges: !localRepo.isCleanWorkingTree,
              needsPush: localRepo.hasUnpushedCommits || false,
              currentBranch: localRepo.currentBranch,
              lastCommit: localRepo.lastCommit,
              localPath: localRepo.localPath
            }
          };

          // Store local-only repository
          try {
            await repositoryAnalyzer.analyzeRepository({
              repository: fullName,
              settings: {
                categories: ['local']
              },
              branches: [localRepo.currentBranch || 'main'],
              patternsCount: 0
            });
          } catch (storeError) {
            console.warn(`Failed to store local repository ${fullName}:`, storeError);
          }

          mergedRepos.push(repoData);
          processed.add(fullName);
        }
      }
    }
    
    // Step 4: Summary statistics
    const localCount = mergedRepos.filter(repo => repo.isClonedLocally).length;
    const githubCount = githubRepos.length;
    const totalCount = mergedRepos.length;
    
    res.json({
      success: true,
      message: 'Repository rescan completed successfully',
      summary: {
        totalRepositories: totalCount,
        githubRepositories: githubCount,
        localRepositories: localCount,
        localOnlyRepositories: localCount - githubCount,
        newRepositoriesFound: totalCount
      },
      localScanDetails: {
        ...localScanResult
      },
      repositories: mergedRepos.slice(0, 10), // Return first 10 for preview
      rescannedAt: new Date().toISOString()
    });
    
  } catch (error: unknown) {
    console.error('❌ Failed to rescan repositories:', error);
    res.status(500).json({ 
      error: 'Failed to rescan repositories',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Synchronize repository pattern counts with improvements data
router.post('/sync-pattern-counts', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Synchronizing repository pattern counts...');
    const result = await repositoryAnalyzer.updateRepositoryPatternCounts();
    
    res.json({
      success: true,
      message: `Successfully synchronized pattern counts: ${result.updated} repositories updated`,
      updated: result.updated,
      errors: result.errors,
      synchronizedAt: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('❌ Failed to synchronize pattern counts:', error);
    res.status(500).json({
      error: 'Failed to synchronize pattern counts',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Update repository descriptions and metadata from GitHub
router.post('/update-metadata', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Updating repository metadata from GitHub...');
    
    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        success: false,
        error: 'GitHub token not configured'
      });
    }

    const repositories = await repositoryAnalyzer.getAllRepositories();
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    const updatedRepos = [];
    const errors = [];

    for (const repo of repositories) {
      try {
        const [owner, repoName] = repo.fullName.split('/');
        if (!owner || !repoName) continue;

        const githubRepo = await octokit.rest.repos.get({
          owner,
          repo: repoName
        });

        // Update repository record with fresh GitHub metadata
        await dbRun(`
          UPDATE repositories 
          SET description = ?, 
              updated_at = ?
          WHERE full_name = ?
        `, [
          githubRepo.data.description || repo.description,
          new Date().toISOString(),
          repo.fullName
        ]);

        updatedRepos.push({
          fullName: repo.fullName,
          description: githubRepo.data.description,
          stars: githubRepo.data.stargazers_count,
          forks: githubRepo.data.forks_count,
          lastUpdated: githubRepo.data.updated_at
        });

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (repoError) {
        console.warn(`Failed to update ${repo.fullName}:`, repoError);
        errors.push({
          repository: repo.fullName,
          error: repoError instanceof Error ? repoError.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      message: `Updated metadata for ${updatedRepos.length} repositories`,
      updated: updatedRepos.length,
      errors: errors.length,
      repositories: updatedRepos,
      errorDetails: errors.length > 0 ? errors : undefined,
      updatedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('❌ Failed to update repository metadata:', error);
    res.status(500).json({ 
      error: 'Failed to update repository metadata',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});


export default router;