import { Router, Request, Response } from 'express';
import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger';
import { dbAll } from '../utils/database-helpers';
import { RepositoryRow } from '../types/database.types';

// Type definition for integration response
interface IntegrationResponse {
  integrations: any[];
  total: number;
  active: number;
  totalPatterns: number;
  webhooksActive: number;
  source: string;
  error?: string;
}

const router = Router();

// Initialize GitHub API client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Get repositories from local database as fallback
const getLocalRepositories = async (): Promise<IntegrationResponse> => {
  try {
    logger.info('Fetching repositories from local database as fallback');

    const repositories = await dbAll<RepositoryRow>(
      'SELECT * FROM repositories ORDER BY updated_at DESC LIMIT 50'
    );

    // Transform local repositories to match GitHub integration format
    const transformedRepos = repositories.map((repo) => {
      let categories: string[] = [];
      let branches: string[] = [];

      try {
        categories = repo.categories ? JSON.parse(repo.categories) : ['general'];
      } catch {
        categories = ['general'];
      }

      try {
        branches = repo.branches ? JSON.parse(repo.branches) : ['main'];
      } catch {
        branches = ['main'];
      }

      return {
        id: `local-integration-${repo.id}`,
        repository: repo.full_name,
        status: repo.analysis_status === 'analyzed' ? 'active' : 'pending',
        lastSync: repo.last_analyzed || repo.updated_at,
        patternsCount: repo.patterns_count || 0,
        webhooksEnabled: false, // Local repos don't have webhooks
        branches: branches,
        settings: {
          autoSave: true,
          categories: categories,
          minStars: 0
        },
        // Transform local repository data to match GitHub format
        stars: 0, // Not available in local db
        forks: 0, // Not available in local db
        language: repo.primary_language,
        description: repo.description,
        private: false, // Assume public for local repos
        updated_at: repo.updated_at,
        created_at: repo.created_at,
        size: 0, // Not available in local db
        topics: categories,
        // Additional local-specific fields
        organization: repo.organization,
        tech_stack: repo.tech_stack,
        framework: repo.framework,
        isLocal: true // Flag to indicate this is from local database
      };
    });

    return {
      integrations: transformedRepos,
      total: transformedRepos.length,
      active: transformedRepos.filter(repo => repo.status === 'active').length,
      totalPatterns: transformedRepos.reduce((sum, repo) => sum + repo.patternsCount, 0),
      webhooksActive: 0, // Local repos don't have webhooks
      source: 'local_database'
    };
  } catch (error: any) {
    logger.error('Failed to fetch repositories from local database', { error: error.message });
    return {
      integrations: [],
      total: 0,
      active: 0,
      totalPatterns: 0,
      webhooksActive: 0,
      source: 'local_database',
      error: 'Failed to fetch local repositories'
    };
  }
};

// Get GitHub integrations from real GitHub API with local database fallback
const getGitHubIntegrations = async (): Promise<IntegrationResponse> => {
  try {
    if (!process.env.GITHUB_TOKEN) {
      logger.warn('No GitHub token configured, falling back to local repositories');
      const localData = await getLocalRepositories();
      return {
        ...localData,
        error: 'GitHub token not configured - showing local repositories'
      };
    }

    // Get authenticated user's repositories
    logger.info('Fetching user repositories from GitHub API');
    const userRepos = await octokit.rest.repos.listForAuthenticatedUser({
      visibility: 'all',
      sort: 'updated',
      per_page: 50
    });

    // Also get organization repositories if user is part of organizations
    logger.info('Fetching user organizations');
    let orgRepos: any[] = [];
    try {
      const orgs = await octokit.rest.orgs.listForAuthenticatedUser();
      for (const org of orgs.data.slice(0, 5)) { // Limit to first 5 orgs to avoid rate limits
        const orgRepoResponse = await octokit.rest.repos.listForOrg({
          org: org.login,
          sort: 'updated',
          per_page: 20
        });
        orgRepos.push(...orgRepoResponse.data);
      }
    } catch (orgError) {
      logger.warn('Could not fetch organization repositories:', orgError as any);
    }

    // Combine user and org repositories
    const allRepos = [...userRepos.data, ...orgRepos];
    
    // Convert to RefactorForge integration format
    const repositories = allRepos.map((repo: any) => ({
      id: `integration-${repo.id}`,
      repository: repo.full_name,
      status: 'active',
      lastSync: new Date().toISOString(),
      patternsCount: 0, // Will be populated when repository is scanned
      webhooksEnabled: false, // Can be implemented later
      branches: ['main', 'master', 'develop'], // Default branches, can be fetched from API
      settings: {
        autoSave: true,
        categories: repo.topics && repo.topics.length > 0 ? repo.topics : ['general'],
        minStars: 0
      },
      // Additional real GitHub data
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      description: repo.description,
      private: repo.private,
      updated_at: repo.updated_at,
      created_at: repo.created_at,
      size: repo.size,
      topics: repo.topics || []
    }));

    return {
      integrations: repositories,
      total: repositories.length,
      active: repositories.filter(repo => repo.status === 'active').length,
      totalPatterns: repositories.reduce((sum, repo) => sum + repo.patternsCount, 0),
      webhooksActive: repositories.filter(repo => repo.webhooksEnabled).length,
      source: 'github_api'
    };
  } catch (error: any) {
    logger.error('Failed to fetch GitHub integrations', { error: error.message, status: error.status });

    // Provide helpful error messages based on error type
    let errorMessage = 'Failed to fetch GitHub repositories';
    if (error.status === 401) {
      errorMessage = 'GitHub token is invalid or expired';
    } else if (error.status === 403) {
      errorMessage = 'GitHub API rate limit exceeded or insufficient permissions';
    } else if (error.status === 404) {
      errorMessage = 'GitHub API endpoint not found';
    }

    // Fall back to local repositories when GitHub API fails
    logger.warn('GitHub API failed, falling back to local repositories');
    try {
      const localData = await getLocalRepositories();
      return {
        ...localData,
        error: `${errorMessage} - showing local repositories instead`
      };
    } catch (localError: any) {
      logger.error('Local repository fallback also failed', { error: localError.message });
      return {
        integrations: [],
        total: 0,
        active: 0,
        totalPatterns: 0,
        webhooksActive: 0,
        source: 'none',
        error: `${errorMessage}. Local repository fallback also failed: ${localError.message}`
      };
    }
  }
};

// Get all GitHub integrations
router.get('/integrations', async (req: Request, res: Response) => {
  try {
    const integrations = await getGitHubIntegrations();

    // Set appropriate HTTP status based on source
    let statusCode = 200;
    if ('error' in integrations && integrations.source === 'local_database') {
      statusCode = 206; // Partial Content - indicating fallback data
    } else if ('error' in integrations && integrations.source === 'none') {
      statusCode = 503; // Service Unavailable
    }

    res.status(statusCode).json(integrations);
  } catch (error: any) {
    logger.error('Error fetching GitHub integrations', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch GitHub integrations',
      integrations: [],
      total: 0,
      active: 0,
      totalPatterns: 0,
      webhooksActive: 0,
      source: 'none'
    });
  }
});

// Add new GitHub integration (for manual repository addition)
router.post('/integrations', async (req: Request, res: Response) => {
  try {
    const { repository, settings } = req.body;
    
    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        error: 'GitHub token not configured'
      });
    }
    
    // Validate that the repository exists and user has access
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      return res.status(400).json({
        error: 'Invalid repository format. Use owner/repo format.'
      });
    }

    try {
      const repoInfo = await octokit.rest.repos.get({
        owner,
        repo
      });

      const newIntegration = {
        id: `integration-${repoInfo.data.id}`,
        repository: repoInfo.data.full_name,
        status: 'active',
        lastSync: new Date().toISOString(),
        patternsCount: 0,
        webhooksEnabled: false,
        branches: [repoInfo.data.default_branch || 'main'],
        settings: {
          autoSave: true,
          categories: repoInfo.data.topics || ['general'],
          minStars: 0,
          ...settings
        },
        // Real GitHub data
        stars: repoInfo.data.stargazers_count,
        forks: repoInfo.data.forks_count,
        language: repoInfo.data.language,
        description: repoInfo.data.description,
        private: repoInfo.data.private
      };

      res.json(newIntegration);
    } catch (repoError: any) {
      if (repoError.status === 404) {
        return res.status(404).json({
          error: 'Repository not found or not accessible'
        });
      }
      throw repoError;
    }
  } catch (error) {
    console.error('Error adding GitHub integration:', error);
    res.status(500).json({
      error: 'Failed to add GitHub integration'
    });
  }
});

// Sync specific integration
router.post('/integrations/:id/sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        success: false,
        error: 'GitHub token not configured'
      });
    }

    // Extract repository info from integration ID
    // For now, return a successful sync response
    // In a full implementation, this would trigger the GitHub scanner
    res.json({
      success: true,
      message: `Integration ${id} sync initiated`,
      patternsCount: 0, // Will be updated when scan completes
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error syncing GitHub integration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync integration'
    });
  }
});

// Update webhook settings
router.put('/integrations/:id/webhooks', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    
    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        success: false,
        error: 'GitHub token not configured'
      });
    }
    
    // For now, just return success
    // In a full implementation, this would configure GitHub webhooks
    res.json({
      success: true,
      message: `Webhooks ${enabled ? 'enabled' : 'disabled'} for integration ${id}`
    });
  } catch (error) {
    console.error('Error updating webhook settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update webhook settings'
    });
  }
});

// Test endpoint to get local repositories (for debugging and testing)
router.get('/integrations/local', async (req: Request, res: Response) => {
  try {
    logger.info('Testing local repositories fallback endpoint');
    const localData = await getLocalRepositories();
    res.json(localData);
  } catch (error: any) {
    logger.error('Error testing local repositories', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch local repositories',
      integrations: [],
      total: 0,
      active: 0,
      totalPatterns: 0,
      webhooksActive: 0,
      source: 'none'
    });
  }
});

export default router;