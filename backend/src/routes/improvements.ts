import { Router, Request, Response } from 'express';
import { ApiResponse, Priority, RecommendationType } from '../types/common.types';
import { CodeImprovementRow } from '../types/database.types';
import { RepositoryInfo } from '../types/analysis.types';
import { calculateTotalBugsPrevented, generateImprovementAnalytics, extractBugsFromDescription } from '../utils/metrics-calculator';
import { RecommendationEngine } from '../services/recommendation-engine';
import { RepositoryAnalyzer } from '../services/repository-analyzer';

const router = Router();

// Initialize services
const recommendationEngine = new RecommendationEngine();
const repositoryAnalyzer = new RepositoryAnalyzer();

/*
 * REFACTORFORGE IMPROVEMENT QUALITY STANDARDS
 * 
 * After systematic code review and technical accuracy improvements,
 * all future improvements must meet these standards:
 * 
 * 1. REPOSITORY ACCURACY
 *    - Must reference IntelliPact repositories that actually exist
 *    - Use RefactorForge-specific examples whenever possible
 *    - No generic "external API" or unrelated framework examples
 * 
 * 2. TECHNICAL ACCURACY  
 *    - Code examples must be implementable without errors
 *    - Use actual dependencies from package.json (Express, SQLite3, UUID, etc.)
 *    - Preserve context in async/await conversions (e.g., SQLite3 this.lastID)
 * 
 * 3. REALISTIC METRICS
 *    - Performance gains should be conservative (15-40% max)
 *    - Time estimates should reflect actual implementation complexity
 *    - Metrics should be measurable and achievable
 * 
 * 4. CONTEXTUAL RELEVANCE
 *    - Before/after code must show actual RefactorForge patterns
 *    - Examples should use existing endpoints and database schema
 *    - Focus on backend TypeScript/Express patterns, not frontend
 * 
 * 5. PROPER CATEGORIZATION
 *    - Use functional categories: performance, security, testing, architecture, maintainability
 *    - Avoid priority-based categories (critical, high, medium)
 *    - Match frontend expectations for category filtering
 * 
 * 6. CODE STYLE CONSISTENCY
 *    - Use TypeScript with proper imports
 *    - Follow existing RefactorForge patterns
 *    - Include realistic error handling
 * 
 * These standards ensure all improvements are:
 * - Technically sound and implementable
 * - Specific to RefactorForge architecture  
 * - Useful for actual development work
 * - Consistent with existing codebase
 */

