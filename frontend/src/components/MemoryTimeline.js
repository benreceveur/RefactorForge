import React, { useState, useEffect } from 'react';
import { Clock, GitCommit, Search, Save, Edit, Trash, Filter, Calendar, User, GitBranch, Tag, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay, endOfDay } from 'date-fns';
import apiService from '../services/api';

const MemoryTimeline = () => {
  const [timelineData, setTimelineData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all',
    dateRange: 'all',
    user: 'all'
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);

  const eventTypes = [
    { value: 'all', label: 'All Events', icon: Clock },
    { value: 'pattern_created', label: 'Pattern Created', icon: Save },
    { value: 'pattern_updated', label: 'Pattern Updated', icon: Edit },
    { value: 'pattern_deleted', label: 'Pattern Deleted', icon: Trash },
    { value: 'search_performed', label: 'Search Performed', icon: Search },
    { value: 'analytics_viewed', label: 'Analytics Viewed', icon: GitCommit },
    { value: 'improvements_viewed', label: 'Improvements Viewed', icon: GitBranch },
    { value: 'timeline_viewed', label: 'Timeline Viewed', icon: Clock },
    { value: 'integration_added', label: 'Integration Added', icon: GitBranch },
    { value: 'webhook_received', label: 'Webhook Received', icon: GitCommit },
    { value: 'api_access', label: 'API Access', icon: Clock }
  ];

  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTimelineData();
  }, []);

  const fetchTimelineData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getTimeline({ limit: 100 });
      const events = data.events || [];
      
      // Process events to match expected format
      const processedEvents = events.map(event => ({
        ...event,
        timestamp: new Date(event.timestamp),
        // Map backend metadata to frontend format
        user: event.metadata?.user || event.context?.user || 'system',
        repository: event.metadata?.repository || event.context?.repository,
        category: event.metadata?.category || event.category,
        tags: event.metadata?.tags || event.tags || []
      }));
      
      setTimelineData(processedEvents);
      setFilteredData(processedEvents);

      // Track timeline view event (but avoid infinite loop)
      if (processedEvents.length > 0) {
        try {
          await apiService.trackEvent({
            type: 'timeline_viewed',
            category: 'navigation',
            title: 'Memory Timeline Viewed',
            description: `Timeline accessed - viewing ${processedEvents.length} events`,
            context: {
              page: 'MemoryTimeline',
              eventsShown: processedEvents.length,
              filters: Object.keys(filters).filter(key => filters[key] !== 'all').length
            },
            metrics: {
              eventsLoaded: processedEvents.length,
              uniqueEventTypes: new Set(processedEvents.map(e => e.type)).size
            }
          });
        } catch (trackError) {
          console.warn('Failed to track timeline view:', trackError);
        }
      }
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
      setError('Failed to load timeline data');
      setTimelineData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = timelineData;

    // Filter by type
    if (filters.type !== 'all') {
      filtered = filtered.filter(event => event.type === filters.type);
    }

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const ranges = {
        today: [startOfDay(now), endOfDay(now)],
        yesterday: [startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000)), endOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000))],
        week: [new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now],
        month: [new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now]
      };

      if (ranges[filters.dateRange]) {
        const [start, end] = ranges[filters.dateRange];
        filtered = filtered.filter(event => event.timestamp >= start && event.timestamp <= end);
      }
    }

    // Filter by user
    if (filters.user !== 'all') {
      filtered = filtered.filter(event => event.user === filters.user);
    }

    // Filter by selected date
    if (selectedDate) {
      filtered = filtered.filter(event => 
        format(event.timestamp, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
      );
    }

    setFilteredData(filtered);
  }, [timelineData, filters, selectedDate]);

  const getEventIcon = (type) => {
    const eventType = eventTypes.find(et => et.value === type);
    return eventType ? eventType.icon : Clock;
  };

  const getEventColor = (type) => {
    const colors = {
      pattern_created: 'text-green-600 bg-green-100 border-green-200',
      pattern_updated: 'text-blue-600 bg-blue-100 border-blue-200',
      pattern_deleted: 'text-red-600 bg-red-100 border-red-200',
      search_performed: 'text-purple-600 bg-purple-100 border-purple-200',
      analytics_viewed: 'text-cyan-600 bg-cyan-100 border-cyan-200',
      improvements_viewed: 'text-yellow-600 bg-yellow-100 border-yellow-200',
      timeline_viewed: 'text-emerald-600 bg-emerald-100 border-emerald-200',
      integration_added: 'text-indigo-600 bg-indigo-100 border-indigo-200',
      webhook_received: 'text-orange-600 bg-orange-100 border-orange-200',
      api_access: 'text-gray-600 bg-gray-100 border-gray-200'
    };
    return colors[type] || 'text-gray-600 bg-gray-100 border-gray-200';
  };

  const formatTimeGrouping = (timestamp) => {
    if (isToday(timestamp)) return 'Today';
    if (isYesterday(timestamp)) return 'Yesterday';
    return format(timestamp, 'MMMM d, yyyy');
  };

  const groupEventsByDate = (events) => {
    return events.reduce((groups, event) => {
      const dateKey = formatTimeGrouping(event.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
      return groups;
    }, {});
  };

  const uniqueUsers = [...new Set((timelineData || []).map(event => event.user))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-memory-200 border-t-memory-600 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading memory timeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-2">{error}</p>
          <p className="text-red-500 text-sm mb-4">
            Make sure the API server is running at http://localhost:3721
          </p>
          <button onClick={fetchTimelineData} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const groupedEvents = groupEventsByDate(filteredData);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Memory Timeline</h2>
        <p className="text-gray-600">
          Chronological view of all pattern activities and system events
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="input-field"
            >
              {eventTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
              className="input-field"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User
            </label>
            <select
              value={filters.user}
              onChange={(e) => setFilters(prev => ({ ...prev, user: e.target.value }))}
              className="input-field"
            >
              <option value="all">All Users</option>
              {(uniqueUsers || []).map(user => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specific Date
            </label>
            <input
              type="date"
              value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
              className="input-field"
            />
          </div>
        </div>
        
        {(filters.type !== 'all' || filters.dateRange !== 'all' || filters.user !== 'all' || selectedDate) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={() => {
                setFilters({ type: 'all', dateRange: 'all', user: 'all' });
                setSelectedDate(null);
              }}
              className="text-sm text-memory-600 hover:text-memory-700 flex items-center gap-1"
            >
              <Filter className="w-4 h-4" />
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {(timelineData || []).filter(e => e.type === 'pattern_created').length}
          </div>
          <div className="text-sm text-gray-600">Patterns Created</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-600 mb-1">
            {(timelineData || []).filter(e => e.type === 'search_performed').length}
          </div>
          <div className="text-sm text-gray-600">Searches Performed</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {(timelineData || []).filter(e => e.type === 'pattern_updated').length}
          </div>
          <div className="text-sm text-gray-600">Patterns Updated</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-indigo-600 mb-1">
            {(timelineData || []).filter(e => e.type === 'integration_added').length}
          </div>
          <div className="text-sm text-gray-600">Integrations Added</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
            <p className="text-gray-600">Try adjusting your filters to see more events.</p>
          </div>
        ) : (
          Object.entries(groupedEvents).map(([dateGroup, events]) => (
            <div key={dateGroup}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {dateGroup}
                <span className="text-sm font-normal text-gray-500">
                  ({events.length} event{events.length !== 1 ? 's' : ''})
                </span>
              </h3>
              
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" />
                
                <div className="space-y-4">
                  <AnimatePresence>
                    {(events || []).map((event, index) => {
                      const EventIcon = getEventIcon(event.type);
                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.1 }}
                          className="relative flex items-start gap-4"
                        >
                          {/* Timeline icon */}
                          <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center ${getEventColor(event.type)}`}>
                            <EventIcon className="w-5 h-5" />
                          </div>
                          
                          {/* Event content */}
                          <div className="flex-1 card hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 mb-1">
                                  {event.title}
                                </h4>
                                <p className="text-gray-600 text-sm mb-3">
                                  {event.description}
                                </p>
                                
                                {/* Metadata */}
                                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    <span>{event.user}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{format(event.timestamp, 'HH:mm')}</span>
                                  </div>
                                  
                                  {event.repository && (
                                    <div className="flex items-center gap-1">
                                      <GitBranch className="w-3 h-3" />
                                      <span>{event.repository}</span>
                                    </div>
                                  )}
                                  
                                  {event.category && (
                                    <span className="badge-secondary">
                                      {event.category}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Additional metadata */}
                                {event.tags && event.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {(event.tags || []).map((tag, idx) => (
                                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                                        <Tag className="w-3 h-3" />
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <div className="text-xs text-gray-500 ml-4">
                                {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {filteredData.length > 0 && (
        <div className="text-center">
          <button className="btn-secondary">
            Load Earlier Events
          </button>
        </div>
      )}
    </div>
  );
};

export default MemoryTimeline;