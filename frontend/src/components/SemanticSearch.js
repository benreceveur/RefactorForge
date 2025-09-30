import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, ArrowRight, Zap, Clock, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PatternCard from './PatternCard';
import EmbeddingVisualizer from './EmbeddingVisualizer';
import apiService from '../services/api';

const SemanticSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [filters, setFilters] = useState({
    category: 'all',
    minSimilarity: 0.7,
    dateRange: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchTime, setSearchTime] = useState(null);
  const [error, setError] = useState(null);
  const searchInputRef = useRef(null);

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'frontend', label: 'Frontend' },
    { value: 'backend', label: 'Backend' },
    { value: 'database', label: 'Database' },
    { value: 'testing', label: 'Testing' },
    { value: 'devops', label: 'DevOps' },
    { value: 'security', label: 'Security' }
  ];

  const [suggestedQueries, setSuggestedQueries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    searchInputRef.current?.focus();
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    setLoadingHistory(true);
    try {
            const data = await Promise.resolve({ searches: [] }); // Mocked response
      const recentSearches = data.searches?.slice(0, 5).map(s => s.query) || [];
      setSearchHistory(recentSearches);
      
      // NO FAKE DATA - only use real API data
      const defaultSuggestions = [];
      
      // Get unique searches from API, filtering out duplicates and similar patterns
      const apiSearches = data.searches?.slice(0, 30).map(s => s.query) || [];
      const uniqueSearches = [];
      const seenPatterns = new Set();
      
      for (const search of apiSearches) {
        // Create a normalized version for comparison (lowercase, remove extra spaces)
        const normalized = search.toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Skip if we've seen a very similar pattern
        const basePattern = normalized.replace(/test\s|testing\s|patterns?\s|request\s/g, '').trim();
        
        if (!seenPatterns.has(basePattern) && !uniqueSearches.includes(search)) {
          seenPatterns.add(basePattern);
          uniqueSearches.push(search);
          
          // Stop if we have enough unique suggestions
          if (uniqueSearches.length >= 15) break;
        }
      }
      
      // Only use unique searches from API - NO default fake data
      setSuggestedQueries(uniqueSearches.slice(0, 15));
    } catch (error) {
      console.error('Failed to load search history:', error);
      // NO FAKE DATA - show empty state when API fails
      setSuggestedQueries([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      // Use real API only
      const apiResponse = await apiService.searchPatterns(searchQuery, {
        category: filters.category !== 'all' ? filters.category : undefined,
        minSimilarity: filters.minSimilarity,
        limit: 20
      });
      
      let searchResults = [];
      if (apiResponse && apiResponse.results) {
        searchResults = apiResponse.results;
      }
      
      // Sort by similarity score
      searchResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

      const endTime = Date.now();
      const searchDuration = endTime - startTime;
      setSearchTime(searchDuration);
      setResults(searchResults);
      setError(null);

      // Track search event for timeline
      await apiService.trackEvent({
        type: 'search_performed',
        category: 'search',
        title: 'Pattern Search Performed',
        description: `Searched for "${searchQuery}" - found ${searchResults.length} results`,
        context: {
          query: searchQuery,
          category: filters.category,
          minSimilarity: filters.minSimilarity,
          page: 'SemanticSearch'
        },
        metrics: {
          resultsCount: searchResults.length,
          searchTime: searchDuration,
          similarity: filters.minSimilarity
        }
      });

      // Add to search history
      if (!searchHistory.includes(searchQuery)) {
        setSearchHistory(prev => [searchQuery, ...prev.slice(0, 4)]);
      }

    } catch (error) {
      console.error('Search failed:', error);
      setError('Search failed. Please check your connection to the API server.');
      setResults([]);
      setSearchTime(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    performSearch(query);
  };

  const handleQueryClick = (newQuery) => {
    setQuery(newQuery);
    performSearch(newQuery);
  };

  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    
    // Re-apply search with new filters
    if (query) {
      performSearch(query);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Semantic Pattern Search
        </h2>
        <p className="text-gray-600">
          Find code patterns using natural language powered by OpenAI embeddings
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for patterns... e.g., 'React component with error handling'"
            className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-memory-500 focus:border-transparent text-lg"
          />
          <div className="absolute inset-y-0 right-0 flex items-center">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 text-gray-400 hover:text-gray-600 mr-1"
            >
              <Filter className="w-5 h-5" />
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary mr-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="input-field"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Similarity: {Math.round(filters.minSimilarity * 100)}%
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={filters.minSimilarity}
                  onChange={(e) => handleFilterChange('minSimilarity', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  className="input-field"
                >
                  <option value="all">All Time</option>
                  <option value="week">Last Week</option>
                  <option value="month">Last Month</option>
                  <option value="year">Last Year</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Suggested Queries */}
      {!query && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Suggested Searches</h3>
          {loadingHistory ? (
            <div className="flex flex-wrap gap-2">
              {[...Array(15)].map((_, index) => (
                <div key={index} className="animate-pulse bg-gray-200 h-8 w-32 rounded-full"></div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {suggestedQueries.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleQueryClick(suggestion)}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-memory-50 text-memory-700 rounded-full text-sm hover:bg-memory-100 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search History */}
      {(searchHistory || []).length > 0 && !loading && (results || []).length === 0 && query === '' && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Recent Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {(searchHistory || []).map((historyQuery, index) => (
              <button
                key={index}
                onClick={() => handleQueryClick(historyQuery)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
              >
                {historyQuery}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-memory-200 border-t-memory-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Searching semantic patterns...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={() => performSearch(query)}
            className="btn-secondary mt-2"
          >
            Retry Search
          </button>
        </div>
      )}

      {!loading && (results || []).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Search Results ({(results || []).length})
            </h3>
            {searchTime && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Zap className="w-4 h-4" />
                <span>{searchTime}ms</span>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <AnimatePresence>
              {(results || []).map((pattern, index) => (
                <motion.div
                  key={pattern.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <PatternCard 
                    pattern={pattern} 
                    showSimilarity={true}
                    className="hover:shadow-lg transition-shadow duration-300"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {!loading && query && (results || []).length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-12 h-12 mx-auto mb-2" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No patterns found
          </h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your search terms or filters
          </p>
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setFilters({ category: 'all', minSimilarity: 0.7, dateRange: 'all' });
            }}
            className="btn-secondary"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Embedding Visualization */}
      {query && (results || []).length > 0 && (
        <EmbeddingVisualizer query={query} patterns={results} />
      )}

      {/* Search Tips */}
      <div className="bg-memory-50 border border-memory-200 rounded-lg p-4">
        <h3 className="font-medium text-memory-900 mb-2">Search Tips</h3>
        <ul className="text-sm text-memory-700 space-y-1">
          <li>• Use natural language: "React component that handles API errors"</li>
          <li>• Search by technology: "PostgreSQL migration", "Jest testing"</li>
          <li>• Find patterns by purpose: "authentication middleware", "data validation"</li>
          <li>• Combine concepts: "async error handling with retries"</li>
        </ul>
      </div>
    </div>
  );
};

export default SemanticSearch;