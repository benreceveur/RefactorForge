import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  TrendingUp, 
  Activity, 
  Users, 
  Calendar,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, startOfDay, endOfDay, subDays } from 'date-fns';
import apiService from '../services/api';

const TimelineInsights = ({ className = '' }) => {
  const [timelineData, setTimelineData] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTimelineData();
  }, []);

  const fetchTimelineData = async () => {
    setLoading(true);
    try {
      const data = await apiService.getTimeline({ limit: 100 });
      const events = data.events || [];
      setTimelineData(events);
      
      // Calculate insights
      const calculatedInsights = calculateInsights(events);
      setInsights(calculatedInsights);
      
    } catch (err) {
      console.error('Failed to fetch timeline data:', err);
      setError('Failed to load timeline insights');
    } finally {
      setLoading(false);
    }
  };

  const calculateInsights = (events) => {
    if (!events || events.length === 0) return null;

    const now = new Date();
    const today = startOfDay(now);
    const yesterday = startOfDay(subDays(now, 1));
    const lastWeek = subDays(now, 7);

    // Filter user activities (exclude system events)
    const userActivities = events.filter(event => 
      !['api_access', 'system_startup'].includes(event.type) &&
      event.context?.user !== 'system'
    );

    // Activity breakdown
    const activityByType = userActivities.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});

    // Time-based analysis
    const todayEvents = userActivities.filter(event => 
      new Date(event.timestamp) >= today
    );
    
    const yesterdayEvents = userActivities.filter(event => {
      const eventTime = new Date(event.timestamp);
      return eventTime >= yesterday && eventTime < today;
    });

    const weekEvents = userActivities.filter(event => 
      new Date(event.timestamp) >= lastWeek
    );

    // Peak activity hours
    const hourlyActivity = userActivities.reduce((acc, event) => {
      const hour = new Date(event.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    const peakHour = Object.entries(hourlyActivity).reduce((max, [hour, count]) => {
      return count > (max.count || 0) ? { hour: parseInt(hour), count } : max;
    }, {});

    // Most active users
    const userActivity = userActivities.reduce((acc, event) => {
      const user = event.context?.user || 'unknown';
      acc[user] = (acc[user] || 0) + 1;
      return acc;
    }, {});

    const topUsers = Object.entries(userActivity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([user, count]) => ({ user, count }));

    // Recent activity trend
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, i);
      const dayEvents = userActivities.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= startOfDay(date) && eventDate <= endOfDay(date);
      });
      return {
        date: format(date, 'MMM d'),
        count: dayEvents.length,
        fullDate: date
      };
    }).reverse();

    const avgDailyActivity = last7Days.reduce((sum, day) => sum + day.count, 0) / 7;

    return {
      totalActivities: userActivities.length,
      todayCount: todayEvents.length,
      yesterdayCount: yesterdayEvents.length,
      weekCount: weekEvents.length,
      activityByType,
      peakHour,
      topUsers,
      last7Days,
      avgDailyActivity: Math.round(avgDailyActivity * 10) / 10,
      mostRecentActivity: userActivities[0] ? {
        ...userActivities[0],
        timeAgo: formatDistanceToNow(new Date(userActivities[0].timestamp), { addSuffix: true })
      } : null
    };
  };

  const getActivityTypeLabel = (type) => {
    const labels = {
      pattern_created: 'Pattern Created',
      pattern_updated: 'Pattern Updated',
      search_performed: 'Search Performed',
      analytics_viewed: 'Analytics Viewed',
      improvements_viewed: 'Improvements Viewed',
      timeline_viewed: 'Timeline Viewed',
      integration_added: 'Integration Added'
    };
    return labels[type] || type.replace('_', ' ');
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'pattern_created':
      case 'pattern_updated':
        return '📝';
      case 'search_performed':
        return '🔍';
      case 'analytics_viewed':
        return '📊';
      case 'improvements_viewed':
        return '🔧';
      case 'timeline_viewed':
        return '⏰';
      case 'integration_added':
        return '🔗';
      default:
        return '📌';
    }
  };

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-memory-600 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-gray-600">Loading timeline insights...</span>
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className={`card ${className}`}>
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{error || 'No timeline data available'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-memory-600" />
          <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-memory-600 hover:text-memory-700 transition-colors"
        >
          {expanded ? 'Show Less' : 'Show More'}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-memory-600">{insights.totalActivities}</div>
          <div className="text-xs text-gray-500">Total Activities</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{insights.todayCount}</div>
          <div className="text-xs text-gray-500">Today</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{insights.weekCount}</div>
          <div className="text-xs text-gray-500">This Week</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{insights.avgDailyActivity}</div>
          <div className="text-xs text-gray-500">Daily Avg</div>
        </div>
      </div>

      {/* Activity Trend */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">7-Day Activity Trend</h4>
        <div className="flex items-end gap-2 h-20">
          {insights.last7Days.map((day, index) => {
            const maxCount = Math.max(...insights.last7Days.map(d => d.count), 1);
            const height = day.count > 0 ? Math.max((day.count / maxCount) * 100, 10) : 10;

            return (
              <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t hover:from-blue-600 hover:to-blue-500 transition-colors"
                  style={{ minHeight: '8px' }}
                />
                <div className="text-xs text-gray-500 mt-1">{day.date}</div>
                <div className="text-xs font-medium text-gray-700">{day.count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {insights.mostRecentActivity && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Most Recent Activity</h4>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-lg">{getActivityIcon(insights.mostRecentActivity.type)}</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                {insights.mostRecentActivity.title}
              </div>
              <div className="text-xs text-gray-500">
                {insights.mostRecentActivity.timeAgo} by {insights.mostRecentActivity.context?.user || 'unknown'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-6"
          >
            {/* Activity Breakdown */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Activity Breakdown</h4>
              <div className="space-y-2">
                {Object.entries(insights.activityByType)
                  .sort(([,a], [,b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getActivityIcon(type)}</span>
                        <span className="text-sm text-gray-700">{getActivityTypeLabel(type)}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Top Users */}
            {insights.topUsers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Most Active Users</h4>
                <div className="space-y-2">
                  {insights.topUsers.map(({ user, count }, index) => (
                    <div key={user} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{user}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{count} activities</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Peak Activity Time */}
            {insights.peakHour.hour !== undefined && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Peak Activity</h4>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>
                    Most active at {insights.peakHour.hour}:00 with {insights.peakHour.count} activities
                  </span>
                </div>
              </div>
            )}

            {/* View Full Timeline */}
            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={() => window.location.href = '/timeline'}
                className="flex items-center gap-2 text-sm text-memory-600 hover:text-memory-700 font-medium transition-colors"
              >
                View Full Timeline
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimelineInsights;