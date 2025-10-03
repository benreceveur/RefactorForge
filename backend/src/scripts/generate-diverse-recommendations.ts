#!/usr/bin/env node

/**
 * Script to generate diverse recommendations for all repositories
 * This ensures we have recommendations across all categories:
 * - performance
 * - security
 * - testing
 * - architecture
 * - maintainability
 */

import { RecommendationEngine } from '../services/recommendation-engine';
import { RepositoryAnalyzer } from '../services/repository-analyzer';
import { dbRun } from '../utils/database-helpers';
import { v4 as uuidv4 } from 'uuid';

interface DiverseRecommendation {
  repositoryId: string;
  repositoryName: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  estimatedEffort: string;
  beforeCode: string;
  afterCode: string;
  tags: string[];
}

// Repository-specific recommendation templates
const getRecommendationsForRepository = (repo: any): DiverseRecommendation[] => {
  const recommendations: DiverseRecommendation[] = [];
  const repoId = repo.id;
  const repoName = repo.fullName;

  // Performance recommendations
  if (repo.techStack?.includes('react') || repo.framework?.includes('React')) {
    recommendations.push({
      repositoryId: repoId,
      repositoryName: repoName,
      title: 'Optimize React Component Re-renders with useMemo',
      description: 'Reduce unnecessary re-renders by memoizing expensive computations in React components',
      category: 'performance',
      priority: 'high',
      estimatedEffort: '2-3 hours',
      beforeCode: `const ExpensiveComponent = ({ data }) => {
  const processedData = data.map(item =>
    expensiveOperation(item)
  );

  return <div>{processedData}</div>;
};`,
      afterCode: `const ExpensiveComponent = ({ data }) => {
  const processedData = useMemo(() =>
    data.map(item => expensiveOperation(item)),
    [data]
  );

  return <div>{processedData}</div>;
};`,
      tags: ['react', 'performance', 'optimization', 'memoization']
    });
  }

  // Backend performance
  if (repo.techStack?.includes('backend') || repo.techStack?.includes('api')) {
    recommendations.push({
      repositoryId: repoId,
      repositoryName: repoName,
      title: 'Implement Database Query Optimization with Indexing',
      description: 'Add database indexes to frequently queried columns for faster data retrieval',
      category: 'performance',
      priority: 'high',
      estimatedEffort: '3-4 hours',
      beforeCode: `// Unoptimized query
db.all('SELECT * FROM users WHERE email = ? AND status = ?', [email, status]);`,
      afterCode: `// Add indexes
db.run('CREATE INDEX idx_users_email ON users(email)');
db.run('CREATE INDEX idx_users_status ON users(status)');
db.run('CREATE INDEX idx_users_email_status ON users(email, status)');

// Optimized query with indexes
db.all('SELECT * FROM users WHERE email = ? AND status = ?', [email, status]);`,
      tags: ['database', 'performance', 'sql', 'indexing']
    });
  }

  // Security recommendations
  if (repo.techStack?.includes('azure') || repo.techStack?.includes('cloud')) {
    recommendations.push({
      repositoryId: repoId,
      repositoryName: repoName,
      title: 'Implement Azure Key Vault for Secrets Management',
      description: 'Replace hardcoded credentials with Azure Key Vault integration for enhanced security',
      category: 'security',
      priority: 'critical',
      estimatedEffort: '4-6 hours',
      beforeCode: `const connectionString = 'Server=myserver.database.windows.net;Database=mydb;User=admin;Password=secret123';`,
      afterCode: `import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
const client = new SecretClient(vaultUrl, credential);

const connectionString = await client.getSecret('db-connection-string');`,
      tags: ['azure', 'security', 'secrets', 'key-vault']
    });
  }

  // General security
  recommendations.push({
    repositoryId: repoId,
    repositoryName: repoName,
    title: 'Add Input Validation and Sanitization',
    description: 'Implement comprehensive input validation to prevent injection attacks',
    category: 'security',
    priority: 'high',
    estimatedEffort: '3-5 hours',
    beforeCode: `app.post('/api/user', (req, res) => {
  const { name, email } = req.body;
  db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
});`,
    afterCode: `import { body, validationResult } from 'express-validator';

app.post('/api/user',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).escape(),
    body('email').isEmail().normalizeEmail()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email } = req.body;
    db.run('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
  }
);`,
    tags: ['security', 'validation', 'sanitization', 'express']
  });

  // Testing recommendations
  if (repo.techStack?.includes('react')) {
    recommendations.push({
      repositoryId: repoId,
      repositoryName: repoName,
      title: 'Add Unit Tests for Critical Components',
      description: 'Implement comprehensive unit tests for core React components',
      category: 'testing',
      priority: 'medium',
      estimatedEffort: '4-6 hours',
      beforeCode: `// No tests for UserProfile component`,
      afterCode: `import { render, screen, fireEvent } from '@testing-library/react';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  it('renders user information correctly', () => {
    const user = { name: 'John Doe', email: 'john@example.com' };
    render(<UserProfile user={user} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('handles edit mode toggle', () => {
    render(<UserProfile user={mockUser} />);
    const editButton = screen.getByRole('button', { name: /edit/i });

    fireEvent.click(editButton);
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
  });
});`,
      tags: ['testing', 'react', 'unit-tests', 'jest']
    });
  }

  // Backend testing
  recommendations.push({
    repositoryId: repoId,
    repositoryName: repoName,
    title: 'Add Integration Tests for API Endpoints',
    description: 'Implement integration tests for critical API endpoints',
    category: 'testing',
    priority: 'high',
    estimatedEffort: '3-5 hours',
    beforeCode: `// No tests for API endpoints`,
    afterCode: `import request from 'supertest';
import { app } from '../app';

describe('POST /api/users', () => {
  it('creates a new user successfully', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'Test User', email: 'test@example.com' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Test User');
  });

  it('validates email format', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'Test', email: 'invalid-email' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });
});`,
    tags: ['testing', 'integration', 'api', 'supertest']
  });

  // Architecture recommendations
  if (repo.techStack?.includes('fullstack') || repo.techStack?.includes('migration')) {
    recommendations.push({
      repositoryId: repoId,
      repositoryName: repoName,
      title: 'Implement Repository Pattern for Data Access',
      description: 'Separate data access logic into repository classes for better maintainability',
      category: 'architecture',
      priority: 'medium',
      estimatedEffort: '6-8 hours',
      beforeCode: `// Direct database access in routes
app.get('/users/:id', async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  res.json(user);
});`,
      afterCode: `// Repository pattern
class UserRepository {
  async findById(id: string) {
    return db.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  async create(userData: CreateUserDto) {
    return db.run('INSERT INTO users...', userData);
  }
}

// Clean route handler
const userRepo = new UserRepository();

app.get('/users/:id', async (req, res) => {
  const user = await userRepo.findById(req.params.id);
  res.json(user);
});`,
      tags: ['architecture', 'repository-pattern', 'clean-code']
    });
  }

  // Maintainability recommendations
  recommendations.push({
    repositoryId: repoId,
    repositoryName: repoName,
    title: 'Extract Magic Numbers and Strings into Constants',
    description: 'Replace magic values with named constants for better maintainability',
    category: 'maintainability',
    priority: 'low',
    estimatedEffort: '1-2 hours',
    beforeCode: `if (user.role === 'admin' || user.level > 5) {
  setTimeout(() => refreshToken(), 3600000);
}`,
    afterCode: `const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user'
} as const;

const AUTH_CONFIG = {
  MIN_ADMIN_LEVEL: 5,
  TOKEN_REFRESH_INTERVAL_MS: 60 * 60 * 1000 // 1 hour
} as const;

if (user.role === USER_ROLES.ADMIN || user.level > AUTH_CONFIG.MIN_ADMIN_LEVEL) {
  setTimeout(() => refreshToken(), AUTH_CONFIG.TOKEN_REFRESH_INTERVAL_MS);
}`,
    tags: ['maintainability', 'clean-code', 'constants', 'readability']
  });

  // DevOps-specific recommendations
  if (repo.techStack?.includes('devops')) {
    recommendations.push({
      repositoryId: repoId,
      repositoryName: repoName,
      title: 'Add Structured Logging with Correlation IDs',
      description: 'Implement structured logging with request correlation for better debugging',
      category: 'architecture',
      priority: 'high',
      estimatedEffort: '3-4 hours',
      beforeCode: `console.log('User logged in:', userId);
console.error('Failed to process payment');`,
      afterCode: `import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

app.use((req, res, next) => {
  req.correlationId = uuidv4();
  next();
});

logger.info('User logged in', {
  userId,
  correlationId: req.correlationId,
  timestamp: new Date().toISOString()
});`,
      tags: ['logging', 'devops', 'observability', 'debugging']
    });
  }

  return recommendations;
};

