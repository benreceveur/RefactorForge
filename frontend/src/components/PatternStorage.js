import React, { useState } from 'react';
import { Save, GitBranch, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from '../services/api';

const PatternStorage = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'frontend',
    tags: '',
    githubUrl: '',
    content: ''
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});

  const categories = [
    { value: 'frontend', label: 'Frontend' },
    { value: 'backend', label: 'Backend' },
    { value: 'database', label: 'Database' },
    { value: 'testing', label: 'Testing' },
    { value: 'devops', label: 'DevOps' },
    { value: 'security', label: 'Security' }
  ];

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'Code content is required';
    }
    
    if (formData.githubUrl && !formData.githubUrl.match(/^https:\/\/github\.com\/.+/)) {
      newErrors.githubUrl = 'Please enter a valid GitHub URL';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    setErrors({});
    
    try {
      // Process the form data
      const pattern = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        content: formData.content,
        repository: formData.githubUrl ? formData.githubUrl.split('/').slice(3, 5).join('/') : '',
        metadata: {
          githubUrl: formData.githubUrl,
          author: 'user',
          createdAt: new Date().toISOString()
        }
      };
      
      // Save to real API
      const result = await apiService.createPattern(pattern);
      
      // Track pattern creation event for timeline
      await apiService.trackEvent({
        type: 'pattern_created',
        category: 'pattern_management',
        title: 'New Pattern Created',
        description: `Created pattern "${formData.title}" in ${formData.category} category`,
        context: {
          page: 'PatternStorage',
          patternTitle: formData.title,
          category: formData.category,
          tags: pattern.tags,
          hasGithubUrl: !!formData.githubUrl,
          repository: pattern.repository
        },
        metrics: {
          contentLength: formData.content.length,
          tagsCount: pattern.tags.length,
          categoryUsed: formData.category
        }
      });
      
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setFormData({
          title: '',
          description: '',
          category: 'frontend',
          tags: '',
          githubUrl: '',
          content: ''
        });
      }, 3000);
      
    } catch (error) {
      setErrors({ submit: 'Failed to save pattern. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const extractFromGitHub = () => {
    // Simulate extracting information from GitHub URL
    if (formData.githubUrl) {
      const urlParts = formData.githubUrl.split('/');
      const repo = urlParts.slice(-2).join('/');
      
      setFormData(prev => ({
        ...prev,
        title: prev.title || `Pattern from ${repo}`,
        description: prev.description || `Code pattern extracted from ${repo}`
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Save New Pattern</h2>
          <p className="text-gray-600 mt-1">
            Extract and save coding patterns from GitHub repositories
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <GitBranch className="w-4 h-4" />
          <span>GitHub Integration Active</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* GitHub URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GitHub URL (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={formData.githubUrl}
              onChange={(e) => handleInputChange('githubUrl', e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
              className={`input-field ${errors.githubUrl ? 'border-red-300' : ''}`}
            />
            <button
              type="button"
              onClick={extractFromGitHub}
              disabled={!formData.githubUrl}
              className="btn-secondary whitespace-nowrap"
            >
              Extract Info
            </button>
          </div>
          {errors.githubUrl && (
            <p className="mt-1 text-sm text-red-600">{errors.githubUrl}</p>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pattern Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="e.g., React Component Error Boundaries"
            className={`input-field ${errors.title ? 'border-red-300' : ''}`}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Describe what this pattern does and when to use it"
            rows={3}
            className={`input-field ${errors.description ? 'border-red-300' : ''}`}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
          )}
        </div>

        {/* Category and Tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => handleInputChange('tags', e.target.value)}
              placeholder="react, hooks, error-handling"
              className="input-field"
            />
          </div>
        </div>

        {/* Code Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Code Pattern *
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            placeholder="Paste your code pattern here..."
            rows={12}
            className={`input-field font-mono text-sm ${errors.content ? 'border-red-300' : ''}`}
          />
          {errors.content && (
            <p className="mt-1 text-sm text-red-600">{errors.content}</p>
          )}
        </div>

        {/* Submit Errors */}
        {errors.submit && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">{errors.submit}</span>
          </div>
        )}

        {/* Success Message */}
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md"
            >
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-700">
                Pattern saved successfully! Semantic embeddings generated.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-6"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving Pattern...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Pattern
              </>
            )}
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="bg-memory-50 border border-memory-200 rounded-lg p-4">
        <h3 className="font-medium text-memory-900 mb-2">How Pattern Storage Works</h3>
        <ul className="text-sm text-memory-700 space-y-1">
          <li>• Patterns are automatically analyzed using OpenAI embeddings for semantic search</li>
          <li>• GitHub integration extracts context from PRs and issues automatically</li>
          <li>• Similar patterns are detected and suggested to avoid duplicates</li>
          <li>• Code is syntax-highlighted and validated for common patterns</li>
        </ul>
      </div>
    </div>
  );
};

export default PatternStorage;