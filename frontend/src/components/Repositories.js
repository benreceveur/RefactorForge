import React, { useState, useEffect } from 'react';
import { GitBranch, RefreshCw, Search, Filter, AlertCircle, CheckCircle, Clock, Code, Star, GitCommit, FolderOpen, Archive, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from '../services/api';

const Repositories = () => {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [analyzingRepos, setAnalyzingRepos] = useState(new Set());

  // REMOVED: Hardcoded local repository list - now using API data
  // This was causing repositories to show "Clone Required" even when they exist locally
  
  const isRepoAvailableLocally = (repo) => {
    // Use API-provided isClonedLocally data instead of hardcoded list
    return repo.isClonedLocally === true;
  };

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllRepositories();
      setRepositories(response || []);
      setError(null);
      console.log('🔄 Loaded repositories with local status:', response?.length || 0);
    } catch (err) {
      console.error('Failed to fetch repositories:', err);
      setError('Failed to load repositories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const syncPatternCounts = async () => {
    try {
      console.log('🔄 Triggering pattern count sync...');
      const result = await apiService.syncRepositoryPatternCounts();
      console.log('✅ Sync result:', result);
      
      if (result.success) {
        alert(`✅ Successfully synchronized pattern counts!\n\nUpdated: ${result.updated} repositories\nErrors: ${result.errors?.length || 0}`);
        // Refresh repositories to show updated counts
        await fetchRepositories();
      } else {
        alert(`❌ Synchronization failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('❌ Failed to sync pattern counts:', err);
      alert(`❌ Failed to synchronize pattern counts: ${err.message || 'Unknown error'}`);
    }
  };

  const handleAnalyzeRepository = async (repository) => {
    const repoId = repository.fullName || repository.name || repository.id;
    setAnalyzingRepos(prev => new Set([...prev, repoId]));
    
    try {
      // Try to refresh/analyze the repository
      const result = await apiService.refreshRepository(repoId);
      
      if (result.success === false) {
        // Analysis failed - show error to user
        alert(`❌ Analysis failed for ${repository.name}:\n\n${result.error || 'Unknown error'}\n\nSuggested path: ${result.suggestedPath || 'Not available'}`);
        console.error(`Failed to analyze ${repository.name}:`, result);
      } else {
        // Extract improvement count from the correct field
        const improvementCount = result.scanResults?.improvementsFound || 
                                result.newImprovements?.length || 
                                result.scanResults?.improvementCount || 0;
        
        // Extract improvements details
        const improvements = result.newImprovements || [];
        const improvementSummary = improvements.map(imp => 
          `• ${imp.title}`
        ).slice(0, 3).join('\n');
        
        // Update the repository in the list with new data
        setRepositories(prev => prev.map(repo => 
          (repo.name === repoId || repo.id === repoId) 
            ? { 
                ...repo, 
                patternsCount: improvementCount,
                status: 'active',
                lastAnalyzed: new Date().toISOString()
              }
            : repo
        ));
        
        // Show success message with actual improvement details
        const message = improvementCount > 0 
          ? `✅ Successfully analyzed ${repository.name}!\n\nFound ${improvementCount} code improvements:\n\n${improvementSummary}${improvements.length > 3 ? '\n...' : ''}`
          : `✅ Successfully analyzed ${repository.name}!\n\nNo improvements needed - code is clean!`;
          
        alert(message);
        console.log(`✅ Successfully analyzed ${repository.name}`, result);
      }
    } catch (err) {
      console.error(`Failed to analyze ${repository.name}:`, err);
      alert(`❌ Failed to connect to analysis service for ${repository.name}. Please ensure the API server is running.`);
    } finally {
      setAnalyzingRepos(prev => {
        const newSet = new Set(prev);
        newSet.delete(repoId);
        return newSet;
      });
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'inactive': return Archive;
      case 'error': return AlertCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'inactive': return 'text-gray-400';
      case 'error': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  // Deduplicate repositories by name and merge data from duplicates
  const deduplicateRepositories = (repos) => {
    const seen = new Map();
    let duplicatesFound = 0;
    
    repos.forEach(repo => {
      const key = repo.name || repo.id || 'unknown';
      
      if (seen.has(key)) {
        duplicatesFound++;
        console.log(`🔍 Duplicate repository detected: "${key}" - merging data`);
        
        // Merge data from duplicate, keeping the most complete version
        const existing = seen.get(key);
        const merged = {
          ...existing,
          ...repo,
          // Preserve the highest pattern count
          patternsCount: Math.max(existing.patternsCount || 0, repo.patternsCount || 0),
          // Use the most recent update date
          updatedAt: existing.updatedAt && repo.updatedAt 
            ? (new Date(existing.updatedAt) > new Date(repo.updatedAt) ? existing.updatedAt : repo.updatedAt)
            : existing.updatedAt || repo.updatedAt,
          // Combine any unique properties
          description: existing.description || repo.description,
          url: existing.url || repo.url,
          language: existing.language || repo.language,
          stars: Math.max(existing.stars || 0, repo.stars || 0)
        };
        seen.set(key, merged);
      } else {
        seen.set(key, repo);
      }
    });
    
    if (duplicatesFound > 0) {
      console.log(`✅ Deduplicated ${duplicatesFound} repository entries (${repos.length} → ${seen.size})`);
    }
    
    return Array.from(seen.values());
  };

  const filteredRepositories = deduplicateRepositories(repositories)
    .filter(repo => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        repo.name?.toLowerCase().includes(searchLower) ||
        repo.fullName?.toLowerCase().includes(searchLower) ||
        repo.description?.toLowerCase().includes(searchLower) ||
        repo.organization?.toLowerCase().includes(searchLower) ||
        (repo.fullName && repo.fullName.includes('/') && repo.fullName.split('/')[0].toLowerCase().includes(searchLower));

      const matchesFilter = filterStatus === 'all' ||
        (filterStatus === 'analyzed' && repo.patternsCount > 0) ||
        (filterStatus === 'pending' && repo.patternsCount === 0);

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'patterns':
          return (b.patternsCount || 0) - (a.patternsCount || 0);
        case 'updated':
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-memory-600 animate-spin" />
          <span className="ml-3 text-lg text-gray-600">Loading repositories...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="flex items-center justify-center text-red-600">
          <AlertCircle className="w-8 h-8" />
          <span className="ml-3 text-lg">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Repositories</p>
              <p className="text-2xl font-bold text-gray-900">{repositories.length}</p>
            </div>
            <FolderOpen className="w-8 h-8 text-memory-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Analyzed</p>
              <p className="text-2xl font-bold text-green-600">
                {repositories.filter(r => r.patternsCount > 0).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Analysis</p>
              <p className="text-2xl font-bold text-yellow-600">
                {repositories.filter(r => r.patternsCount === 0).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Patterns</p>
              <p className="text-2xl font-bold text-memory-600">
                {repositories.reduce((sum, r) => sum + (r.patternsCount || 0), 0)}
              </p>
            </div>
            <Code className="w-8 h-8 text-memory-600" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search repositories, organizations, or descriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-memory-500"
              />
            </div>
          </div>

          {/* Filter by Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-memory-500"
          >
            <option value="all">All Repositories</option>
            <option value="analyzed">Analyzed</option>
            <option value="pending">Pending Analysis</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-memory-500"
          >
            <option value="name">Sort by Name</option>
            <option value="patterns">Sort by Patterns</option>
            <option value="updated">Sort by Last Updated</option>
            <option value="status">Sort by Status</option>
          </select>

          {/* Sync Button */}
          <button
            onClick={syncPatternCounts}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Counts
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchRepositories}
            className="px-4 py-2 bg-memory-600 text-white rounded-lg hover:bg-memory-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Repository List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredRepositories.map((repo, index) => {
            const StatusIcon = getStatusIcon(repo.status);
            const isAnalyzing = analyzingRepos.has(repo.name || repo.id);
            const isLocallyAvailable = isRepoAvailableLocally(repo);
            
            // Repository clone status is now determined by API data instead of hardcoded list
            
            return (
              <motion.div
                key={`repo-${repo.name || repo.id || 'unknown'}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow ${
                  isLocallyAvailable ? 'border-gray-200' : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                {/* Repository Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-5 h-5 text-memory-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {repo.name || 'Unknown Repository'}
                      </h3>
                      {/* Organization and repo metadata */}
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {/* Organization Display */}
                        {repo.organization && (
                          <span className="text-xs text-memory-700 bg-memory-100 px-2 py-0.5 rounded">
                            {repo.organization}
                          </span>
                        )}
                        {/* Extract organization from fullName if not in organization field */}
                        {!repo.organization && repo.fullName && repo.fullName.includes('/') && (
                          <span className="text-xs text-memory-700 bg-memory-100 px-2 py-0.5 rounded">
                            {repo.fullName.split('/')[0]}
                          </span>
                        )}
                        {repo.private && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            Private
                          </span>
                        )}
                        {isLocallyAvailable ? (
                          <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
                            ✓ Local Clone
                          </span>
                        ) : (
                          <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                            Clone Required
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <StatusIcon className={`w-5 h-5 ${getStatusColor(repo.status)}`} />
                </div>

                {/* Repository Description */}
                <div className="text-sm text-gray-600 mb-4">
                  {repo.description && repo.description !== 'general repository' ? (
                    <p className="line-clamp-2">{repo.description}</p>
                  ) : (
                    <p className="line-clamp-2 italic">
                      {repo.organization || (repo.fullName && repo.fullName.includes('/') ? repo.fullName.split('/')[0] : 'Unknown')} repository
                      {repo.language && repo.language !== 'Unknown' && ` • ${repo.language}`}
                    </p>
                  )}
                </div>

                {/* Repository Stats */}
                <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                  {repo.language && (
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-memory-600"></div>
                      {repo.language}
                    </div>
                  )}
                  {repo.stars !== undefined && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      {repo.stars}
                    </div>
                  )}
                  {repo.patternsCount !== undefined && (
                    <div className="flex items-center gap-1">
                      <Code className="w-4 h-4" />
                      {repo.patternsCount} patterns
                    </div>
                  )}
                </div>

                {/* Last Updated */}
                {repo.updatedAt && (
                  <p className="text-xs text-gray-400 mb-4">
                    Last updated: {new Date(repo.updatedAt).toLocaleDateString()}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {(repo.url || repo.fullName) && (
                    <a
                      href={repo.url || `https://github.com/${repo.fullName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium text-center"
                    >
                      View on GitHub
                    </a>
                  )}
                  {isLocallyAvailable ? (
                    <button
                      onClick={() => handleAnalyzeRepository(repo)}
                      disabled={isAnalyzing}
                      className={`flex-1 px-3 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 ${
                        isAnalyzing 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-memory-600 text-white hover:bg-memory-700'
                      }`}
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Analyze
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex-1 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium text-center flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" />
                      Clone Required
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredRepositories.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No repositories found</h3>
            <p className="text-gray-600">
              {searchTerm 
                ? `No repositories match "${searchTerm}"`
                : 'No repositories available'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Repositories;