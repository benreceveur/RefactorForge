import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  PieChart as PieChartIcon,
  Search,
  GitBranch,
  Database
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import apiService from '../services/api';
import TimelineInsights from './TimelineInsights';

const PatternAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getAnalytics();
      
      setAnalytics(data);

      // Track analytics view event for timeline
      await apiService.trackEvent({
        type: 'analytics_viewed',
        category: 'analytics',
        title: 'Pattern Analytics Viewed',
        description: `Analytics dashboard accessed - viewing ${selectedPeriod} period`,
        context: {
          page: 'PatternAnalytics',
          period: selectedPeriod,
          dataPoints: {
            totalPatterns: data?.totalPatterns || 0,
            searchesThisWeek: data?.searchesThisWeek || 0,
            activeRepositories: data?.activeRepositories || 0,
            categories: data?.categoryDistribution?.length || 0
          }
        },
        metrics: {
          loadTime: Date.now() - Date.now(), // Will be very small since it's the same time
          patternsAnalyzed: data?.totalPatterns || 0,
          categoriesFound: data?.categoryDistribution?.length || 0
        }
      });
      
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'pattern_saved':
      case 'pattern_created':
        return '📝';
      case 'search':
        return '🔍';
      case 'sync':
        return '🔄';
      default:
        return '📌';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'pattern_saved':
      case 'pattern_created':
        return 'text-green-600';
      case 'search':
        return 'text-blue-600';
      case 'sync':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-memory-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const calculateChange = (current, previous) => {
    if (!current || !previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  };

  const metrics = analytics ? [
    {
      label: 'Total Patterns',
      value: analytics.totalPatterns?.toString() || '0',
      icon: Database,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      change: calculateChange(analytics.totalPatterns, analytics.previousTotalPatterns) || 'N/A',
      description: 'Patterns stored in the system'
    },
    {
      label: 'Searches This Week',
      value: analytics.searchesThisWeek?.toString() || '0',
      icon: Search,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      change: calculateChange(analytics.searchesThisWeek, analytics.previousSearches) || 'N/A',
      description: 'Semantic searches performed'
    },
    {
      label: 'Active Repositories',
      value: analytics.activeRepositories?.toString() || '0',
      icon: GitBranch,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      change: calculateChange(analytics.activeRepositories, analytics.previousActiveRepositories) || 'N/A',
      description: 'Connected GitHub repositories'
    },
    {
      label: 'Pattern Categories',
      value: analytics.categoryDistribution?.length?.toString() || '0',
      icon: PieChartIcon,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      change: calculateChange(analytics.categoryDistribution?.length, analytics.previousCategoryCount) || 'N/A',
      description: 'Different pattern categories'
    }
  ] : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Pattern insights and trends</p>
        </div>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-memory-500"
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600">{metric.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{metric.description}</p>
                </div>
                <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`w-6 h-6 ${metric.color}`} />
                </div>
              </div>
              {metric.change !== 'N/A' && (
                <div className="mt-4 flex items-center text-sm">
                  <span className={`font-medium ${
                    metric.change.startsWith('+') ? 'text-green-600' : 
                    metric.change.startsWith('-') ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {metric.change}
                  </span>
                  <span className="text-gray-500 ml-2">from last period</span>
                </div>
              )}
              {metric.change === 'N/A' && (
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-gray-500 font-medium">No previous data</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Timeline Insights */}
      <TimelineInsights className="mb-6" />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Patterns by Category
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics?.categoryDistribution || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, count }) => `${name}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {(analytics?.categoryDistribution || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Usage Over Time */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Usage Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics?.usageTrends || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="patterns" 
                stroke="#0ea5e9" 
                strokeWidth={2}
                name="New Patterns"
              />
              <Line 
                type="monotone" 
                dataKey="searches" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Searches"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Search Terms */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Popular Search Terms
          </h3>
          {analytics?.popularSearchTerms && analytics.popularSearchTerms.length > 0 ? (
            <div className="space-y-3">
              {analytics.popularSearchTerms.map((item, index) => {
                const maxCount = Math.max(...analytics.popularSearchTerms.map(t => t.count));
                const percentage = (item.count / maxCount) * 100;
                return (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-24 text-sm text-gray-600 text-right font-medium">
                      {item.term}
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                      <div 
                        className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-300"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      >
                        <span className="text-white text-xs font-medium">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <div className="text-lg mb-2">No search data available</div>
                <div className="text-sm">Search terms will appear as patterns are searched</div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {(analytics?.recentActivity || []).map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full bg-white ${getActivityColor(activity.type)}`}>
                  {activity.type.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Search Performance
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Average Response Time</span>
              <span className="font-medium">
                {analytics?.searchPerformance?.averageResponseTime ? `${analytics.searchPerformance.averageResponseTime}ms` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Search Accuracy</span>
              <span className="font-medium">
                {analytics?.searchPerformance?.searchAccuracy ? `${(analytics.searchPerformance.searchAccuracy * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Cache Hit Rate</span>
              <span className="font-medium">
                {analytics?.searchPerformance?.cacheHitRate ? `${(analytics.searchPerformance.cacheHitRate * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Embedding Quality</span>
              <span className="font-medium">
                {analytics?.searchPerformance?.embeddingQuality ? `${(analytics.searchPerformance.embeddingQuality * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Pattern Quality
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Average Similarity Score</span>
              <span className="font-medium">
                {analytics?.patternQuality?.averageSimilarityScore ? 
                  `${(analytics.patternQuality.averageSimilarityScore * 100).toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Patterns with High Usage</span>
              <span className="font-medium">
                {analytics?.patternQuality?.patternsWithHighUsage?.toString() || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Duplicate Detection Rate</span>
              <span className="font-medium">
                {analytics?.patternQuality?.duplicateDetectionRate ? `${(analytics.patternQuality.duplicateDetectionRate * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Auto-categorization Accuracy</span>
              <span className="font-medium">
                {analytics?.patternQuality?.autoCategorized ? `${(analytics.patternQuality.autoCategorized * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            System Health
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">API Uptime</span>
              <span className="font-medium">
                {analytics?.systemHealth?.apiUptime || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Storage Used</span>
              <span className="font-medium">
                {analytics?.systemHealth?.storageUsed || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Vector Index Size</span>
              <span className="font-medium">
                {analytics?.systemHealth?.vectorIndexSize || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Connections</span>
              <span className="font-medium">
                {analytics?.systemHealth?.activeConnections?.toString() || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Insights */}
      <div className="card bg-gradient-to-r from-memory-50 to-blue-50 border-memory-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          💡 Smart Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Current Trends</h4>
            <ul className="text-sm space-y-2">
              {analytics?.insights?.length > 0 ? analytics.insights.slice(0, 3).map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className={`text-${insight.priority === 'high' ? 'red' : insight.priority === 'medium' ? 'yellow' : 'green'}-600`}>
                    {insight.type === 'trend' ? '📈' : '📊'}
                  </span>
                  <div>
                    <div className="text-gray-700">{insight.title}</div>
                    <div className="text-xs text-gray-500">{insight.description}</div>
                    {insight.repositories?.length > 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        Repositories: {insight.repositories.join(', ')}
                      </div>
                    )}
                  </div>
                </li>
              )) : (
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">📊</span>
                  <div>
                    <div className="text-gray-500">No insights available</div>
                    <div className="text-xs text-gray-400">Insights will appear as patterns are analyzed</div>
                  </div>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Optimization Opportunities</h4>
            <ul className="text-sm space-y-2">
              {analytics?.totalPatterns > 0 ? (
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600">•</span>
                  <div>
                    <div className="text-gray-700">{analytics.totalPatterns} patterns available for reuse</div>
                    {analytics.categoryDistribution?.length > 0 && (
                      <div className="text-xs text-gray-500">
                        <span className="font-semibold">Top categories:</span> {analytics.categoryDistribution.slice(0, 3).map(c => c.name).join(', ')}
                      </div>
                    )}
                    {analytics.activeRepositories > 0 && (
                      <div className="text-xs text-gray-400 mt-1">{analytics.activeRepositories} repositories integrated</div>
                    )}
                  </div>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <div>
                    <div className="text-gray-500">No patterns available yet</div>
                    <div className="text-xs text-gray-400">Patterns will appear as repositories are analyzed</div>
                  </div>
                </li>
              )}
              {analytics?.systemStats ? (
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <div>
                    <div className="text-gray-700">
                      Search performance: {analytics.systemStats.searchAccuracy ? `${analytics.systemStats.searchAccuracy}% accuracy` : 'Metrics pending'}
                    </div>
                    {analytics.systemStats.cacheHitRate && (
                      <div className="text-xs text-gray-500">
                        Cache optimization at {analytics.systemStats.cacheHitRate}% hit rate
                      </div>
                    )}
                    {analytics.systemStats.embeddingQuality && (
                      <div className="text-xs text-gray-400 mt-1">Embedding quality: {analytics.systemStats.embeddingQuality}%</div>
                    )}
                  </div>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <div>
                    <div className="text-gray-500">Search metrics loading...</div>
                    <div className="text-xs text-gray-400">Performance data will appear soon</div>
                  </div>
                </li>
              )}
              {analytics?.recentActivity?.length > 0 ? (
                <li className="flex items-start gap-2">
                  <span className="text-green-600">•</span>
                  <div>
                    <div className="text-gray-700">Recent activity: {analytics.recentActivity.length} operations</div>
                    {analytics.activeRepositories > 0 && (
                      <div className="text-xs text-gray-500">
                        <span className="font-semibold">Active repositories:</span> {analytics.activeRepositories} connected
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">Real-time pattern extraction active</div>
                  </div>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <div>
                    <div className="text-gray-500">No recent activity</div>
                    <div className="text-xs text-gray-400">Activity will appear as patterns are processed</div>
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatternAnalytics;