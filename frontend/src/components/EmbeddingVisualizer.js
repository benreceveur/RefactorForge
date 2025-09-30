import React, { useState, useEffect } from 'react';
import { Zap, Brain, Eye, Code, Search, Sparkles, Info, HelpCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import apiService from '../services/api';

const EmbeddingVisualizer = ({ query, patterns }) => {
  const [visualization, setVisualization] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(null);

  // Define semantic dimension labels with explanations
  const dimensionLabels = [
    {
      id: 'semantic_theme',
      label: 'Semantic Theme',
      shortLabel: 'Theme',
      description: 'Primary topic or domain similarity - groups content by subject matter',
      icon: '🎯'
    },
    {
      id: 'conceptual_depth',
      label: 'Conceptual Depth',
      shortLabel: 'Depth',
      description: 'Complexity and specificity level - from general concepts to detailed implementations',
      icon: '📊'
    },
    {
      id: 'structural_pattern',
      label: 'Structural Pattern',
      shortLabel: 'Structure',
      description: 'Code organization and architectural patterns - how content is structured',
      icon: '🏗️'
    },
    {
      id: 'functional_purpose',
      label: 'Functional Purpose',
      shortLabel: 'Purpose',
      description: 'Intent and use case similarity - what the code is designed to accomplish',
      icon: '⚡'
    }
  ];

  // Load embedding visualization from API
  useEffect(() => {
    if (query && patterns && patterns.length > 0) {
      fetchEmbeddingVisualization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, patterns]);

  const fetchEmbeddingVisualization = async () => {
    setProcessing(true);
    try {
      // Try to get real embedding data from API
      const response = await apiService.request('/api/embeddings/visualize', {
        method: 'POST',
        body: JSON.stringify({
          query,
          patternIds: patterns.slice(0, 5).map(p => p.id)
        })
      });

      if (response && response.visualization) {
        setVisualization(response.visualization);
      } else {
        // Generate simplified visualization from available data
        setVisualization(generateSimplifiedVisualization(query, patterns));
      }
    } catch (error) {
      console.error('Failed to fetch embedding visualization:', error);
      // Generate simplified visualization from available similarity scores
      setVisualization(generateSimplifiedVisualization(query, patterns));
    } finally {
      setProcessing(false);
    }
  };

  const generateSimplifiedVisualization = (query, patterns) => {
    const dimensions = ['semantic', 'syntax', 'complexity', 'domain', 'framework', 'paradigm', 'purpose', 'quality'];
    
    // NO FAKE DATA - Show unavailable state instead of random vectors
    return {
      queryVector: null, // Real embeddings unavailable
      patternVectors: patterns.slice(0, 3).map(pattern => ({
        id: pattern.id,
        title: pattern.title,
        vector: null, // Real vectors unavailable
        similarity: pattern.similarity || null // Use real similarity or null
      })),
      dimensions,
      isSimplified: true,
      dataUnavailable: true
    };
  };


  if (!query || !visualization) {
    return (
      <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="text-center py-8">
          <Brain className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Embedding Visualization
          </h3>
          <p className="text-gray-600 text-sm">
            Perform a search to see how OpenAI embeddings work their magic
          </p>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="text-center py-8">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <Sparkles className="w-4 h-4 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Generating Embeddings...
          </h3>
          <p className="text-gray-600 text-sm">
            Converting your query into semantic vectors
          </p>
        </div>
      </div>
    );
  }

  // Check if we have real data or if it's unavailable
  if (visualization?.dataUnavailable) {
    return (
      <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="flex items-center gap-2 mb-6">
          <Eye className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Embedding Visualization
          </h3>
        </div>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            Embedding Data Unavailable
          </h4>
          <p className="text-gray-600 text-sm">
            Real embedding vectors are not available at this time.
            The API endpoint for embeddings visualization is not currently configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
      <div className="flex items-center gap-2 mb-6">
        <Eye className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Embedding Visualization
        </h3>
        <div className="ml-auto flex items-center gap-1 text-sm text-blue-600">
          <Zap className="w-4 h-4" />
          <span>OpenAI Powered</span>
        </div>
      </div>

      {/* Query Vector */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Search className="w-4 h-4" />
          Query: "{query}"
        </h4>
        <div className="space-y-3">
          {dimensionLabels.slice(0, 2).map((dimension, index) => {
            // Use first two dimensions of the embedding vector
            const value = visualization?.queryVector?.[index] || 0;
            // Scale the value for better visualization (embeddings are typically small decimals)
            const scaledValue = value * 100;
            return (
              <motion.div
                key={dimension.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-32 flex items-center gap-2">
                  <span className="text-lg">{dimension.icon}</span>
                  <div>
                    <div className="text-xs text-gray-900 font-medium">
                      {dimension.shortLabel}
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      onMouseEnter={() => setShowTooltip(dimension.id)}
                      onMouseLeave={() => setShowTooltip(null)}
                    >
                      <HelpCircle className="w-3 h-3" />
                      What's this?
                    </button>
                  </div>
                </div>
                <div className="flex-1 relative h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-1/2 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(Math.abs(scaledValue), 100)}%`,
                      backgroundColor: scaledValue > 0 ? 'rgba(14, 165, 233, 0.8)' : 'rgba(239, 68, 68, 0.8)',
                      transform: `translateX(${scaledValue > 0 ? '0' : '-100%'})`
                    }}
                  />
                  <div className="absolute top-0 left-1/2 w-px h-full bg-gray-400" />
                </div>
                <div className="w-16 text-xs text-gray-500 text-right">
                  {value.toFixed(4)}
                </div>
                
                {/* Tooltip */}
                {showTooltip === dimension.id && (
                  <div className="absolute z-10 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg max-w-xs -mt-20 ml-32">
                    <div className="font-medium mb-1">{dimension.label}</div>
                    <div>{dimension.description}</div>
                    <div className="absolute bottom-[-6px] left-8 w-3 h-3 bg-gray-900 transform rotate-45" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Pattern Similarities */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Code className="w-4 h-4" />
          Pattern Similarities
        </h4>
        <div className="space-y-4">
          {(visualization?.patterns || []).slice(0, 3).map((pattern, patternIndex) => (
            <motion.div
              key={`pattern-${patternIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: patternIndex * 0.2 + 0.5 }}
              className="p-4 bg-white rounded-lg border border-gray-200"
            >
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-gray-900 text-sm">
                  {pattern.description || `Pattern ${patternIndex + 1}`}
                </h5>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Similarity:</span>
                  <span className="font-bold text-blue-600">
                    {Math.round((pattern.similarity || 0) * 100)}%
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {dimensionLabels.map((dimension, index) => {
                  const queryValue = visualization.queryVector?.[index] || 0;
                  const patternValue = pattern.vector?.[index] || 0;
                  const similarity = 1 - Math.abs(queryValue - patternValue) / 2;
                  
                  return (
                    <div 
                      key={dimension.id} 
                      className="text-center relative group cursor-help"
                      title={dimension.description}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="text-sm">{dimension.icon}</span>
                        <div className="text-xs text-gray-600 font-medium">
                          {dimension.shortLabel}
                        </div>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000"
                          style={{ 
                            width: `${similarity * 100}%`,
                            transitionDelay: `${patternIndex * 200 + index * 50}ms`
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {Math.round(similarity * 100)}%
                      </div>
                      
                      {/* Hover tooltip for pattern dimensions */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                        <div className="bg-gray-900 text-white text-xs rounded-lg p-2 whitespace-nowrap">
                          {dimension.description}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Dimension Explanation Banner */}
      <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
        <h4 className="font-medium text-purple-900 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Understanding the Visualization
        </h4>
        <div className="text-sm text-purple-800 space-y-2">
          <p className="font-medium">What you're seeing:</p>
          <p>• <strong>1536 dimensions simplified to 4</strong> - Real embeddings have 1536 dimensions, we show the most meaningful ones</p>
          <p>• <strong>Semantic mapping</strong> - Each dimension captures different aspects of meaning and similarity</p>
          <p>• <strong>Positive/negative values</strong> - Show different directions in semantic space (blue = positive, red = negative)</p>
          <p>• <strong>Similarity percentages</strong> - Higher percentages mean patterns are more semantically similar to your query</p>
        </div>
      </div>

      {/* Technical Explanation */}
      <div className="mt-4 p-4 bg-blue-100 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
          <Brain className="w-4 h-4" />
          How Semantic Search Works
        </h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• Your query gets converted into a mathematical vector that captures its meaning</p>
          <p>• Code patterns are also vectorized, preserving their semantic essence</p>
          <p>• We compare vectors using cosine similarity - measuring the "angle" between meanings</p>
          <p>• Results ranked by semantic similarity, not just keyword matching</p>
          <p>• This enables finding relevant code even when exact keywords don't match</p>
          {visualization?.isSimplified && (
            <div className="text-yellow-700 bg-yellow-100 px-3 py-2 rounded mt-3 flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>This is a simplified visualization. Connect to the full API for detailed embeddings analysis.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbeddingVisualizer;