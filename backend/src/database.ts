import sqlite3 from 'sqlite3';
import path from 'path';
import { initOptimizedDb } from './performance/optimized-database-helpers';
import { optimizeDatabase } from './migrations/index-optimizer';
import { logger } from './utils/logger';

const dbPath = path.join(__dirname, '..', 'refactorforge.db');
const db = new sqlite3.Database(dbPath);

// Initialize optimized database helpers and performance indexes
initOptimizedDb(dbPath).then(async () => {
  logger.info('Optimized database helpers initialized', { dbPath });

  // Auto-optimize database with critical and high priority indexes
  if (process.env.AUTO_OPTIMIZE_DB !== 'false') {
    try {
      logger.info('Starting automatic database optimization...');
      const report = await optimizeDatabase(['critical', 'high']);

      if (report.newIndexes > 0) {
        logger.info('Database optimization completed', {
          newIndexes: report.newIndexes,
          skippedIndexes: report.skippedIndexes,
          executionTime: report.totalExecutionTime
        });
      } else {
        logger.debug('Database optimization skipped - all indexes already exist');
      }
    } catch (error) {
      logger.warn('Database optimization failed - continuing with existing indexes', {
        error: String(error)
      });
    }
  }
}).catch((error) => {
  logger.error('Failed to initialize optimized database helpers', { error: String(error) });
});