// Legacy mock data for backward compatibility (fallback only)
const improvements = [
  {
    id: 'imp-1',
    title: 'Convert all contacts.ts endpoints to async/await',
    description: 'Modernize all 5 database endpoints with proper async/await pattern using custom promise wrappers',
    category: 'maintainability',
    impact: 'Improved code readability and consistent error handling across all endpoints',
    repository: 'IntelliPact/RefactorForge',
    platform: 'backend',
    team: 'Backend Team',
    metrics: {
      timeToImplement: '4 hours',
      timeSaved: '15 minutes per debug session',
      bugsPrevented: 'Callback nesting complexity, easier error tracing',
      performanceGain: 'Negligible - focus is maintainability',
      bugsPreventedCount: 2 // Maintainability improvement
    },
    beforeCode: `// Current callback-based implementation (5 endpoints)
// GET all contacts
router.get('/', (req: Request, res: Response) => {
  db.all('SELECT * FROM contacts ORDER BY updated_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// POST new contact
router.post('/', (req: Request, res: Response) => {
  const { name, email, phone, context } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    \`INSERT INTO contacts (id, name, email, phone, context, last_interaction, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
    [id, name, email, phone, context, now, now, now],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id, name, email, phone, context,
        last_interaction: now, created_at: now, updated_at: now
      });
    }
  );
});

// PUT update contact
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, phone, context } = req.body;
  const now = new Date().toISOString();

  db.run(
    \`UPDATE contacts SET name = ?, email = ?, phone = ?, context = ?, updated_at = ?, last_interaction = ? WHERE id = ?\`,
    [name, email, phone, context, now, now, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      res.json({ message: 'Contact updated successfully' });
    }
  );
});`,
    afterCode: `// Step 1: Add custom promise wrappers that preserve SQLite3 context
const dbAll = (query: string, params: unknown[] = []): Promise<CodeImprovementRow[]> => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const dbGet = (query: string, params: unknown[] = []): Promise<CodeImprovementRow | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbRun = (query: string, params: unknown[] = []): Promise<{lastID?: number, changes: number}> => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Step 2: Convert all endpoints to async/await
router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await dbAll('SELECT * FROM contacts ORDER BY updated_at DESC');
    res.json(rows);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const { name, email, phone, context } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    await dbRun(
      \`INSERT INTO contacts (id, name, email, phone, context, last_interaction, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
      [id, name, email, phone, context, now, now, now]
    );
    res.status(201).json({
      id, name, email, phone, context,
      last_interaction: now, created_at: now, updated_at: now
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, phone, context } = req.body;
  const now = new Date().toISOString();

  try {
    const result = await dbRun(
      \`UPDATE contacts SET name = ?, email = ?, phone = ?, context = ?, updated_at = ?, last_interaction = ? WHERE id = ?\`,
      [name, email, phone, context, now, now, id]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ message: 'Contact updated successfully' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});`,
    tags: ['async', 'refactoring', 'modernization', 'RefactorForge', 'sqlite3'],
    status: 'completed',
    difficulty: 'medium'
  },
  {
    id: 'imp-2',
    title: 'Add React.memo to CodeImprovements component',
    description: 'Optimize expensive CodeImprovements component with memoization',
    category: 'performance',
    impact: 'Significant performance improvement in UI responsiveness',
    repository: 'IntelliPact/RefactorForge',
    platform: 'frontend',
    team: 'Frontend Team',
    metrics: {
      timeToImplement: '1 hour',
      timeSaved: '2 seconds per filter change',
      bugsPrevented: 'UI freezing on large datasets',
      performanceGain: '15% reduction in render time',
      bugsPreventedCount: 2 // Performance improvement
    },
    beforeCode: `// From /.claude/memory/demo/src/components/CodeImprovements.js:31
const CodeImprovements = () => {
  const [improvements, setImprovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedImpact, setSelectedImpact] = useState('all');
  const [sortBy, setSortBy] = useState('impact');
  
  // Expensive filtering operation on every render (lines 180-201)
  const filteredImprovements = improvements.filter(improvement => {
    const categoryMatch = selectedCategory === 'all' || 
                         improvement.category === selectedCategory;
    const impactMatch = selectedImpact === 'all' || 
                       improvement.impact.toLowerCase().includes(selectedImpact);
    return categoryMatch && impactMatch;
  });

  const sortedImprovements = [...filteredImprovements].sort((a, b) => {
    if (sortBy === 'impact') {
      const order = ['critical', 'high', 'medium', 'low'];
      return order.indexOf(a.category) - order.indexOf(b.category);
    }
    return 0;
  });

  return (
    <div className="code-improvements">
      {sortedImprovements.map(improvement => (
        <ImprovementCard key={improvement.id} {...improvement} />
      ))}
    </div>
  );
};`,
    afterCode: `// Optimized with React.memo and useMemo
import React, { useState, useEffect, useMemo, useCallback } from 'react';

const CodeImprovements = React.memo(() => {
  const [improvements, setImprovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedImpact, setSelectedImpact] = useState('all');
  const [sortBy, setSortBy] = useState('impact');
  
  // Memoize expensive filtering and sorting operations
  const sortedImprovements = useMemo(() => {
    const filtered = improvements.filter(improvement => {
      const categoryMatch = selectedCategory === 'all' || 
                           improvement.category === selectedCategory;
      const impactMatch = selectedImpact === 'all' || 
                         improvement.impact.toLowerCase().includes(selectedImpact);
      return categoryMatch && impactMatch;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'impact') {
        const order = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(a.category) - order.indexOf(b.category);
      }
      return 0;
    });
  }, [improvements, selectedCategory, selectedImpact, sortBy]);

  // Memoize callback functions
  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  const handleImpactChange = useCallback((impact) => {
    setSelectedImpact(impact);
  }, []);

  return (
    <div className="code-improvements">
      {sortedImprovements.map(improvement => (
        <ImprovementCard key={improvement.id} {...improvement} />
      ))}
    </div>
  );
});

// Also memoize child component
const ImprovementCard = React.memo(({ id, title, description, impact }) => {
  return (
    <div className="improvement-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="impact">{impact}</span>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.id === nextProps.id &&
         prevProps.title === nextProps.title &&
         prevProps.impact === nextProps.impact;
});`,
    tags: ['react', 'performance', 'optimization', 'RefactorForge'],
    status: 'pending',
    difficulty: 'easy'
  },
  {
    id: 'imp-3',
    title: 'Add structured logging to refactor endpoints',
    description: 'Implement comprehensive logging for RefactorForge analyze and apply endpoints to track usage and debug issues',
    category: 'architecture',
    impact: 'Better debugging, usage tracking, and error investigation',
    repository: 'IntelliPact/RefactorForge',
    platform: 'backend',
    team: 'Backend Team',
    metrics: {
      timeToImplement: '3 hours',
      timeSaved: '20 minutes per debugging session',
      bugsPrevented: 'Silent failures in refactoring operations',
      performanceGain: 'Better error detection and response times',
      bugsPreventedCount: 3 // Architecture improvement
    },
    beforeCode: `// From /backend/src/routes/refactor.ts:8-42 - No structured logging
router.post('/analyze', (req: Request, res: Response) => {
  const { code, language, filePath } = req.body;

  // Placeholder for AI-powered code analysis
  const suggestions = [
    {
      type: 'performance',
      description: 'Consider using const instead of let for immutable variables',
      line: 5,
    },
    // ... more suggestions
  ];

  res.json({
    filePath,
    language,
    suggestions,
    score: {
      performance: 85,
      readability: 72,
      maintainability: 78,
      overall: 78,
    },
  });
});

router.post('/apply', (req: Request, res: Response) => {
  const { originalCode, suggestions, filePath } = req.body;
  const id = uuidv4();

  // Placeholder for refactoring logic - no logging
  const refactoredCode = originalCode;
  
  res.json({
    id,
    originalCode,
    refactoredCode,
    applied: suggestions.length,
  });
});`,
    afterCode: `// Add structured logging with request tracking
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'refactor-operations.log' }),
    new winston.transports.Console()
  ]
});

router.post('/analyze', (req: Request, res: Response) => {
  const { code, language, filePath } = req.body;
  const requestId = uuidv4();
  
  logger.info('Code analysis started', {
    requestId,
    language,
    filePath,
    codeLength: code?.length || 0,
    timestamp: new Date().toISOString()
  });

  try {
    // Placeholder for AI-powered code analysis
    const suggestions = [
      {
        type: 'performance',
        description: 'Consider using const instead of let for immutable variables',
        line: 5,
      },
      // ... more suggestions
    ];

    const response = {
      filePath,
      language,
      suggestions,
      score: {
        performance: 85,
        readability: 72,
        maintainability: 78,
        overall: 78,
      },
    };

    logger.info('Code analysis completed', {
      requestId,
      suggestionsCount: suggestions.length,
      overallScore: response.score.overall,
      processingTime: Date.now() - startTime
    });

    res.json(response);
  } catch (error) {
    logger.error('Code analysis failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Analysis failed' });
  }
});

router.post('/apply', (req: Request, res: Response) => {
  const { originalCode, suggestions, filePath } = req.body;
  const id = uuidv4();
  const startTime = Date.now();

  logger.info('Refactoring started', {
    refactorId: id,
    filePath,
    suggestionsCount: suggestions?.length || 0,
    codeLength: originalCode?.length || 0
  });

  try {
    // Placeholder for refactoring logic
    const refactoredCode = originalCode;
    
    const response = {
      id,
      originalCode,
      refactoredCode,
      applied: suggestions.length,
    };

    logger.info('Refactoring completed', {
      refactorId: id,
      appliedSuggestions: suggestions.length,
      processingTime: Date.now() - startTime,
      success: true
    });

    res.json(response);
  } catch (error) {
    logger.error('Refactoring failed', {
      refactorId: id,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Refactoring failed' });
  }
});`,
    tags: ['logging', 'observability', 'debugging', 'RefactorForge'],
    status: 'pending',
    difficulty: 'medium'
  },
  {
    id: 'imp-4',
    title: 'Extract error handling middleware',
    description: 'Create reusable error handling middleware for RefactorForge backend',
    category: 'maintainability',
    impact: 'Reduce code duplication and standardize error responses',
    repository: 'IntelliPact/RefactorForge',
    platform: 'backend',
    team: 'Backend Team',
    metrics: {
      timeToImplement: '1 hour',
      timeSaved: '15 minutes per new endpoint',
      bugsPrevented: 'Inconsistent error responses, unhandled errors',
      performanceGain: '20% less code to maintain',
      bugsPreventedCount: 3 // Maintainability improvement
    },
    beforeCode: `// From /backend/src/routes/contacts.ts - Repeated error pattern
// Lines 10-15
router.get('/', (req: Request, res: Response) => {
  db.all('SELECT * FROM contacts ORDER BY updated_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Lines 21-28
router.get('/:id', (req: Request, res: Response) => {
  db.get('SELECT * FROM contacts WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // ...
  });
});

// Lines 42-44, 71-73 - Same pattern repeated
if (err) {
  return res.status(500).json({ error: err.message });
}`,
    afterCode: `// Create error handling middleware
// /backend/src/middleware/errorHandler.ts
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Customize error based on type
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: err.message 
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      error: 'Unauthorized access' 
    });
  }

  // Default error
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
};

// Apply in routes - much cleaner
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const rows = await dbAll('SELECT * FROM contacts ORDER BY updated_at DESC');
  res.json(rows);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const row = await dbGet('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
  if (!row) {
    throw new Error('Contact not found');
  }
  res.json(row);
}));

// Apply globally in index.ts
app.use(errorHandler);`,
    tags: ['middleware', 'error-handling', 'refactoring', 'RefactorForge'],
    status: 'pending',
    difficulty: 'medium'
  },
  {
    id: 'imp-5',
    title: 'Add retry middleware for GitHub API calls',
    description: 'Implement exponential backoff retry middleware for GitHub integration endpoints',
    category: 'maintainability',
    impact: 'Improved reliability when syncing repositories and handling GitHub API rate limits',
    repository: 'IntelliPact/RefactorForge',
    platform: 'backend',
    team: 'Backend Team',
    metrics: {
      timeToImplement: '1.5 hours',
      timeSaved: '30 minutes per GitHub API failure',
      bugsPrevented: '5-8 sync failures per day due to network issues',
      performanceGain: '95% success rate for GitHub syncs',
      bugsPreventedCount: 6 // Estimated from 5-8 range
    },
    beforeCode: `// GitHub sync endpoint without retry logic
router.post('/integrations/:id/sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Direct GitHub API call - fails on rate limits/network issues
    const response = await fetch(\`https://api.github.com/repos/IntelliPact/\${id}\`);
    if (!response.ok) {
      throw new Error('GitHub API request failed');
    }
    
    const repoData = await response.json();
    res.json({
      success: true,
      patternsCount: repoData.size || 0,
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});`,
    afterCode: `// With retry middleware for GitHub API calls
import { retryMiddleware } from '../middleware/retry';

const githubRetry = retryMiddleware({
  retries: 3,
  baseDelay: 1000,
  maxDelay: 8000,
  retryCondition: (error) => {
    // Retry on network errors and rate limits (not 404s)
    return error.code === 'ECONNRESET' || 
           error.status === 429 || 
           error.status >= 500;
  }
});

router.post('/integrations/:id/sync', githubRetry, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // GitHub API call with automatic retry on transient failures
    const response = await fetch(\`https://api.github.com/repos/IntelliPact/\${id}\`);
    if (!response.ok && response.status === 404) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }
    if (!response.ok) {
      throw new Error(\`GitHub API error: \${response.status}\`);
    }
    
    const repoData = await response.json();
    res.json({
      success: true,
      patternsCount: repoData.size || 0,
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});`,
    tags: ['express', 'github', 'retry', 'middleware', 'RefactorForge'],
    status: 'pending',
    difficulty: 'medium'
  },
  {
    id: 'imp-6',
    title: 'Optimize SQLite queries with indexing and prepared statements',
    description: 'Add database indexes and use prepared statements for frequently accessed contact queries',
    category: 'performance',
    impact: 'Faster query execution and reduced database load for contact operations',
    repository: 'IntelliPact/RefactorForge',
    platform: 'backend',
    team: 'Backend Team',
    metrics: {
      timeToImplement: '2 hours',
      timeSaved: '50ms per contact query',
      bugsPrevented: 'Slow database queries, timeout errors on large datasets',
      performanceGain: '40% faster contact retrieval',
      bugsPreventedCount: 2 // Performance improvement
    },
    beforeCode: `// Unoptimized SQLite queries without indexes
router.get('/', (req: Request, res: Response) => {
  db.all('SELECT * FROM contacts ORDER BY updated_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.get('SELECT * FROM contacts WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});`,
    afterCode: `// Optimized with indexes and prepared statements
import { Database } from 'sqlite3';

// Create indexes for better performance
db.run('CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at DESC)');
db.run('CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)');
db.run('CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name)');

// Prepare frequently used statements
const getAllContactsStmt = db.prepare('SELECT * FROM contacts ORDER BY updated_at DESC LIMIT ?');
const getContactByIdStmt = db.prepare('SELECT * FROM contacts WHERE id = ?');
const searchContactsStmt = db.prepare('SELECT * FROM contacts WHERE name LIKE ? OR email LIKE ? ORDER BY updated_at DESC LIMIT ?');

router.get('/', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  
  getAllContactsStmt.all([limit], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  getContactByIdStmt.get([id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});`,
    tags: ['sqlite', 'indexing', 'prepared-statements', 'performance', 'RefactorForge'],
    status: 'completed',
    difficulty: 'medium'
  },
  {
    id: 'imp-7',
    title: 'Add input validation to RefactorForge API',
    description: 'Implement validation middleware for refactor.ts and contacts.ts endpoints',
    category: 'security',
    impact: 'Enhanced security and data integrity',
    repository: 'IntelliPact/RefactorForge',
    platform: 'backend',
    team: 'Security Team',
    metrics: {
      timeToImplement: '3 hours',
      timeSaved: '5 hours per security incident',
      bugsPrevented: 'SQL injection, XSS attacks',
      performanceGain: '5% improvement from early validation',
      bugsPreventedCount: 4 // Security improvement
    },
    beforeCode: `// From /backend/src/routes/refactor.ts:8-42 - No validation
router.post('/analyze', (req: Request, res: Response) => {
  const { code, language, filePath } = req.body;
  // No validation of input parameters
  // Directly uses user input without sanitization
  
  const suggestions = analyzeCode(code, language);
  const id = uuidv4();
  
  db.run(
    'INSERT INTO refactorings (id, code, language, file_path, suggestions) VALUES (?, ?, ?, ?, ?)',
    [id, code, language, filePath || null, JSON.stringify(suggestions)],
    // ...
  );
});

// From /backend/src/routes/contacts.ts:32-57 - No validation
router.post('/', (req: Request, res: Response) => {
  const { name, email, phone, context } = req.body;
  // No validation middleware or schema validation
  db.run(
    'INSERT INTO contacts (name, email, phone, context) VALUES (?, ?, ?, ?)',
    [name, email, phone, context],
    // ...
  );
});`,
    afterCode: `// Add validation middleware
import { body, validationResult } from 'express-validator';

// Validation rules for refactor endpoint
const validateRefactorAnalyze = [
  body('code')
    .notEmpty().withMessage('Code is required')
    .isLength({ max: 50000 }).withMessage('Code too large (max 50KB)'),
  body('language')
    .notEmpty().withMessage('Language is required')
    .isIn(['javascript', 'typescript', 'python', 'java', 'go'])
    .withMessage('Unsupported language'),
  body('filePath')
    .optional()
    .matches(/^[a-zA-Z0-9\/\-_.]+$/).withMessage('Invalid file path')
];

// Validation rules for contacts
const validateContact = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email')
    .trim()
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  body('phone')
    .optional()
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone number'),
  body('context')
    .optional()
    .trim()
    .escape() // Prevent XSS
    .isLength({ max: 1000 }).withMessage('Context too long')
];

// Apply validation in routes
router.post('/analyze', validateRefactorAnalyze, (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  
  const { code, language, filePath } = req.body;
  // Now safe to use validated inputs
  const suggestions = analyzeCode(code, language);
  // ...
});

router.post('/', validateContact, (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  
  const { name, email, phone, context } = req.body;
  // Safe to use validated and sanitized inputs
  // ...
});`,
    tags: ['security', 'validation', 'middleware'],
    status: 'pending',
    difficulty: 'easy'
  },
  {
    id: 'imp-8',
    title: 'Optimize TypeScript build performance',
    description: 'Configure TypeScript compiler for faster builds and smaller output',
    category: 'performance',
    impact: 'Faster development builds and reduced server startup time',
    repository: 'IntelliPact/RefactorForge',
    platform: 'backend',
    team: 'Backend Team',
    metrics: {
      timeToImplement: '1 hour',
      timeSaved: '15 seconds per build',
      bugsPrevented: 'Slow builds, development friction',
      performanceGain: '30% faster TypeScript compilation',
      bugsPreventedCount: 1 // Performance improvement
    },
    beforeCode: `// tsconfig.json - Basic configuration
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,
    afterCode: `// tsconfig.json - Optimized for performance
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    // Production optimizations
    "declaration": false,        // Disable for faster builds
    "declarationMap": false,     // Disable for faster builds
    "sourceMap": false,          // Disable in production
    "removeComments": true,      // Smaller output files
    "moduleResolution": "node",
    // Performance improvements
    "incremental": true,         // Enable incremental compilation
    "tsBuildInfoFile": "./dist/.tsbuildinfo",
    "composite": false,
    // Tree shaking support
    "importsNotUsedAsValues": "remove"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  // Optimize file processing
  "watchOptions": {
    "excludeDirectories": ["**/node_modules", "./dist"],
    "excludeFiles": ["**/dist/**/*"]
  }
}`,
    tags: ['typescript', 'build', 'optimization', 'performance', 'RefactorForge'],
    status: 'pending',
    difficulty: 'easy'
  },
  {
    id: 'imp-9',
    title: 'Enhanced RefactorForge health monitoring',
    description: 'Enhance existing /api/health endpoint with SQLite database checks and dependency monitoring',
    category: 'testing',
    impact: 'Better monitoring of RefactorForge backend and database health',
    repository: 'IntelliPact/RefactorForge',
    platform: 'backend',
    team: 'Backend Team',
    metrics: {
      timeToImplement: '1 hour',
      timeSaved: '20 minutes per database issue',
      bugsPrevented: 'Database connection failures, silent SQLite issues',
      performanceGain: '80% faster issue detection',
      bugsPreventedCount: 3 // Testing improvement
    },
    beforeCode: `// Basic health check - no dependency validation
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'RefactorForge Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});`,
    afterCode: `// Enhanced health check with SQLite and dependency monitoring
import db from '../database';

app.get('/api/health', async (req: Request, res: Response) => {
  const healthCheck = {
    status: 'ok',
    service: 'RefactorForge Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: 'unknown' },
      memory: { status: 'ok', usage: process.memoryUsage() },
      environment: {
        nodeVersion: process.version,
        platform: process.platform
      }
    }
  };

  // Check SQLite database connection
  try {
    await new Promise<void>((resolve, reject) => {
      db.get('SELECT 1 as test', (err, row) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Get database stats
    const stats = await new Promise<{contacts_count: number, memory_count: number, refactor_count: number}>((resolve, reject) => {
      db.all(\`SELECT 
        (SELECT COUNT(*) FROM contacts) as contacts_count,
        (SELECT COUNT(*) FROM memory) as memory_count,
        (SELECT COUNT(*) FROM refactor_history) as refactor_count
      \`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });
    
    healthCheck.checks.database = {
      status: 'healthy',
      tables: stats,
      type: 'SQLite3'
    };
  } catch (error) {
    healthCheck.status = 'degraded';
    healthCheck.checks.database = {
      status: 'unhealthy',
      error: error.message,
      type: 'SQLite3'
    };
  }

  // Return appropriate status code
  const statusCode = healthCheck.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});`,
    tags: ['monitoring', 'health-checks', 'sqlite', 'RefactorForge'],
    status: 'completed',
    difficulty: 'easy'
  },
  {
    id: 'imp-10',
    title: 'Add RefactorForge API rate limiting',
    description: 'Implement in-memory rate limiting for refactor and pattern search endpoints',
    category: 'security',
    impact: 'Protection against API abuse and improved server stability',
    repository: 'IntelliPact/RefactorForge',
    platform: 'backend',
    team: 'Backend Team',
    metrics: {
      timeToImplement: '1.5 hours',
      timeSaved: '2 hours per abuse incident',
      bugsPrevented: 'API abuse, server overload',
      performanceGain: '25% reduction in server load under stress',
      bugsPreventedCount: 3 // Security improvement
    },
    beforeCode: `// No rate limiting - vulnerable to abuse
app.use('/api/refactor', refactorRoutes);
app.use('/api/patterns', patternsRoutes);

// Refactor endpoint without protection
router.post('/analyze', (req: Request, res: Response) => {
  const { code, language, filePath } = req.body;
  // CPU-intensive analysis
  const suggestions = analyzeCode(code);
  res.json({ suggestions, score: calculateScore(suggestions) });
});

router.post('/apply', (req: Request, res: Response) => {
  const { originalCode, suggestions } = req.body;
  // CPU-intensive refactoring
  const refactoredCode = applyRefactoring(originalCode, suggestions);
  res.json({ refactoredCode });
});`,
    afterCode: `// With in-memory rate limiting for RefactorForge
import rateLimit from 'express-rate-limit';

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: {
    error: 'Too many requests from this IP',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict limiter for CPU-intensive operations
const refactorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Only 10 refactor operations per IP
  message: {
    error: 'Refactor rate limit exceeded',
    retryAfter: 5 * 60
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

// Apply rate limiting
app.use('/api', apiLimiter);
app.use('/api/refactor', refactorRoutes);
app.use('/api/patterns', patternsRoutes);

// Protected refactor endpoints
router.post('/analyze', refactorLimiter, (req: Request, res: Response) => {
  const { code, language, filePath } = req.body;
  const suggestions = analyzeCode(code);
  res.json({ suggestions, score: calculateScore(suggestions) });
});

router.post('/apply', refactorLimiter, (req: Request, res: Response) => {
  const { originalCode, suggestions } = req.body;
  const refactoredCode = applyRefactoring(originalCode, suggestions);
  res.json({ refactoredCode });
});`,
    tags: ['express-rate-limit', 'security', 'refactor', 'RefactorForge'],
    status: 'pending',
    difficulty: 'easy'
  }
];

