import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Shield, 
  TestTube, 
  Layers, 
  Wrench, 
  Filter, 
  Clock,
  Target,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Zap,
  Code,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Play,
  Copy,
  Package,
  Loader,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import apiService from '../services/api';

const CodeImprovements = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedImpact, setSelectedImpact] = useState('all');
  const [sortBy, setSortBy] = useState('impact');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [systemDarkMode, setSystemDarkMode] = useState(false);
  const [copyStatus, setCopyStatus] = useState({});

  // Add error boundary to catch potential React errors
  useEffect(() => {
    const handleError = (error) => {
      console.error('🚨 CodeImprovements Component Error:', error);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Debug expandedCard state changes
  useEffect(() => {
    console.log('🔄 Expanded card state changed:', expandedCard);
  }, [expandedCard]);

  // Handle Chrome extension runtime errors that could interfere with button clicks
  useEffect(() => {
    // Suppress Chrome extension runtime errors that don't affect our app
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      const message = args.join(' ');
      if (message.includes('runtime.lastError') || message.includes('message channel closed')) {
        // Ignore Chrome extension warnings that don't affect our React app
        return;
      }
      originalConsoleWarn.apply(console, args);
    };

    return () => {
      console.warn = originalConsoleWarn;
    };
  }, []);

  // Generate stable unique keys for React components
  // NEVER rely on API IDs as they may contain duplicates
  const generateUniqueKey = (improvement, index) => {
    // ALWAYS use index as primary key component for guaranteed uniqueness
    const primaryKey = `improvement-${index}`;
    
    // Create stable content-based hash for consistency across re-renders
    // REMOVED timestamp suffix to ensure stable keys for proper state management
    const contentHash = (
      (improvement.title || '') + 
      (improvement.category || improvement.recommendationType || '') + 
      (improvement.repository || '') + 
      (improvement.filePath || '')
    ).replace(/[^a-zA-Z0-9]/g, '').substr(0, 15);
    
    return `${primaryKey}-${contentHash}`;
  };
  const [improvements, setImprovements] = useState([]);
  const [allImprovements, setAllImprovements] = useState([]); // Store full unfiltered list for counts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');

  // System dark mode detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial state
    setSystemDarkMode(mediaQuery.matches);
    
    // Listen for changes
    const handleChange = (e) => {
      setSystemDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Copy functionality
  const copyToClipboard = async (text, type = 'text') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus({ [type]: 'copied' });
      setTimeout(() => setCopyStatus({}), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setCopyStatus({ [type]: 'error' });
      setTimeout(() => setCopyStatus({}), 2000);
    }
  };

  const copyImprovedCode = (improvement, uniqueKey) => {
    const codeToCopy = improvement.codeExamples?.[0]?.after || improvement.afterCode || '// No improved code available';
    copyToClipboard(codeToCopy, `code-${uniqueKey}`);
  };

  const copyImplementationPackage = (improvement, uniqueKey) => {
    const packageContent = `# ${improvement.title}

## Description
${improvement.description}

## Repository Information
- **Repository**: ${improvement.repository || 'N/A'}
- **Branch**: ${improvement.branch || 'N/A'}
- **File Path**: ${improvement.filePath || 'N/A'}
- **Last Modified**: ${improvement.lastModified || 'N/A'}
- **Author**: ${improvement.author || 'N/A'}

## Impact Metrics
- **Category**: ${improvement.category}
- **Impact Level**: ${improvement.impact}
- **Difficulty**: ${improvement.difficulty}
- **Time Estimate**: ${improvement.metrics?.timeToImplement || 'N/A'}
- **Time Saved**: ${improvement.metrics?.timeSaved || 'N/A'}
- **Bugs Prevented**: ${improvement.metrics?.bugsPrevented || 'N/A'}
- **Performance Gain**: ${improvement.metrics?.performanceGain || 'N/A'}

## Before Code
\`\`\`javascript
${improvement.codeExamples?.[0]?.before || improvement.beforeCode || '// No before code available'}
\`\`\`

## After Code (Improved)
\`\`\`javascript
${improvement.codeExamples?.[0]?.after || improvement.afterCode || '// No after code available'}
\`\`\`

${improvement.implementationSteps ? `## Implementation Steps
${improvement.implementationSteps.map((step, index) => {
  if (typeof step === 'object') {
    return `${index + 1}. **${step.title}** - ${step.description} (${step.estimatedTime})`;
  }
  return `${index + 1}. ${step}`;
}).join('\n')}` : ''}

${improvement.metrics ? `
## Expected Metrics
- **Time to Implement**: ${improvement.metrics.timeToImplement || 'N/A'}
- **Time Saved**: ${improvement.metrics.timeSaved || 'N/A'}
- **Bugs Prevented**: ${improvement.metrics.bugsPrevented || 'N/A'}
- **Performance Gain**: ${improvement.metrics.performanceGain || 'N/A'}` : ''}

---
*Generated by RefactorForge - Copy this package to Claude or other AI tools for implementation assistance*`;

    copyToClipboard(packageContent, `package-${uniqueKey}`);
  };

  const categories = [
    { id: 'all', label: 'All Categories', icon: Layers, color: 'gray' },
    { id: 'performance', label: 'Performance', icon: TrendingUp, color: 'green' },
    { id: 'security', label: 'Security', icon: Shield, color: 'red' },
    { id: 'architecture', label: 'Architecture', icon: Layers, color: 'purple' },
    { id: 'best_practices', label: 'Best Practices', icon: TestTube, color: 'blue' },
    { id: 'pattern_usage', label: 'Pattern Usage', icon: Wrench, color: 'yellow' },
    { id: 'migration', label: 'Migration', icon: Target, color: 'orange' },
    { id: 'testing', label: 'Testing', icon: TestTube, color: 'indigo' },
    { id: 'refactoring', label: 'Refactoring', icon: Code, color: 'cyan' }
  ];

  const impactLevels = [
    { id: 'all', label: 'All Impact Levels' },
    { id: 'low', label: 'Low Impact', color: 'gray' },
    { id: 'medium', label: 'Medium Impact', color: 'yellow' },
    { id: 'high', label: 'High Impact', color: 'orange' },
    { id: 'critical', label: 'Critical Impact', color: 'red' }
  ];

  const fetchImprovements = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setRefreshMessage('');
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      console.log('🔄 Fetching multi-repository recommendations...');
      // Use the new multi-repository API method
      const data = await apiService.getAllRepositoryRecommendations({
        impact: selectedImpact === 'all' ? undefined : selectedImpact,
        sortBy: sortBy
        // Don't send category filter to get all improvements
      });
      console.log('📊 Multi-repository data received:', data);
      
      const allImps = data.improvements || [];
      setAllImprovements(allImps); // Store full list for counts
      setImprovements(allImps); // Store same list for filtering
      
      // Debug: Log sample improvement to understand data structure
      if (allImps.length > 0) {
        console.log('🔍 Sample improvement data structure:', allImps[0]);
        console.log('🔍 Available category fields:', {
          recommendationType: allImps[0].recommendationType,
          category: allImps[0].category,
          type: allImps[0].type
        });
        
        // Debug: Log all unique categories found in data
        const uniqueCategories = [...new Set(allImps.map(imp => 
          normalizeCategory(imp)
        ))].filter(Boolean);
        console.log('🔍 All unique categories found in data:', uniqueCategories);
        
        // Debug: Log category distribution
        uniqueCategories.forEach(cat => {
          const count = allImps.filter(imp => 
            normalizeCategory(imp) === cat
          ).length;
          console.log(`🔍 Category "${cat}": ${count} improvements`);
        });
      }
      
      console.log(`✅ Loaded ${allImps.length} recommendations from ${data.repositoryCount || 0} repositories`);
      
      // Track improvements view event for timeline
      await apiService.trackEvent({
        type: 'improvements_viewed',
        category: 'code_improvements',
        title: 'Code Improvements Viewed',
        description: `Code improvements dashboard accessed - found ${allImps.length} recommendations`,
        context: {
          page: 'CodeImprovements',
          filters: {
            category: selectedCategory,
            impact: selectedImpact,
            sortBy: sortBy
          },
          repositories: data.repositoryCount || 0,
          isRefresh: isRefresh
        },
        metrics: {
          improvementsFound: allImps.length,
          repositoriesScanned: data.repositoryCount || 0,
          totalBugsPrevented: allImps.reduce((sum, imp) => sum + (parseInt(imp.metrics?.bugsPrevented || 0)), 0)
        }
      });
      
      if (isRefresh) {
        setRefreshMessage('Recommendations refreshed successfully!');
        setTimeout(() => setRefreshMessage(''), 3000);
      }
    } catch (err) {
      console.error('Failed to fetch multi-repository improvements:', err);
      const errorMsg = 'Failed to load code improvements from repositories. Please ensure the backend API is running and repositories are initialized.';
      setError(errorMsg);
      setImprovements([]);
      setAllImprovements([]);
      
      if (isRefresh) {
        setRefreshMessage('Failed to refresh recommendations. Please try again.');
        setTimeout(() => setRefreshMessage(''), 3000);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedImpact, sortBy, selectedCategory]);

  // Add API data fetching
  useEffect(() => {
    fetchImprovements();
  }, [fetchImprovements]);
  
  // Handle manual refresh with live GitHub scanning
  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMessage('');
    
    try {
      console.log('🔄 Starting live GitHub refresh for all repositories...');
      
      // First get all repositories
      const repositories = await apiService.getAllRepositories();
      console.log(`📊 Found ${repositories.length} repositories to refresh`);
      
      let totalRefreshed = 0;
      let totalFixed = 0;
      const refreshResults = [];
      
      // Refresh each repository with live GitHub scanning
      for (const repo of repositories) {
        try {
          console.log(`🔄 Refreshing ${repo.fullName} with live GitHub scan...`);
          setRefreshMessage(`Scanning ${repo.name}... (${totalRefreshed + 1}/${repositories.length})`);
          
          const refreshResult = await apiService.refreshRepository(repo.fullName);
          refreshResults.push(refreshResult);
          
          if (refreshResult.success) {
            totalRefreshed++;
            totalFixed += refreshResult.fixedIssues?.total || 0;
            console.log(`✅ Refreshed ${repo.fullName}: ${refreshResult.fixedIssues?.total || 0} issues fixed`);
          } else {
            console.log(`⚠️  Refresh failed for ${repo.fullName}: ${refreshResult.scanResults?.errorMessage || 'Unknown error'}`);
          }
        } catch (error) {
          console.error(`❌ Failed to refresh repository ${repo.fullName}:`, error);
          refreshResults.push({
            success: false,
            repositoryName: repo.fullName,
            error: error.message
          });
        }
      }
      
      // Now fetch the updated recommendations
      setRefreshMessage('Loading updated recommendations...');
      await fetchImprovements(false);
      
      // Show completion message
      const successfulRefreshes = refreshResults.filter(r => r.success).length;
      const failedRefreshes = repositories.length - successfulRefreshes;
      
      if (failedRefreshes > 0) {
        setRefreshMessage(`Refreshed ${successfulRefreshes}/${repositories.length} repositories. ${failedRefreshes} failed due to GitHub access issues. ${totalFixed} issues were resolved.`);
      } else {
        setRefreshMessage(`Successfully refreshed all ${totalRefreshed} repositories! ${totalFixed} issues were resolved.`);
      }
      
      setTimeout(() => setRefreshMessage(''), 5000);
      
    } catch (error) {
      console.error('Failed to refresh repositories:', error);
      setRefreshMessage('Failed to refresh repositories. Please try again.');
      setTimeout(() => setRefreshMessage(''), 3000);
    } finally {
      setRefreshing(false);
    }
  };

  // Fallback demo data to test the category counting functionality
  const defaultImprovements = [
    {
      id: 'demo-1',
      title: 'Optimize API Response Caching',
      description: 'Implement Redis caching for frequently accessed API endpoints to improve response times.',
      category: 'performance',
      priority: 'high',
      difficulty: 'medium',
      estimatedEffort: '4 hours',
      repository: 'api-server',
      filePath: 'src/routes/api.js',
      metrics: {
        performanceGain: '40%',
        bugsPrevented: '2',
        timeSaved: '2 hours/week'
      }
    },
    {
      id: 'demo-2', 
      title: 'Add Input Validation',
      description: 'Implement comprehensive input validation to prevent SQL injection and XSS attacks.',
      category: 'security',
      priority: 'critical',
      difficulty: 'easy',
      estimatedEffort: '2 hours',
      repository: 'frontend',
      filePath: 'src/components/UserForm.js',
      metrics: {
        performanceGain: '0%',
        bugsPrevented: '5',
        timeSaved: '1 hour/week'
      }
    },
    {
      id: 'demo-3',
      title: 'Refactor Component Architecture',
      description: 'Split large components into smaller, reusable modules following single responsibility principle.',
      category: 'architecture',
      priority: 'medium',
      difficulty: 'hard',
      estimatedEffort: '8 hours',
      repository: 'frontend',
      filePath: 'src/components/Dashboard.js',
      metrics: {
        performanceGain: '15%',
        bugsPrevented: '3',
        timeSaved: '4 hours/week'
      }
    },
    {
      id: 'demo-4',
      title: 'Use React Best Practices',
      description: 'Replace class components with functional components and implement proper error boundaries.',
      category: 'best_practices',
      priority: 'low',
      difficulty: 'medium',
      estimatedEffort: '6 hours',
      repository: 'frontend',
      filePath: 'src/legacy/',
      metrics: {
        performanceGain: '10%',
        bugsPrevented: '4',
        timeSaved: '3 hours/week'
      }
    },
    {
      id: 'demo-5',
      title: 'Implement Observer Pattern',
      description: 'Replace direct component communication with observer pattern for better decoupling.',
      category: 'pattern_usage',
      priority: 'medium',
      difficulty: 'medium',
      estimatedEffort: '5 hours',
      repository: 'frontend',
      filePath: 'src/services/',
      metrics: {
        performanceGain: '20%',
        bugsPrevented: '2',
        timeSaved: '2 hours/week'
      }
    },
    {
      id: 'demo-6',
      title: 'Migrate to TypeScript',
      description: 'Gradually migrate JavaScript codebase to TypeScript for better type safety.',
      category: 'migration',
      priority: 'high',
      difficulty: 'hard',
      estimatedEffort: '20 hours',
      repository: 'frontend',
      filePath: 'src/',
      metrics: {
        performanceGain: '5%',
        bugsPrevented: '10',
        timeSaved: '6 hours/week'
      }
    }
  ];

  // Use API data if available, otherwise use demo data for testing
  const displayImprovements = improvements.length > 0 ? improvements : defaultImprovements;
  
  // Helper function to normalize category values
  const normalizeCategory = (improvement) => {
    // Try different possible field names and normalize values
    let category = improvement.category || 
                  improvement.recommendationType || 
                  improvement.type || 
                  improvement.improvement_type ||
                  improvement.categoryId;
    
    // Handle different naming conventions (camelCase vs snake_case)
    if (category === 'bestPractices') category = 'best_practices';
    if (category === 'patternUsage') category = 'pattern_usage';
    if (category === 'best-practices') category = 'best_practices';
    if (category === 'pattern-usage') category = 'pattern_usage';
    
    return category;
  };

  // Helper function to normalize impact/priority values
  const normalizeImpact = (improvement) => {
    return improvement.priority || improvement.impact || improvement.severity || 'medium';
  };

  const filteredImprovements = displayImprovements.filter(improvement => {
    const categoryFieldValue = normalizeCategory(improvement);
    const categoryMatch = selectedCategory === 'all' || categoryFieldValue === selectedCategory;
    const impactFieldValue = normalizeImpact(improvement);  
    const impactMatch = selectedImpact === 'all' || impactFieldValue === selectedImpact;
    return categoryMatch && impactMatch;
  });

  const sortedImprovements = [...filteredImprovements].sort((a, b) => {
    switch (sortBy) {
      case 'impact':
        const impactOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aImpact = normalizeImpact(a);
        const bImpact = normalizeImpact(b);
        return impactOrder[bImpact] - impactOrder[aImpact];
      case 'difficulty':
        const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
        return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      case 'time':
        const aTime = parseInt(a.estimatedEffort) || 0;
        const bTime = parseInt(b.estimatedEffort) || 0;
        return aTime - bTime;
      case 'repository':
        return a.repository.localeCompare(b.repository);
      default:
        return 0;
    }
  });

  const getCategoryIcon = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.icon || Code;
  };

  const getCategoryColor = (categoryId) => {
    const colors = {
      performance: 'bg-green-100 text-green-800 border-green-200',
      security: 'bg-red-100 text-red-800 border-red-200',
      architecture: 'bg-purple-100 text-purple-800 border-purple-200',
      best_practices: 'bg-blue-100 text-blue-800 border-blue-200',
      pattern_usage: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      migration: 'bg-orange-100 text-orange-800 border-orange-200',
      testing: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      refactoring: 'bg-cyan-100 text-cyan-800 border-cyan-200'
    };
    return colors[categoryId] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getImpactColor = (impact) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[impact] || 'bg-gray-100 text-gray-800';
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800'
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Multi-Repository Code Improvement Recommendations
          </h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
              refreshing
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-memory-50 text-memory-700 border-memory-200 hover:bg-memory-100'
            }`}
            title="Refresh with live GitHub scanning"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        <p className="text-gray-600 mb-2">
          Actionable improvements across all IntelliPact repositories to enhance codebase quality, performance, and maintainability
        </p>
        
        {/* Refresh Message */}
        {refreshMessage && (
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg mb-4 ${
            refreshMessage.includes('Failed') 
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {refreshMessage.includes('Failed') ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {refreshMessage}
          </div>
        )}
        
        {!loading && (allImprovements.length > 0 || defaultImprovements.length > 0) && (
          <div className="mt-4 flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-memory-50 border border-memory-200 rounded-lg">
              <Package className="w-4 h-4 text-memory-600" />
              <span className="text-sm text-memory-700">
                Analyzing {Array.from(new Set((allImprovements.length > 0 ? allImprovements : defaultImprovements).map(imp => imp.repository))).length} repositories
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Category Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((category) => {
          const Icon = category.icon;
          // Use same data source as display - ensure we use the right data
          const dataToCount = displayImprovements;
          
          // Debug: Log data source and first few items for troubleshooting
          if (category.id === 'performance' && dataToCount.length > 0) {
            console.log(`🔍 Category counting debug for ${category.id}:`, {
              dataToCountLength: dataToCount.length,
              sampleItems: dataToCount.slice(0, 3).map(imp => ({
                id: imp.id,
                category: imp.category,
                normalized: normalizeCategory(imp)
              }))
            });
          }
          
          const count = dataToCount.filter(imp => {
            if (category.id === 'all') return true;
            // Use same normalization as filtering logic
            const categoryFieldValue = normalizeCategory(imp);
            const matches = categoryFieldValue === category.id;
            return matches;
          }).length;
          
          return (
            <motion.button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedCategory === category.id
                  ? `border-memory-500 bg-memory-50`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <Icon className={`w-6 h-6 mx-auto mb-2 ${
                selectedCategory === category.id ? 'text-memory-600' : 'text-gray-600'
              }`} />
              <div className="text-sm font-medium text-gray-900">{category.label}</div>
              <div className="text-xs text-gray-500">{count} items</div>
            </motion.button>
          );
        })}
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedImpact}
            onChange={(e) => setSelectedImpact(e.target.value)}
            className="input-field text-sm"
          >
            {impactLevels.map(level => (
              <option key={level.id} value={level.id}>
                {level.label}
              </option>
            ))}
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field text-sm"
          >
            <option value="impact">Sort by Impact</option>
            <option value="repository">Sort by Repository</option>
            <option value="difficulty">Sort by Difficulty</option>
            <option value="time">Sort by Time</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary text-sm"
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin text-memory-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading code improvements...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-semibold text-red-900">Unable to Load Improvements</h3>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <div className="flex gap-2">
            <button onClick={fetchImprovements} className="btn-primary">
              Retry
            </button>
            <button 
              onClick={() => {
                setError(null);
                setImprovements(defaultImprovements);
                setAllImprovements(defaultImprovements);
              }}
              className="btn-secondary"
            >
              Use Demo Data
            </button>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {!loading && !error && (
      <div className="bg-memory-50 border border-memory-200 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-memory-700">{sortedImprovements.length}</div>
            <div className="text-sm text-memory-600">Improvements</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-700">
              {sortedImprovements.reduce((sum, imp) => {
                // Try multiple possible fields for bugs prevented
                const bugs = imp.metrics?.bugsPrevented || 
                           imp.bugsPrevented || 
                           imp.metrics?.bugs_prevented ||
                           imp.bugs_prevented ||
                           imp.expectedBugsPrevented ||
                           '0';
                
                // Extract number from string (handle formats like "3 bugs", "5", "2-4", etc.)
                let bugCount = 0;
                if (typeof bugs === 'string') {
                  const bugMatch = bugs.match(/\d+/);
                  bugCount = bugMatch ? parseInt(bugMatch[0]) : 0;
                } else if (typeof bugs === 'number') {
                  bugCount = bugs;
                }
                
                return sum + bugCount;
              }, 0)}
            </div>
            <div className="text-sm text-green-600">Bugs Prevented</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-700">
              {sortedImprovements.reduce((sum, imp) => {
                // Try multiple possible fields for time estimate
                const timeStr = imp.estimatedEffort ||
                              imp.metrics?.timeToImplement ||
                              imp.timeEstimate ||
                              imp.metrics?.time_estimate ||
                              imp.time_to_implement ||
                              imp.implementationTime ||
                              '0';
                
                // Extract minutes from various formats ("30 min", "2 hours", "1h", "45m", etc.)
                let totalMinutes = 0;
                if (typeof timeStr === 'string') {
                  // Handle hours ("2 hours", "2h", "2 hrs")
                  const hourMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)(?!\w)/i);
                  if (hourMatch) {
                    totalMinutes += parseFloat(hourMatch[1]) * 60;
                  }
                  
                  // Handle minutes ("30 min", "30m", "30 mins")
                  const minMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)(?!\w)/i);
                  if (minMatch) {
                    totalMinutes += parseFloat(minMatch[1]);
                  }
                  
                  // Handle days ("1 day", "2d", "3 days")
                  const dayMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*(?:days?|d)(?!\w)/i);
                  if (dayMatch) {
                    totalMinutes += parseFloat(dayMatch[1]) * 8 * 60; // Assuming 8-hour work days
                  }
                  
                  // If no time unit found, treat as minutes if it's just a number
                  if (!hourMatch && !minMatch && !dayMatch) {
                    const numMatch = timeStr.match(/^\d+(?:\.\d+)?$/);
                    if (numMatch) {
                      totalMinutes += parseFloat(timeStr);
                    }
                  }
                } else if (typeof timeStr === 'number') {
                  totalMinutes += timeStr;
                }
                
                return sum + totalMinutes;
              }, 0)}
            </div>
            <div className="text-sm text-blue-600">Total Time (min)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-700">
              {Math.round(sortedImprovements.reduce((sum, imp) => {
                // Try multiple possible fields for performance gain
                const gain = imp.metrics?.performanceGain || 
                           imp.performanceGain ||
                           imp.metrics?.performance_gain ||
                           imp.performance_gain ||
                           imp.expectedPerformanceGain ||
                           '0%';
                
                // Extract percentage from string (handle formats like "25%", "3.5x", "150% faster", etc.)
                let gainValue = 0;
                if (typeof gain === 'string') {
                  // Handle percentage format ("25%", "150%")
                  const percentMatch = gain.match(/(\d+(?:\.\d+)?)%/);
                  if (percentMatch) {
                    gainValue = parseFloat(percentMatch[1]);
                  } else {
                    // Handle multiplier format ("2x", "3.5x faster")
                    const multiplierMatch = gain.match(/(\d+(?:\.\d+)?)x/);
                    if (multiplierMatch) {
                      gainValue = (parseFloat(multiplierMatch[1]) - 1) * 100;
                    } else {
                      // Handle plain number
                      const numberMatch = gain.match(/\d+(?:\.\d+)?/);
                      if (numberMatch) {
                        gainValue = parseFloat(numberMatch[0]);
                      }
                    }
                  }
                } else if (typeof gain === 'number') {
                  gainValue = gain;
                }
                
                return sum + gainValue;
              }, 0))}%
            </div>
            <div className="text-sm text-purple-600">Performance Gain</div>
          </div>
        </div>
      </div>
      )}

      {/* Improvement Cards */}
      {!loading && !error && (
      <div className="space-y-6">
        <AnimatePresence>
          {sortedImprovements.map((improvement, index) => {
            const Icon = getCategoryIcon(normalizeCategory(improvement));
            const uniqueKey = generateUniqueKey(improvement, index);
            const isExpanded = expandedCard === uniqueKey;
            
            // Debug logging for key generation and state
            if (index === 0) { // Only log for first item to avoid spam
              console.log('🔍 Card state debug:', {
                index,
                uniqueKey,
                expandedCard,
                isExpanded,
                title: improvement.title
              });
            }
            
            return (
              <motion.div
                key={generateUniqueKey(improvement, index)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className="card-hover"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${getCategoryColor(normalizeCategory(improvement))}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {improvement.title}
                      </h3>
                      <p className="text-gray-600 mb-2">
                        {improvement.description}
                      </p>
                      {/* Repository Information */}
                      {(improvement.repository || improvement.filePath) && (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          {improvement.repository && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.138 18.166 20 14.418 20 10c0-5.523-4.477-10-10-10z" clipRule="evenodd"/>
                              </svg>
                              {improvement.repository}
                            </span>
                          )}
                          {improvement.branch && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              {improvement.branch}
                            </span>
                          )}
                          {improvement.filePath && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {improvement.filePath}
                            </span>
                          )}
                          {improvement.lastModified && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              <Clock className="w-3 h-3" />
                              {improvement.lastModified}
                            </span>
                          )}
                          {improvement.author && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {improvement.author}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <span className={`badge ${getImpactColor(normalizeImpact(improvement))}`}>
                      {normalizeImpact(improvement)} impact
                    </span>
                    <span className={`badge ${getDifficultyColor(improvement.difficulty || 'medium')}`}>
                      {improvement.difficulty || 'medium'}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-sm text-gray-500">Time to implement</div>
                      <div className="font-medium">{
                        improvement.estimatedEffort || 
                        improvement.metrics?.timeToImplement || 
                        improvement.timeToImplement || 
                        'N/A'
                      }</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-green-500" />
                    <div>
                      <div className="text-sm text-gray-500">Bugs prevented</div>
                      <div className="font-medium">{
                        improvement.metrics?.bugsPrevented || 
                        improvement.bugsPrevented || 
                        'N/A'
                      }</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <div>
                      <div className="text-sm text-gray-500">Performance gain</div>
                      <div className="font-medium">{
                        improvement.metrics?.performanceGain || 
                        improvement.performanceGain || 
                        'N/A'
                      }</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="text-sm text-gray-500">Time saved</div>
                      <div className="font-medium">{
                        improvement.metrics?.timeSaved || 
                        improvement.timeSaved || 
                        'N/A'
                      }</div>
                    </div>
                  </div>
                </div>

                {/* Before/After Code Comparison */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-medium text-gray-900">Code Comparison</h4>
                    <button
                      onClick={() => {
                        console.log('🔘 View Code button clicked', { 
                          uniqueKey, 
                          isExpanded, 
                          currentExpandedCard: expandedCard 
                        });
                        setExpandedCard(isExpanded ? null : uniqueKey);
                      }}
                      className="btn-secondary text-sm"
                    >
                      {isExpanded ? 'Collapse' : 'View Code'}
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                      >
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Before Code */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <ThumbsDown className="w-4 h-4 text-red-500" />
                              <span className="text-sm font-medium text-red-700">Before (Current)</span>
                            </div>
                            <div className="relative">
                              <SyntaxHighlighter
                                language="javascript"
                                style={systemDarkMode ? oneDark : oneLight}
                                customStyle={{
                                  margin: 0,
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  maxHeight: '400px',
                                  overflow: 'auto'
                                }}
                              >
                                {improvement.codeExamples?.[0]?.before || improvement.beforeCode || '// No before code available'}
                              </SyntaxHighlighter>
                            </div>
                          </div>

                          {/* After Code */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <ThumbsUp className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-medium text-green-700">After (Improved)</span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => copyImprovedCode(improvement, uniqueKey)}
                                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                                    copyStatus[`code-${uniqueKey}`] === 'copied'
                                      ? 'bg-green-100 text-green-700'
                                      : copyStatus[`code-${uniqueKey}`] === 'error'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  <Copy className="w-3 h-3" />
                                  {copyStatus[`code-${uniqueKey}`] === 'copied' 
                                    ? 'Copied!' 
                                    : copyStatus[`code-${uniqueKey}`] === 'error'
                                    ? 'Error'
                                    : 'Copy Code'
                                  }
                                </button>
                                <button
                                  onClick={() => copyImplementationPackage(improvement, uniqueKey)}
                                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                                    copyStatus[`package-${uniqueKey}`] === 'copied'
                                      ? 'bg-green-100 text-green-700'
                                      : copyStatus[`package-${uniqueKey}`] === 'error'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                >
                                  <Package className="w-3 h-3" />
                                  {copyStatus[`package-${uniqueKey}`] === 'copied' 
                                    ? 'Package Copied!' 
                                    : copyStatus[`package-${uniqueKey}`] === 'error'
                                    ? 'Error'
                                    : 'Copy Package'
                                  }
                                </button>
                              </div>
                            </div>
                            <div className="relative">
                              <SyntaxHighlighter
                                language="javascript"
                                style={systemDarkMode ? oneDark : oneLight}
                                customStyle={{
                                  margin: 0,
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  maxHeight: '400px',
                                  overflow: 'auto'
                                }}
                              >
                                {improvement.codeExamples?.[0]?.after || improvement.afterCode || '// No after code available'}
                              </SyntaxHighlighter>
                            </div>
                          </div>
                        </div>

                        {/* Implementation Steps */}
                        {improvement.implementationSteps && improvement.implementationSteps.length > 0 ? (
                          <div className="mt-6">
                            <h5 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                              <BookOpen className="w-4 h-4" />
                              Implementation Guide
                            </h5>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                              {improvement.implementationSteps.map((step, stepIndex) => (
                                <li key={stepIndex} className="flex items-start gap-2">
                                  <span className="text-memory-600 font-medium">{stepIndex + 1}.</span>
                                  <div>
                                    <span className="font-medium">{typeof step === 'object' ? step.title : step}</span>
                                    {typeof step === 'object' && step.description && (
                                      <p className="text-gray-600 mt-1">{step.description}</p>
                                    )}
                                    {typeof step === 'object' && step.estimatedTime && (
                                      <span className="text-xs text-blue-600 mt-1 inline-block">
                                        Est. time: {step.estimatedTime}
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : (
                          <div className="mt-6">
                            <h5 className="text-md font-medium text-gray-900 mb-3">Implementation Details</h5>
                            <p className="text-sm text-gray-600">See improvement description for implementation guidance.</p>
                          </div>
                        )}

                        {/* Metrics Comparison */}
                        {improvement.metrics && (
                          <div className="mt-6">
                            <h5 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
                              <BarChart3 className="w-4 h-4" />
                              Impact Metrics
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-sm font-medium text-gray-700 mb-1">Time to Implement</div>
                                <div className="text-sm font-semibold">{
                                  improvement.metrics?.timeToImplement || 
                                  improvement.timeToImplement || 
                                  improvement.estimatedEffort || 
                                  'N/A'
                                }</div>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-sm font-medium text-gray-700 mb-1">Time Saved</div>
                                <div className="text-sm font-semibold text-green-600">{
                                  improvement.metrics?.timeSaved || 
                                  improvement.timeSaved || 
                                  'N/A'
                                }</div>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-sm font-medium text-gray-700 mb-1">Bugs Prevented</div>
                                <div className="text-sm font-semibold text-blue-600">{
                                  improvement.metrics?.bugsPrevented || 
                                  improvement.bugsPrevented || 
                                  'N/A'
                                }</div>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <div className="text-sm font-medium text-gray-700 mb-1">Performance Gain</div>
                                <div className="text-sm font-semibold text-purple-600">{
                                  improvement.metrics?.performanceGain || 
                                  improvement.performanceGain || 
                                  'N/A'
                                }</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-4 border-t border-gray-100">
                          <button className="btn-primary flex items-center gap-2">
                            <Play className="w-4 h-4" />
                            Start Implementation
                          </button>
                          <button className="btn-secondary">
                            Save for Later
                          </button>
                          <button className="btn-secondary">
                            Share with Team
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Quick Actions */}
                {!isExpanded && (
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Ready to implement
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        {improvement.difficulty} difficulty
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        console.log('🔘 View Details button clicked', { 
                          uniqueKey, 
                          isExpanded, 
                          currentExpandedCard: expandedCard 
                        });
                        setExpandedCard(isExpanded ? null : uniqueKey);
                      }}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      {isExpanded ? 'Hide Details' : 'View Details'}
                      <ArrowRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      )}

      {/* Empty State */}
      {!loading && !error && sortedImprovements.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Code className="w-12 h-12 mx-auto mb-2" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No improvements found
          </h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your filters to see more recommendations
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedImpact('all');
            }}
            className="btn-secondary"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Tips Section */}
      {!loading && !error && (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Pro Tips for Code Improvements
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Start with high-impact, low-difficulty improvements for quick wins</li>
          <li>• Implement security improvements first to protect your application</li>
          <li>• Use performance monitoring to measure the impact of your changes</li>
          <li>• Create a team improvement schedule to tackle technical debt systematically</li>
          <li>• Document your improvements for future reference and team learning</li>
        </ul>
      </div>
      )}
    </div>
  );
};

export default CodeImprovements;