async function generateDiverseRecommendations() {
  try {
    console.log('🚀 Starting diverse recommendation generation...');

    const analyzer = new RepositoryAnalyzer();
    const repositories = await analyzer.getAllRepositories();

    if (repositories.length === 0) {
      console.log('❌ No repositories found. Please initialize repositories first.');
      return;
    }

    console.log(`📊 Found ${repositories.length} repositories`);

    let totalGenerated = 0;
    const categoryCount: Record<string, number> = {
      performance: 0,
      security: 0,
      testing: 0,
      architecture: 0,
      maintainability: 0
    };

    for (const repo of repositories) {
      console.log(`\n🔄 Processing ${repo.fullName}...`);

      const recommendations = getRecommendationsForRepository(repo);

      for (const rec of recommendations) {
        try {
          // Map categories to recommendation types
          const recommendationType = rec.category === 'maintainability' ? 'best_practices' :
                                    rec.category === 'testing' ? 'best_practices' :
                                    rec.category;

          // Check if recommendation already exists
          const existing = await dbRun(`
            SELECT id FROM repository_recommendations
            WHERE repository_id = ? AND title = ?
          `, [rec.repositoryId, rec.title]);

          if (!existing || (existing as any).changes === 0) {
            await dbRun(`
              INSERT INTO repository_recommendations (
                id, repository_id, title, description, category,
                priority, impact, time_estimate, before_code, after_code,
                tags, status, difficulty, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              uuidv4(),
              rec.repositoryId,
              rec.title,
              rec.description,
              recommendationType,
              rec.priority,
              `${rec.priority.charAt(0).toUpperCase()}${rec.priority.slice(1)} impact`,
              rec.estimatedEffort,
              rec.beforeCode,
              rec.afterCode,
              JSON.stringify(rec.tags),
              'active',
              rec.priority === 'critical' ? 'hard' : rec.priority === 'high' ? 'medium' : 'easy',
              new Date().toISOString(),
              new Date().toISOString()
            ]);

            const category = rec.category as keyof typeof categoryCount;
            if (category in categoryCount) {
              categoryCount[category] = (categoryCount[category] || 0) + 1;
            }
            totalGenerated++;
            console.log(`  ✅ Generated: ${rec.title} (${rec.category})`);
          } else {
            console.log(`  ⏭️  Skipped (exists): ${rec.title}`);
          }
        } catch (error) {
          console.error(`  ❌ Failed to save recommendation: ${rec.title}`, error);
        }
      }
    }

    console.log('\n📈 Generation Summary:');
    console.log(`Total recommendations generated: ${totalGenerated}`);
    console.log('\nBy category:');
    Object.entries(categoryCount).forEach(([category, count]) => {
      console.log(`  - ${category}: ${count}`);
    });

    console.log('\n✅ Diverse recommendation generation complete!');

  } catch (error) {
    console.error('❌ Error generating recommendations:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  generateDiverseRecommendations()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { generateDiverseRecommendations };