// Get improvement analytics and metrics - MUST BE BEFORE /:id route
router.get('/analytics', (req: Request, res: Response) => {
  const analytics = generateImprovementAnalytics(improvements);
  
  res.json({
    totalImprovements: analytics.totalImprovements,
    completedImprovements: analytics.completedImprovements,
    pendingImprovements: analytics.pendingImprovements,
    inProgressImprovements: analytics.inProgressImprovements,
    totalBugsPrevented: analytics.totalBugsPrevented,
    implementationRate: parseFloat(analytics.implementationRate),
    averageBugsPreventedPerImprovement: parseFloat(analytics.averageBugsPreventedPerImprovement),
    bugsByCategory: analytics.bugsByCategory,
    categories: {
      performance: improvements.filter(i => i.category === 'performance').length,
      security: improvements.filter(i => i.category === 'security').length,
      maintainability: improvements.filter(i => i.category === 'maintainability').length,
      testing: improvements.filter(i => i.category === 'testing').length,
      architecture: improvements.filter(i => i.category === 'architecture').length
    },
    statusDistribution: {
      completed: improvements.filter(i => i.status === 'completed').length,
      pending: improvements.filter(i => i.status === 'pending').length,
      in_progress: improvements.filter(i => i.status === 'in_progress').length
    },
    timestamp: new Date().toISOString()
  });
});

