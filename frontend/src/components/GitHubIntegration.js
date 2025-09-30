import React, { useState, useEffect } from 'react';
import { GitBranch, Settings, Zap, GitPullRequest, MessageSquare, CheckCircle, AlertCircle, Clock, Plus, Trash2, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from '../services/api';
import { formatDistanceToNow } from 'date-fns';

const GitHubIntegration = () => {
  const [integrations, setIntegrations] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getGitHubIntegrations();
      // Add default settings if missing
      const integrationsWithDefaults = (data.integrations || []).map(integration => ({
        ...integration,
        settings: integration.settings || {
          autoSave: true,
          branches: ['main', 'master'],
          patterns: ['*.js', '*.ts', '*.jsx', '*.tsx']
        }
      }));
      setIntegrations(integrationsWithDefaults);
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
      setError('Failed to load GitHub integrations');
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'syncing': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'syncing': return Clock;
      case 'error': return AlertCircle;
      default: return Clock;
    }
  };

  const handleAddIntegration = async (e) => {
    e.preventDefault();
    if (!newRepoUrl.trim()) return;

    // Extract repository name from URL
    const repoMatch = newRepoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (!repoMatch) {
      alert('Please enter a valid GitHub repository URL');
      return;
    }

    const repoName = repoMatch[1];
    const newIntegration = {
      id: `integration-${Date.now()}`,
      repository: repoName,
      status: 'syncing',
      lastSync: new Date().toISOString(),
      patternsCount: 0,
      webhooksEnabled: false,
      branches: ['main'],
      settings: {
        autoSave: true,
        categories: ['general'],
        minStars: 1
      }
    };

    try {
      const addedIntegration = await apiService.addGitHubIntegration(newIntegration);
      setIntegrations(prev => [...prev, addedIntegration]);
      setNewRepoUrl('');
      setShowAddForm(false);
      
      // Trigger initial sync
      handleSyncRepository(addedIntegration.id);
    } catch (err) {
      console.error('Failed to add integration:', err);
      alert('Failed to add repository integration. Please try again.');
    }
  };

  const handleDeleteIntegration = (id) => {
    if (window.confirm('Are you sure you want to remove this integration?')) {
      setIntegrations(prev => prev.filter(integration => integration.id !== id));
    }
  };

  const handleSyncRepository = async (id) => {
    setIntegrations(prev => 
      prev.map(integration => 
        integration.id === id 
          ? { ...integration, status: 'syncing', lastSync: new Date().toISOString() }
          : integration
      )
    );

    try {
      const result = await apiService.request(`/api/github/integrations/${id}/sync`, {
        method: 'POST'
      });

      if (result.success) {
        setIntegrations(prev => 
          prev.map(integration => 
            integration.id === id 
              ? { 
                  ...integration, 
                  status: 'active', 
                  patternsCount: result.patternsCount || integration.patternsCount,
                  lastSync: new Date().toISOString()
                }
              : integration
          )
        );
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setIntegrations(prev => 
        prev.map(integration => 
          integration.id === id 
            ? { ...integration, status: 'error' }
            : integration
        )
      );
      alert('Repository sync failed. Please try again later.');
    }
  };

  const toggleWebhooks = async (id) => {
    const integration = integrations.find(i => i.id === id);
    if (!integration) return;

    const newWebhookState = !integration.webhooksEnabled;

    try {
      await apiService.request(`/api/github/integrations/${id}/webhooks`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: newWebhookState })
      });

      setIntegrations(prev => 
        prev.map(integration => 
          integration.id === id 
            ? { ...integration, webhooksEnabled: newWebhookState }
            : integration
        )
      );
    } catch (error) {
      console.error('Failed to toggle webhooks:', error);
      alert('Failed to update webhook settings. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">GitHub Integration</h2>
          <p className="text-gray-600 mt-1">
            Connect repositories to automatically extract and save coding patterns
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Repository
        </button>
      </div>

      {/* Add Repository Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card bg-memory-50 border-memory-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add GitHub Repository
            </h3>
            <form onSubmit={handleAddIntegration} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repository URL
                </label>
                <input
                  type="url"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  className="input-field"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" className="btn-primary">
                  Add Repository
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewRepoUrl('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Integration Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-memory-600 mb-1">
            {(integrations || []).length}
          </div>
          <div className="text-sm text-gray-600">Active Integrations</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {(integrations || []).reduce((sum, integration) => sum + integration.patternsCount, 0)}
          </div>
          <div className="text-sm text-gray-600">Patterns Extracted</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {(integrations || []).filter(i => i.webhooksEnabled).length}
          </div>
          <div className="text-sm text-gray-600">Webhooks Active</div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin text-memory-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading GitHub integrations...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
          <button onClick={fetchIntegrations} className="btn-secondary mt-2">
            Retry
          </button>
        </div>
      )}

      {/* Repository List */}
      {!loading && !error && (
      <div className="space-y-4">
        {(integrations || []).map((integration) => {
          const StatusIcon = getStatusIcon(integration.status);
          return (
            <motion.div
              key={integration.id}
              layout
              className="card hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <GitBranch className="w-6 h-6 text-gray-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {integration.repository}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(integration.status)}`}>
                        <StatusIcon className="w-3 h-3" />
                        {integration.status}
                      </span>
                      <span>{integration.patternsCount} patterns</span>
                      <span>Last sync: {formatDistanceToNow(new Date(integration.lastSync), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSyncRepository(integration.id)}
                    disabled={integration.status === 'syncing'}
                    className="btn-secondary text-xs"
                  >
                    {integration.status === 'syncing' ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button
                    onClick={() => setSelectedIntegration(integration)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteIntegration(integration.id)}
                    className="p-2 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Integration Details */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Branches:</span>
                    <div className="mt-1">
                      {(integration.branches || []).map((branch, idx) => (
                        <span key={idx} className="inline-block px-2 py-1 bg-gray-100 rounded text-xs mr-1 mb-1">
                          {branch}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Categories:</span>
                    <div className="mt-1">
                      {(integration.settings?.categories || []).map((category, idx) => (
                        <span key={idx} className="inline-block px-2 py-1 bg-memory-100 text-memory-800 rounded text-xs mr-1 mb-1">
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Auto-save:</span>
                    <div className="mt-1">
                      <span className={`inline-block px-2 py-1 rounded text-xs ${integration.settings?.autoSave ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {integration.settings?.autoSave ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Webhooks:</span>
                    <div className="mt-1">
                      <button
                        onClick={() => toggleWebhooks(integration.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          integration.webhooksEnabled 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        <Zap className="w-3 h-3" />
                        {integration.webhooksEnabled ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
        
        {(integrations || []).length === 0 && (
          <div className="text-center py-12 card">
            <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No GitHub integrations yet
            </h3>
            <p className="text-gray-600 mb-4">
              Connect your repositories to start extracting patterns
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Your First Repository
            </button>
          </div>
        )}
      </div>
      )}

      {/* Configuration Modal */}
      <AnimatePresence>
        {selectedIntegration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedIntegration(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Configure {selectedIntegration.repository}
              </h3>
              
              <div className="space-y-6">
                {/* Webhook Configuration */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Webhook Events</h4>
                  <div className="space-y-2">
                    {[
                      { event: 'pull_request', label: 'Pull Requests', icon: GitPullRequest },
                      { event: 'issues', label: 'Issues', icon: MessageSquare },
                      { event: 'push', label: 'Code Pushes', icon: GitBranch }
                    ].map(({ event, label, icon: Icon }) => (
                      <label key={event} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <Icon className="w-4 h-4 text-gray-600" />
                        <span className="font-medium">{label}</span>
                        <span className="text-sm text-gray-500 ml-auto">Auto-extract patterns</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Pattern Extraction Settings */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Pattern Extraction</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Stars
                      </label>
                      <input
                        type="number"
                        defaultValue={selectedIntegration.settings.minStars}
                        className="input-field"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        File Types
                      </label>
                      <input
                        type="text"
                        defaultValue="js,ts,jsx,tsx,py,go"
                        className="input-field"
                        placeholder="Comma-separated file extensions"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto-categorization */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Auto-categorization</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['frontend', 'backend', 'database', 'testing', 'devops', 'security'].map(category => (
                      <label key={category} className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          defaultChecked={selectedIntegration.settings?.categories?.includes(category) || false}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t">
                <button
                  onClick={() => setSelectedIntegration(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setSelectedIntegration(null)}
                  className="btn-primary"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Integration Guide */}
      <div className="bg-github-50 border border-github-200 rounded-lg p-6">
        <h3 className="font-medium text-github-900 mb-4 flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          GitHub Integration Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-github-900 mb-2">Automatic Pattern Detection</h4>
            <ul className="text-sm text-github-700 space-y-1">
              <li>• Monitors pull requests for code patterns</li>
              <li>• Extracts patterns from issue discussions</li>
              <li>• Analyzes commit changes for best practices</li>
              <li>• Categorizes patterns using AI analysis</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-github-900 mb-2">Smart Features</h4>
            <ul className="text-sm text-github-700 space-y-1">
              <li>• Duplicate pattern detection and merging</li>
              <li>• Context-aware pattern extraction</li>
              <li>• Real-time webhook notifications</li>
              <li>• Customizable extraction rules</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitHubIntegration;