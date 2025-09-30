import React, { useState, useEffect } from 'react';
import { Brain, Database, Search, BarChart3, GitBranch, Clock, Menu, X, TrendingUp, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import PatternStorage from './components/PatternStorage';
import SemanticSearch from './components/SemanticSearch';
import PatternAnalytics from './components/PatternAnalytics';
import GitHubIntegration from './components/GitHubIntegration';
import MemoryTimeline from './components/MemoryTimeline';
import CodeImprovements from './components/CodeImprovements';
import Repositories from './components/Repositories';

const App = () => {
  const [activeTab, setActiveTab] = useState('search');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle URL-based routing
  useEffect(() => {
    const path = window.location.pathname;
    const tabFromPath = path.slice(1) || 'search'; // Remove leading slash
    
    // Map URL paths to tab IDs
    const validTabs = ['search', 'storage', 'analytics', 'repositories', 'github', 'timeline', 'improvements'];
    if (validTabs.includes(tabFromPath)) {
      setActiveTab(tabFromPath);
    }
  }, []);

  // Update URL when tab changes
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    // Update URL without page reload
    window.history.pushState({}, '', `/${tabId === 'search' ? '' : tabId}`);
  };

  const tabs = [
    {
      id: 'search',
      label: 'Semantic Search',
      icon: Search,
      description: 'Find patterns with natural language'
    },
    {
      id: 'storage',
      label: 'Pattern Storage',
      icon: Database,
      description: 'Save and organize coding patterns'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      description: 'Pattern insights and trends'
    },
    {
      id: 'repositories',
      label: 'Repositories',
      icon: FolderOpen,
      description: 'View and manage all repositories'
    },
    {
      id: 'github',
      label: 'GitHub Integration',
      icon: GitBranch,
      description: 'Connect repositories and workflows'
    },
    {
      id: 'timeline',
      label: 'Memory Timeline',
      icon: Clock,
      description: 'Pattern history and activities'
    },
    {
      id: 'improvements',
      label: 'Code Improvements',
      icon: TrendingUp,
      description: 'Actionable recommendations for code quality'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'search':
        return <SemanticSearch />;
      case 'storage':
        return <PatternStorage />;
      case 'analytics':
        return <PatternAnalytics />;
      case 'repositories':
        return <Repositories />;
      case 'github':
        return <GitHubIntegration />;
      case 'timeline':
        return <MemoryTimeline />;
      case 'improvements':
        return <CodeImprovements />;
      default:
        return <SemanticSearch />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2 gradient-bg rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">RefactorForge</h1>
                <p className="text-xs text-gray-500">AI-Powered Code Refactoring & Contact Management Tool</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-memory-100 text-memory-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-200 bg-white"
            >
              <div className="px-4 py-2 space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        handleTabChange(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-memory-100 text-memory-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <div className="text-left">
                        <div>{tab.label}</div>
                        <div className="text-xs text-gray-500">{tab.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            {(() => {
              const activeTabData = tabs.find(tab => tab.id === activeTab);
              const Icon = activeTabData?.icon || Search;
              return (
                <>
                  <Icon className="w-6 h-6 text-memory-600" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    {activeTabData?.label}
                  </h2>
                </>
              );
            })()}
          </div>
          <p className="text-gray-600">
            {tabs.find(tab => tab.id === activeTab)?.description}
          </p>
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderTabContent()}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">RefactorForge</h3>
              <p className="text-sm text-gray-600">
                AI-powered code refactoring and contact management tool with intelligent pattern storage,
                semantic search, and GitHub integration.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Features</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• OpenAI-powered semantic search</li>
                <li>• Automatic GitHub pattern extraction</li>
                <li>• Real-time analytics and insights</li>
                <li>• Pattern timeline and history</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Technology Stack</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• React + Tailwind CSS</li>
                <li>• OpenAI Embeddings API</li>
                <li>• GitHub Webhooks</li>
                <li>• Semantic Vector Search</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-6 text-center">
            <p className="text-sm text-gray-500">
              RefactorForge © 2024 - AI-Powered Code Refactoring & Contact Management Tool
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;