// Get bugs prevented summary - specific endpoint for dashboard - MUST BE BEFORE /:id route
router.get('/bugs-prevented', (req: Request, res: Response) => {
  const completedImprovements = improvements.filter(i => i.status === 'completed');
  
  // Calculate total from both new numeric field and legacy string descriptions
  const totalFromNumeric = completedImprovements.reduce((sum, imp) => {
    return sum + (imp.metrics.bugsPreventedCount || 0);
  }, 0);
  
  const totalFromDescriptions = completedImprovements.reduce((sum, imp) => {
    if (!imp.metrics.bugsPreventedCount && imp.metrics.bugsPrevented) {
      return sum + extractBugsFromDescription(imp.metrics.bugsPrevented.toString());
    }
    return sum;
  }, 0);
  
  const totalBugsPrevented = totalFromNumeric + totalFromDescriptions;
  
  // Calculate by category for completed improvements only
  const bugsByCategory = {
    security: 0,
    performance: 0,
    maintainability: 0,
    testing: 0,
    architecture: 0
  };
  
  completedImprovements.forEach(improvement => {
    const bugsCount = improvement.metrics.bugsPreventedCount || 
                      extractBugsFromDescription(improvement.metrics.bugsPrevented?.toString() || '');
    
    if (bugsByCategory.hasOwnProperty(improvement.category)) {
      bugsByCategory[improvement.category as keyof typeof bugsByCategory] += bugsCount;
    }
  });
  
  res.json({
    totalBugsPrevented,
    totalImprovements: improvements.length,
    completedImprovements: completedImprovements.length,
    bugsByCategory,
    implementationRate: improvements.length > 0 ? 
      ((completedImprovements.length / improvements.length) * 100).toFixed(1) : '0',
    averageBugsPerImprovement: completedImprovements.length > 0 ? 
      (totalBugsPrevented / completedImprovements.length).toFixed(1) : '0',
    lastUpdated: new Date().toISOString()
  });
});

