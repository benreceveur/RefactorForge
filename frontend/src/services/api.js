// API Service for RefactorForge
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001';

class MemoryAPIService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Pattern operations
  async searchPatterns(query, options = {}) {
    return this.request('/api/patterns/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        limit: options.limit || 10,
        minSimilarity: options.minSimilarity || 0.1,
        category: options.category,
        repository: options.repository
      })
    });
  }

  async getAllPatterns(options = {}) {
    const params = new URLSearchParams({
      limit: options.limit || 50,
      ...(options.category && { category: options.category }),
      ...(options.repository && { repository: options.repository })
    });

    return this.request(`/api/patterns?${params}`);
  }

  async getPattern(id) {
    return this.request(`/api/patterns/${id}`);
  }

  async createPattern(pattern) {
    return this.request('/api/patterns', {
      method: 'POST', 
      body: JSON.stringify({
        content: pattern.content,
        description: pattern.description,
        category: pattern.category,
        tags: pattern.tags,
        context: pattern.metadata || {},
        source: 'web'
      })
    });
  }

  async updatePattern(id, pattern) {
    return this.request(`/api/patterns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(pattern)
    });
  }

  async deletePattern(id) {
    return this.request(`/api/patterns/${id}`, {
      method: 'DELETE'
    });
  }

  // Analytics operations
  async getAnalytics() {
    // Use the backend analytics endpoint directly
    return this.request('/api/analytics');
  }

  async getSearchHistory() {
    return this.request('/api/searches/history');
  }

  async getRepositories() {
    return this.request('/api/repositories/with-local-status');
  }

  async getGitHubIntegrations() {
    return this.request('/api/github/integrations');
  }

  async addGitHubIntegration(integration) {
    return this.request('/api/github/integrations', {
      method: 'POST',
      body: JSON.stringify(integration)
    });
  }

  async getTimeline(options = {}) {
    const params = new URLSearchParams({
      limit: options.limit || 50,
      ...(options.startDate && { startDate: options.startDate }),
      ...(options.endDate && { endDate: options.endDate })
    });

    return this.request(`/api/timeline?${params}`);
  }

  async getCodeImprovements(options = {}) {
    const params = new URLSearchParams({
      category: options.category || 'all',
      impact: options.impact || 'all',
      sortBy: options.sortBy || 'impact',
      limit: options.limit || 50
    });

    return this.request(`/api/improvements?${params}`);
  }

  // Event tracking for timeline
  async trackEvent(eventData) {
    try {
      return this.request('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          type: eventData.type,
          category: eventData.category || 'user_activity',
          title: eventData.title,
          description: eventData.description,
          context: {
            user: 'web_user',
            sessionId: this.getSessionId(),
            ...eventData.context
          },
          metrics: eventData.metrics || {}
        })
      });
    } catch (error) {
      console.warn('Failed to track event:', error);
      // Don't fail the main operation if tracking fails
    }
  }

  getSessionId() {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  }

  // Multi-Repository System Methods
  async getAllRepositories() {
    const response = await this.request('/api/repositories/with-local-status');
    // The response is already an array, no need to extract repositories property
    return Array.isArray(response) ? response : [];
  }

  async getRepositoryById(repositoryId) {
    return this.request(`/api/repositories/${repositoryId}`);
  }

  async getRepositoryRecommendations(repositoryId) {
    return this.request(`/api/repositories/${repositoryId}/recommendations`);
  }

  async generateRepositoryRecommendations(repositoryId) {
    return this.request(`/api/repositories/${repositoryId}/recommendations`, {
      method: 'POST'
    });
  }

  async initializeMultiRepositoryAnalysis() {
    return this.request('/api/repositories/initialize-analysis', {
      method: 'POST'
    });
  }

  async getRepositoryStats() {
    return this.request('/api/repositories/stats/overview');
  }

  // Refresh a specific repository with live GitHub scanning
  async refreshRepository(repositoryId) {
    try {
      // Use the new regenerate endpoint with live scanning
      const response = await this.request(`/api/analysis/repositories/${encodeURIComponent(repositoryId)}/recommendations/regenerate`, {
        method: 'POST',
        body: JSON.stringify({
          forceScan: true // Enable live GitHub scanning
        })
      });

      // Return enhanced result for UI
      return {
        success: true,
        repositoryId: repositoryId,
        newRecommendations: response.recommendationsCount || 0,
        scanPerformed: response.scanPerformed,
        scanResults: response.scanResults,
        message: response.message || `Generated ${response.recommendationsCount || 0} new recommendations`
      };
    } catch (error) {
      console.error('Error refreshing repository:', error);
      throw error;
    }
  }

  // Get ALL recommendations from ALL repositories
  async getAllRepositoryRecommendations(options = {}) {
    try {

      // Use the existing /api/improvements endpoint which already has all the data
      const params = new URLSearchParams({
        category: options.category || 'all',
        impact: options.impact || 'all',
        sortBy: options.sortBy || 'impact',
        limit: options.limit || 50
      });

      const response = await this.request(`/api/improvements?${params}`);

      // Transform the response to match the expected format
      const allRecommendations = response.improvements || [];
      const repositories = await this.getAllRepositories();

      // Filter and sort based on options (backend already does this, but for consistency)
      let filtered = allRecommendations;
      
      if (options.category && options.category !== 'all') {
        filtered = filtered.filter(rec => rec.category === options.category);
      }
      
      if (options.impact && options.impact !== 'all') {
        filtered = filtered.filter(rec => rec.impact === options.impact);
      }

      // Sort recommendations
      if (options.sortBy) {
        filtered.sort((a, b) => {
          switch (options.sortBy) {
            case 'impact':
              const impactOrder = { critical: 4, high: 3, medium: 2, low: 1 };
              return impactOrder[b.impact] - impactOrder[a.impact];
            case 'repository':
              return a.repository.localeCompare(b.repository);
            case 'category':
              return a.category.localeCompare(b.category);
            default:
              return 0;
          }
        });
      }

      return {
        success: true,
        improvements: filtered,
        totalCount: response.total || filtered.length,
        repositoryCount: repositories.length,
        stats: {
          byPriority: filtered.reduce((acc, rec) => {
            acc[rec.impact] = (acc[rec.impact] || 0) + 1;
            return acc;
          }, {}),
          byCategory: filtered.reduce((acc, rec) => {
            acc[rec.category] = (acc[rec.category] || 0) + 1;
            return acc;
          }, {}),
          byRepository: filtered.reduce((acc, rec) => {
            acc[rec.repository] = (acc[rec.repository] || 0) + 1;
            return acc;
          }, {})
        }
      };
    } catch (error) {
      console.error('Failed to get all repository recommendations:', error);
      throw error;
    }
  }

  // Repository rescan methods
  async rescanAllRepositories() {
    return this.request('/api/repositories/rescan-all', {
      method: 'POST'
    });
  }

  async scanAllRepositories() {
    return this.request('/api/repositories/scan-all', {
      method: 'POST'
    });
  }

  // Synchronize repository pattern counts with improvements data
  async syncRepositoryPatternCounts() {
    return this.request('/api/repositories/sync-pattern-counts', {
      method: 'POST'
    });
  }

  // Helper methods (kept for backward compatibility with other components)
}

// Export singleton instance
const apiService = new MemoryAPIService();
export default apiService;