export function initDatabase() {
  db.serialize(() => {
    // Existing legacy tables (preserved for compatibility)
    db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        context TEXT,
        last_interaction TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS refactor_history (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        original_code TEXT NOT NULL,
        refactored_code TEXT NOT NULL,
        improvements TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Multi-Repository System Tables
    
    // Repositories table - manages all IntelliPact repositories
    db.run(`
      CREATE TABLE IF NOT EXISTS repositories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL UNIQUE,
        organization TEXT NOT NULL DEFAULT 'IntelliPact',
        description TEXT,
        tech_stack TEXT NOT NULL,
        primary_language TEXT,
        framework TEXT,
        patterns_count INTEGER DEFAULT 0,
        last_analyzed TEXT,
        repository_url TEXT,
        analysis_status TEXT DEFAULT 'pending',
        categories TEXT,
        branches TEXT,
        webhooks_enabled INTEGER DEFAULT 1,
        auto_save_enabled INTEGER DEFAULT 1,
        min_stars INTEGER DEFAULT 1,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Patterns table - stores code patterns found in repositories
    db.run(`
      CREATE TABLE IF NOT EXISTS repository_patterns (
        id TEXT PRIMARY KEY,
        repository_id TEXT NOT NULL,
        pattern_type TEXT NOT NULL,
        pattern_content TEXT NOT NULL,
        pattern_hash TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        subcategory TEXT,
        tags TEXT,
        file_path TEXT,
        line_start INTEGER,
        line_end INTEGER,
        language TEXT,
        framework TEXT,
        confidence_score REAL DEFAULT 0.5,
        usage_count INTEGER DEFAULT 0,
        context_before TEXT,
        context_after TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
      )
    `);

    // Repository-specific recommendations table
    db.run(`
      CREATE TABLE IF NOT EXISTS repository_recommendations (
        id TEXT PRIMARY KEY,
        repository_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        impact TEXT,
        time_estimate TEXT,
        time_saved TEXT,
        bugs_prevented TEXT,
        performance_gain TEXT,
        before_code TEXT,
        after_code TEXT,
        implementation_steps TEXT,
        tags TEXT,
        status TEXT DEFAULT 'pending',
        difficulty TEXT DEFAULT 'medium',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
      )
    `);

    // Pattern relationships for similarity detection
    db.run(`
      CREATE TABLE IF NOT EXISTS pattern_relationships (
        id TEXT PRIMARY KEY,
        pattern_a_id TEXT NOT NULL,
        pattern_b_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        similarity_score REAL NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pattern_a_id) REFERENCES repository_patterns(id) ON DELETE CASCADE,
        FOREIGN KEY (pattern_b_id) REFERENCES repository_patterns(id) ON DELETE CASCADE
      )
    `);

    // Tech stack detection patterns
    db.run(`
      CREATE TABLE IF NOT EXISTS tech_stack_patterns (
        id TEXT PRIMARY KEY,
        tech_stack TEXT NOT NULL,
        pattern_indicators TEXT NOT NULL,
        confidence_weight REAL DEFAULT 1.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Analysis jobs for background processing
    db.run(`
      CREATE TABLE IF NOT EXISTS analysis_jobs (
        id TEXT PRIMARY KEY,
        repository_id TEXT NOT NULL,
        job_type TEXT NOT NULL,
        status TEXT DEFAULT 'queued',
        started_at TEXT,
        completed_at TEXT,
        progress REAL DEFAULT 0.0,
        results_summary TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
      )
    `);

    // Client error reports table for frontend error tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS client_error_reports (
        id TEXT PRIMARY KEY,
        error_id TEXT NOT NULL UNIQUE,
        message TEXT NOT NULL,
        stack TEXT,
        name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        user_agent TEXT,
        url TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        level TEXT NOT NULL DEFAULT 'component',
        component TEXT,
        context TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Search history table for analytics
    db.run(`
      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        filters TEXT,
        results_count INTEGER DEFAULT 0,
        response_time INTEGER,
        user_id TEXT,
        session_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Timeline events table for persistent activity tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        repository TEXT,
        user_id TEXT,
        metadata TEXT,
        icon TEXT,
        color TEXT,
        impact TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create performance indexes
    
    // Legacy table indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)');
    db.run('CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name)');
    db.run('CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_memory_created_at ON memory(created_at DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_refactor_file_path ON refactor_history(file_path)');
    db.run('CREATE INDEX IF NOT EXISTS idx_refactor_created_at ON refactor_history(created_at DESC)');

    // Multi-repository indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_repositories_org ON repositories(organization)');
    db.run('CREATE INDEX IF NOT EXISTS idx_repositories_tech_stack ON repositories(tech_stack)');
    db.run('CREATE INDEX IF NOT EXISTS idx_repositories_status ON repositories(analysis_status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name)');
    
    db.run('CREATE INDEX IF NOT EXISTS idx_patterns_repository ON repository_patterns(repository_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_patterns_category ON repository_patterns(category)');
    db.run('CREATE INDEX IF NOT EXISTS idx_patterns_type ON repository_patterns(pattern_type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_patterns_hash ON repository_patterns(pattern_hash)');
    db.run('CREATE INDEX IF NOT EXISTS idx_patterns_language ON repository_patterns(language)');
    db.run('CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON repository_patterns(confidence_score DESC)');
    
    db.run('CREATE INDEX IF NOT EXISTS idx_recommendations_repository ON repository_recommendations(repository_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_recommendations_category ON repository_recommendations(category)');
    db.run('CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON repository_recommendations(priority)');
    db.run('CREATE INDEX IF NOT EXISTS idx_recommendations_status ON repository_recommendations(status)');
    
    db.run('CREATE INDEX IF NOT EXISTS idx_relationships_similarity ON pattern_relationships(similarity_score DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_relationships_type ON pattern_relationships(relationship_type)');
    
    db.run('CREATE INDEX IF NOT EXISTS idx_tech_patterns_stack ON tech_stack_patterns(tech_stack)');
    
    db.run('CREATE INDEX IF NOT EXISTS idx_jobs_repository_status ON analysis_jobs(repository_id, status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_jobs_type ON analysis_jobs(job_type)');

    // Client error reports indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_error_reports_error_id ON client_error_reports(error_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_error_reports_created_at ON client_error_reports(created_at DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_error_reports_level ON client_error_reports(level)');
    db.run('CREATE INDEX IF NOT EXISTS idx_error_reports_component ON client_error_reports(component)');
    db.run('CREATE INDEX IF NOT EXISTS idx_error_reports_user_id ON client_error_reports(user_id)');

    // Search history indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query)');
    db.run('CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id)');

    // Timeline events indexes  
    db.run('CREATE INDEX IF NOT EXISTS idx_timeline_events_created_at ON timeline_events(created_at DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_timeline_events_type ON timeline_events(type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_timeline_events_category ON timeline_events(category)');
    db.run('CREATE INDEX IF NOT EXISTS idx_timeline_events_repository ON timeline_events(repository)');

    console.log('✅ Multi-repository database initialized with enhanced schema, error reporting, and performance indexes');
  });
}

export function getDatabase() {
  return db;
}

export default db;