// Get all improvements from ALL repositories
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, impact, sortBy, limit = 50 } = req.query;

    // Get all repositories
    const repositories = await repositoryAnalyzer.getAllRepositories();

    if (repositories.length === 0) {
      // Fallback to mock data if no repositories exist
      let results = [...improvements];
      
      if (category && category !== 'all') {
        results = results.filter(i => i.category === category);
      }
      
      if (impact && impact !== 'all') {
        results = results.filter(i => i.impact.toLowerCase().includes(impact as string));
      }
      
      results = results.slice(0, parseInt(limit as string));
      const analytics = generateImprovementAnalytics(results);
      
      return res.json({
        improvements: results,
        total: results.length,
        repositoryCount: 0, // No repositories when using mock data
        categories: ['performance', 'security', 'testing', 'architecture', 'maintainability'],
        impacts: ['critical', 'high', 'medium', 'low'],
        analytics: {
          totalBugsPrevented: analytics.totalBugsPrevented,
          completedImprovements: analytics.completedImprovements,
          implementationRate: analytics.implementationRate,
          bugsByCategory: analytics.bugsByCategory
        }
      });
    }

    // Collect improvements from all repositories
    let allImprovements: any[] = [];

    for (const repo of repositories) {
      try {
        // Get existing recommendations for this repository
        const recommendations = await recommendationEngine.getRecommendationsForRepository(repo.id);

        // Convert recommendations to improvement format for API compatibility
        const repoImprovements = recommendations.map(rec => ({
          id: rec.id,
          title: rec.title,
          description: rec.description,
          // Map recommendation types to standard categories
          category: (() => {
            switch(rec.recommendationType) {
              case 'best_practices': return 'maintainability';
              case 'type_safety': return 'security';
              case 'migration': return 'architecture';
              case 'pattern_usage': return 'architecture';
              case 'performance': return 'performance';
              case 'security': return 'security';
              case 'architecture': return 'architecture';
              case 'testing': return 'testing';
              default: return 'maintainability';
            }
          })(),
          impact: rec.priority,  // Use priority directly (low, medium, high, critical)
          repository: repo.fullName,
          platform: repo.framework?.toLowerCase().includes('react') ? 'frontend' : 'backend',
          team: repo.techStack?.includes('devops') ? 'DevOps Team' :
                repo.techStack?.includes('react') ? 'Frontend Team' : 'Backend Team',
          metrics: {
            timeToImplement: rec.estimatedEffort,
            timeSaved: rec.metrics?.timeSaved || '30-60 minutes per maintenance task',
            bugsPrevented: rec.metrics?.bugsPrevented || 'Runtime and logic errors',
            performanceGain: rec.metrics?.performanceGain || '15-25% improvement',
            bugsPreventedCount: rec.recommendationType === 'security' ? 4 :
                               rec.recommendationType === 'performance' ? 2 :
                               rec.recommendationType === 'architecture' ? 3 : 2
          },
          beforeCode: rec.codeExamples[0]?.before || '',
          afterCode: rec.codeExamples[0]?.after || '',
          tags: rec.tags,
          status: rec.status === 'active' ? 'pending' : rec.status,
          difficulty: rec.priority === 'high' ? 'hard' :
                     rec.priority === 'low' ? 'easy' : 'medium'
        }));

        allImprovements.push(...repoImprovements);
        
      } catch (repoError) {
        console.error(`Error processing repository ${repo.fullName}:`, repoError);
        // Continue processing other repositories
      }
    }

    // If no improvements found from repositories, generate new ones
    if (allImprovements.length === 0) {
      
      // Generate recommendations for all repositories
      for (const repo of repositories) { // Generate for all repositories, not just first 5
        try {
          const newRecommendations = await recommendationEngine.generateRecommendations(repo.id);

          const repoImprovements = newRecommendations.map(rec => ({
            id: rec.id,
            title: rec.title,
            description: rec.description,
            // Map recommendation types to standard categories
            category: (() => {
              switch(rec.recommendationType) {
                case 'best_practices': return 'maintainability';
                case 'type_safety': return 'security';
                case 'migration': return 'architecture';
                case 'pattern_usage': return 'architecture';
                case 'performance': return 'performance';
                case 'security': return 'security';
                case 'architecture': return 'architecture';
                case 'testing': return 'testing';
                default: return 'maintainability';
              }
            })(),
            impact: rec.priority,  // Use priority directly (low, medium, high, critical)
            repository: repo.fullName,
            platform: repo.framework?.toLowerCase().includes('react') ? 'frontend' : 'backend',
            team: repo.techStack?.includes('devops') ? 'DevOps Team' :
                  repo.techStack?.includes('react') ? 'Frontend Team' : 'Backend Team',
            metrics: {
              timeToImplement: rec.estimatedEffort,
              timeSaved: '30-60 minutes per maintenance task',
              bugsPrevented: 'Runtime and logic errors',
              performanceGain: '15-25% improvement',
              bugsPreventedCount: rec.recommendationType === 'security' ? 4 :
                                 rec.recommendationType === 'performance' ? 2 :
                                 rec.recommendationType === 'architecture' ? 3 : 2
            },
            beforeCode: rec.codeExamples[0]?.before || '',
            afterCode: rec.codeExamples[0]?.after || '',
            tags: rec.tags,
            status: 'pending',
            difficulty: rec.priority === 'high' ? 'hard' :
                       rec.priority === 'low' ? 'easy' : 'medium'
          }));

          allImprovements.push(...repoImprovements);
          
        } catch (genError) {
          console.error(`Error generating recommendations for ${repo.fullName}:`, genError);
        }
      }
    }

    // Apply filters
    let results = [...allImprovements];

    if (category && category !== 'all') {
      results = results.filter(i => i.category === category);
    }

    if (impact && impact !== 'all') {
      results = results.filter(i => i.impact.toLowerCase() === impact);
    }
    
    // Sort results
    if (sortBy === 'impact') {
      const order = ['critical', 'high', 'medium', 'low'];
      results.sort((a, b) => {
        const aOrder = a.category === 'security' ? 0 : 
                      a.category === 'performance' ? 1 : 
                      a.category === 'architecture' ? 2 : 3;
        const bOrder = b.category === 'security' ? 0 : 
                      b.category === 'performance' ? 1 : 
                      b.category === 'architecture' ? 2 : 3;
        return aOrder - bOrder;
      });
    } else if (sortBy === 'difficulty') {
      const order = ['easy', 'medium', 'hard'];
      results.sort((a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty));
    }
    
    // Apply limit
    const limitNum = parseInt(limit as string);
    results = results.slice(0, limitNum);
    
    // Calculate analytics from the results
    const analytics = generateImprovementAnalytics(results);

    res.json({
      improvements: results,
      total: allImprovements.length, // Total before pagination
      repositoriesAnalyzed: repositories.length,
      repositoryCount: repositories.length, // Total repositories in database
      categories: ['performance', 'security', 'testing', 'architecture', 'maintainability'],
      impacts: ['critical', 'high', 'medium', 'low'],
      analytics: {
        totalBugsPrevented: analytics.totalBugsPrevented,
        completedImprovements: analytics.completedImprovements,
        implementationRate: analytics.implementationRate,
        bugsByCategory: analytics.bugsByCategory
      }
    });
    
  } catch (error) {
    console.error('Error fetching improvements from all repositories:', error);

    // Fallback to mock data on error
    let results = [...improvements];
    
    const { category, impact, sortBy, limit = 50 } = req.query;
    
    if (category && category !== 'all') {
      results = results.filter(i => i.category === category);
    }
    
    if (impact && impact !== 'all') {
      results = results.filter(i => i.impact.toLowerCase().includes(impact as string));
    }
    
    results = results.slice(0, parseInt(limit as string));
    const analytics = generateImprovementAnalytics(results);
    
    res.json({
      improvements: results,
      total: results.length,
      repositoryCount: 0, // No repositories in error state
      categories: ['performance', 'security', 'testing', 'architecture', 'maintainability'],
      impacts: ['critical', 'high', 'medium', 'low'],
      analytics: {
        totalBugsPrevented: analytics.totalBugsPrevented,
        completedImprovements: analytics.completedImprovements,
        implementationRate: analytics.implementationRate,
        bugsByCategory: analytics.bugsByCategory
      },
      error: 'Fallback to mock data due to service error'
    });
  }
});

// Get improvement by ID
router.get('/:id', (req: Request, res: Response) => {
  const improvement = improvements.find(i => i.id === req.params.id);
  
  if (improvement) {
    res.json(improvement);
  } else {
    res.status(404).json({ error: 'Improvement not found' });
  }
});

// Update improvement status
router.patch('/:id/status', (req: Request, res: Response) => {
  const improvement = improvements.find(i => i.id === req.params.id);
  
  if (improvement) {
    improvement.status = req.body.status;
    res.json(improvement);
  } else {
    res.status(404).json({ error: 'Improvement not found' });
  }
});


export default router;