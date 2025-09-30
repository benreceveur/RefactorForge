import React, { useState } from 'react';
import { Calendar, Tag, GitBranch, User, ExternalLink, Copy, Check, Code, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';

const PatternCard = ({ pattern, showSimilarity = false, onSave, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pattern.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getLanguage = (content) => {
    if (content.includes('CREATE TABLE') || content.includes('SELECT')) return 'sql';
    if (content.includes('import React') || content.includes('const ')) return 'javascript';
    if (content.includes('describe(') || content.includes('it(')) return 'javascript';
    return 'javascript';
  };

  const getCategoryColor = (category) => {
    const colors = {
      frontend: 'bg-purple-100 text-purple-800',
      backend: 'bg-green-100 text-green-800',
      database: 'bg-yellow-100 text-yellow-800',
      testing: 'bg-red-100 text-red-800',
      devops: 'bg-blue-100 text-blue-800',
      security: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getSourceUrl = () => {
    if (pattern.context?.repository && pattern.context?.file_path) {
      return `https://github.com/${pattern.context.repository}/blob/main/${pattern.context.file_path}`;
    }
    if (pattern.source && pattern.source.includes('github.com')) {
      return pattern.source.startsWith('http') ? pattern.source : `https://${pattern.source}`;
    }
    return null;
  };

  return (
    <div className={`card-hover ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {pattern.title || pattern.description || 'Untitled Pattern'}
          </h3>
          <p className="text-gray-600 text-sm mb-3">
            {pattern.description}
          </p>
        </div>
        {showSimilarity && (
          <div className="ml-4 flex flex-col items-end">
            <div className="badge-primary mb-2">
              {Math.round(pattern.similarity * 100)}% match
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <GitBranch className="w-4 h-4" />
          <span>
            {pattern.context?.repository || pattern.context?.repo || pattern.repository || 'Unknown Repository'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <User className="w-4 h-4" />
          <span>{pattern.context?.author || pattern.source || 'System'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          <span>{formatDistanceToNow(new Date(pattern.createdAt || pattern.timestamp || new Date()), { addSuffix: true })}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs">
            Used {pattern.usageCount || pattern.usage || 
              (pattern.context?.usage_count ? pattern.context.usage_count : 
                (pattern.context?.pr_number ? 1 : 0))} times
          </span>
        </div>
      </div>

      {/* Category and Tags */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`badge ${getCategoryColor(pattern.category)}`}>
          {pattern.category}
        </span>
        {(pattern.tags || []).map((tag, index) => (
          <span key={index} className="badge-secondary">
            <Tag className="w-3 h-3 mr-1" />
            {tag}
          </span>
        ))}
      </div>

      {/* Content Preview */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">Code Pattern</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-memory-600 hover:text-memory-700 font-medium"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
        
        <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-none' : 'max-h-40'}`}>
          <SyntaxHighlighter
            language={getLanguage(pattern.content)}
            style={oneLight}
            customStyle={{
              margin: 0,
              borderRadius: '6px',
              fontSize: '12px',
              lineHeight: '1.4'
            }}
            codeTagProps={{
              style: {
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
              }
            }}
          >
            {pattern.content.trim()}
          </SyntaxHighlighter>
        </div>
        
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {getSourceUrl() ? (
            <a
              href={getSourceUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              View source
            </a>
          ) : (
            <button
              onClick={() => setShowSourceModal(true)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Code className="w-3 h-3" />
              View source
            </button>
          )}
          {(pattern.context?.pr_number || pattern.context?.pr) && (
            <a
              href={`https://github.com/${pattern.context?.repository || pattern.context?.repo || 'unknown'}/pull/${(pattern.context?.pr_number || pattern.context?.pr || '').toString().replace('#', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              #{pattern.context?.pr_number || pattern.context?.pr}
            </a>
          )}
          {pattern.context?.issue && (
            <a
              href={`https://github.com/${pattern.context?.repository || pattern.context?.repo || 'unknown'}/issues/${pattern.context.issue.replace('#', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {pattern.context.issue}
            </a>
          )}
        </div>
        
        {onSave && (
          <button
            onClick={() => onSave(pattern)}
            className="btn-secondary text-xs"
          >
            Save Pattern
          </button>
        )}
      </div>

      {/* Source Code Modal */}
      <AnimatePresence>
        {showSourceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSourceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Source Code
                  </h3>
                  <p className="text-sm text-gray-600">
                    {pattern.title || pattern.description || 'Code Pattern'}
                  </p>
                </div>
                <button
                  onClick={() => setShowSourceModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-4">
                {/* Pattern Metadata */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Repository:</span>{' '}
                      <span className="text-gray-600">
                        {pattern.context?.repository || pattern.context?.repo || pattern.repository || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Author:</span>{' '}
                      <span className="text-gray-600">
                        {pattern.context?.author || pattern.source || 'System'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Created:</span>{' '}
                      <span className="text-gray-600">
                        {formatDistanceToNow(new Date(pattern.createdAt || pattern.timestamp || new Date()), { addSuffix: true })}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Category:</span>{' '}
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(pattern.category)}`}>
                        {pattern.category}
                      </span>
                    </div>
                  </div>
                  {pattern.context?.file_path && (
                    <div className="mt-2">
                      <span className="font-medium text-gray-700">File:</span>{' '}
                      <span className="text-gray-600 font-mono text-xs">
                        {pattern.context.file_path}
                      </span>
                    </div>
                  )}
                </div>

                {/* Source Code */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Source Code</h4>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  
                  <SyntaxHighlighter
                    language={getLanguage(pattern.content)}
                    style={oneLight}
                    customStyle={{
                      margin: 0,
                      borderRadius: '6px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      maxHeight: '500px',
                      overflow: 'auto'
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
                      }
                    }}
                    showLineNumbers={true}
                    wrapLines={true}
                  >
                    {pattern.content.trim()}
                  </SyntaxHighlighter>
                </div>

                {/* Additional Context */}
                {(pattern.description || pattern.tags?.length > 0) && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    {pattern.description && (
                      <div className="mb-2">
                        <span className="font-medium text-blue-900">Description:</span>
                        <p className="text-blue-800 text-sm mt-1">{pattern.description}</p>
                      </div>
                    )}
                    {pattern.tags?.length > 0 && (
                      <div>
                        <span className="font-medium text-blue-900">Tags:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {pattern.tags.map((tag, index) => (
                            <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {pattern.context?.pr_number && (
                    <a
                      href={`https://github.com/${pattern.context?.repository || 'unknown'}/pull/${pattern.context.pr_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      View PR #{pattern.context.pr_number}
                    </a>
                  )}
                  {getSourceUrl() && (
                    <a
                      href={getSourceUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      View on GitHub
                    </a>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {onSave && (
                    <button
                      onClick={() => {
                        onSave(pattern);
                        setShowSourceModal(false);
                      }}
                      className="btn-secondary text-sm"
                    >
                      Save Pattern
                    </button>
                  )}
                  <button
                    onClick={() => setShowSourceModal(false)}
                    className="btn-primary text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PatternCard;