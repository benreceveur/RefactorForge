# RefactorForge Multi-Repository Architecture Design

## Executive Summary

This document outlines the comprehensive architecture for expanding RefactorForge from single-repository to multi-repository support, enabling analysis and recommendations across 9 IntelliPact repositories with 2,154+ patterns.

## Current State Analysis

**Existing System:**
- SQLite database with patterns, contacts, memory, refactor_history tables
- Express.js backend with REST API endpoints
- Mock pattern data across repositories
- Basic repository filtering capabilities

**Scale Requirements:**
- From 201 patterns → 2,154+ patterns
- Support 9 distinct repositories with different tech stacks
- Repository-specific recommendation templates
- Dynamic context-aware recommendations

## Architectural Design

### 1. Enhanced Database Schema

```sql
-- Repository Management Tables
CREATE TABLE repositories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL UNIQUE,
    organization TEXT NOT NULL,
    tech_stack TEXT NOT NULL, -- JSON array
    primary_language TEXT,
    framework TEXT,
    patterns_count INTEGER DEFAULT 0,
    last_analyzed DATETIME,
    repository_url TEXT,
    clone_path TEXT,
    analysis_status TEXT DEFAULT 'pending', -- pending, analyzing, completed, failed
    metadata TEXT, -- JSON for additional repo-specific data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Patterns Table
CREATE TABLE patterns (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL, -- For deduplication
    description TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    tags TEXT, -- JSON array
    file_path TEXT,
    line_start INTEGER,
    line_end INTEGER,
    language TEXT,
    framework TEXT,
    confidence_score REAL DEFAULT 0.5,
    usage_count INTEGER DEFAULT 0,
    last_seen DATETIME,
    context_before TEXT,
    context_after TEXT,
    ast_metadata TEXT, -- JSON for AST analysis data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Pattern Relationships (for similarity and recommendations)
CREATE TABLE pattern_relationships (
    id TEXT PRIMARY KEY,
    pattern_a_id TEXT NOT NULL,
    pattern_b_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL, -- similar, extends, replaces, conflicts
    similarity_score REAL NOT NULL,
    relationship_metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pattern_a_id) REFERENCES patterns(id) ON DELETE CASCADE,
    FOREIGN KEY (pattern_b_id) REFERENCES patterns(id) ON DELETE CASCADE
);

-- Repository-Specific Recommendations
CREATE TABLE repository_recommendations (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    recommendation_type TEXT NOT NULL, -- pattern_usage, architecture, performance, security
    priority TEXT DEFAULT 'medium', -- low, medium, high, critical
    applicable_patterns TEXT, -- JSON array of pattern IDs
    code_examples TEXT, -- JSON array of examples
    implementation_steps TEXT, -- JSON array
    estimated_effort TEXT,
    tags TEXT, -- JSON array
    status TEXT DEFAULT 'active', -- active, implemented, dismissed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Tech Stack Detection and Mapping
CREATE TABLE tech_stack_patterns (
    id TEXT PRIMARY KEY,
    tech_stack TEXT NOT NULL, -- typescript, react, node, azure, etc.
    pattern_indicators TEXT NOT NULL, -- JSON array of file patterns, imports, etc.
    confidence_weight REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Repository Analysis Jobs
CREATE TABLE analysis_jobs (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL,
    job_type TEXT NOT NULL, -- full_scan, incremental, pattern_extraction
    status TEXT DEFAULT 'queued', -- queued, running, completed, failed
    started_at DATETIME,
    completed_at DATETIME,
    progress REAL DEFAULT 0.0,
    results_summary TEXT, -- JSON
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Enhanced Indexes for Performance
CREATE INDEX idx_patterns_repository_category ON patterns(repository_id, category);
CREATE INDEX idx_patterns_language ON patterns(language);
CREATE INDEX idx_patterns_hash ON patterns(content_hash);
CREATE INDEX idx_patterns_usage_count ON patterns(usage_count DESC);
CREATE INDEX idx_repositories_tech_stack ON repositories(tech_stack);
CREATE INDEX idx_pattern_relationships_similarity ON pattern_relationships(similarity_score DESC);
CREATE INDEX idx_recommendations_repository_priority ON repository_recommendations(repository_id, priority);
```

### 2. Repository Detection & Analysis Engine

**Core Components:**

```typescript
// Repository Detector Service
interface TechStackDetectionResult {
    primaryLanguage: string;
    framework: string[];
    dependencies: string[];
    confidence: number;
    patterns: string[];
}

class RepositoryAnalyzer {
    async analyzeRepository(repoPath: string): Promise<TechStackDetectionResult> {
        const detectors = [
            new PackageJsonDetector(),
            new FilePatternDetector(),
            new ImportAnalysisDetector(),
            new ConfigFileDetector()
        ];
        
        const results = await Promise.all(
            detectors.map(d => d.analyze(repoPath))
        );
        
        return this.consolidateResults(results);
    }
    
    async extractPatterns(repoId: string, repoPath: string): Promise<Pattern[]> {
        const extractor = new PatternExtractor({
            language: await this.detectPrimaryLanguage(repoPath),
            framework: await this.detectFramework(repoPath)
        });
        
        return await extractor.extractFromRepository(repoId, repoPath);
    }
}
```

### 3. Enhanced API Layer

**New Endpoints:**

```typescript
// Repository Analysis API
POST   /api/repositories/:id/analyze     - Trigger repository analysis
GET    /api/repositories/:id/analysis    - Get analysis status
GET    /api/repositories/:id/patterns    - Get repository-specific patterns
GET    /api/repositories/:id/recommendations - Get tailored recommendations

// Multi-Repository Pattern Search
POST   /api/patterns/search/cross-repo   - Search across multiple repositories
GET    /api/patterns/trending            - Get trending patterns across repos
POST   /api/patterns/recommend           - Get pattern recommendations for code

// Repository Comparison
GET    /api/repositories/compare         - Compare patterns between repositories
GET    /api/repositories/:id/similar     - Find repositories with similar patterns

// Template Generation
POST   /api/templates/generate           - Generate code templates from patterns
GET    /api/templates/repository/:id     - Get repository-specific templates
```

### 4. Repository-Specific Recommendation Engine

**Architecture:**

```typescript
class RecommendationEngine {
    private generators: Map<string, RecommendationGenerator> = new Map([
        ['typescript', new TypeScriptRecommendationGenerator()],
        ['react', new ReactRecommendationGenerator()],
        ['node', new NodeJSRecommendationGenerator()],
        ['azure', new AzureRecommendationGenerator()],
        ['devops', new DevOpsRecommendationGenerator()]
    ]);
    
    async generateRecommendations(repositoryId: string): Promise<Recommendation[]> {
        const repository = await this.getRepository(repositoryId);
        const patterns = await this.getRepositoryPatterns(repositoryId);
        const techStack = repository.tech_stack;
        
        const recommendations: Recommendation[] = [];
        
        for (const tech of techStack) {
            const generator = this.generators.get(tech);
            if (generator) {
                const techRecommendations = await generator.generate({
                    repository,
                    patterns,
                    context: await this.getRepositoryContext(repositoryId)
                });
                recommendations.push(...techRecommendations);
            }
        }
        
        return this.prioritizeRecommendations(recommendations);
    }
}

// Repository-Specific Generators
class TypeScriptRecommendationGenerator implements RecommendationGenerator {
    async generate(context: RecommendationContext): Promise<Recommendation[]> {
        const recommendations: Recommendation[] = [];
        
        // Type safety recommendations
        await this.addTypeSafetyRecommendations(recommendations, context);
        
        // Performance recommendations
        await this.addPerformanceRecommendations(recommendations, context);
        
        // Best practices recommendations
        await this.addBestPracticeRecommendations(recommendations, context);
        
        return recommendations;
    }
}
```

### 5. Pattern Template System

**Dynamic Template Generation:**

```typescript
interface PatternTemplate {
    id: string;
    name: string;
    description: string;
    applicableLanguages: string[];
    applicableFrameworks: string[];
    template: string;
    variables: TemplateVariable[];
    examples: TemplateExample[];
    relatedPatterns: string[];
}

class TemplateEngine {
    async generateTemplate(
        repositoryId: string, 
        patternType: string
    ): Promise<PatternTemplate> {
        const repository = await this.getRepository(repositoryId);
        const relatedPatterns = await this.getPatternsByType(repositoryId, patternType);
        
        const template = await this.buildTemplate({
            repository,
            patterns: relatedPatterns,
            type: patternType
        });
        
        return template;
    }
    
    async renderTemplate(
        templateId: string, 
        variables: Record<string, any>
    ): Promise<string> {
        const template = await this.getTemplate(templateId);
        return this.templateRenderer.render(template.template, variables);
    }
}
```

## Implementation Strategy

### Phase 1: Foundation (Weeks 1-2)
1. **Database Schema Migration**
   - Implement new tables with proper indexing
   - Migrate existing pattern data to new schema
   - Add foreign key constraints

2. **Repository Detection Service**
   - Implement tech stack detection algorithms
   - Create file pattern analyzers
   - Build dependency analysis tools

### Phase 2: Pattern Extraction (Weeks 3-4)
1. **Enhanced Pattern Extractor**
   - Language-specific AST analyzers
   - Context-aware pattern recognition
   - Duplicate pattern detection

2. **Repository Analysis Pipeline**
   - Automated analysis job scheduling
   - Progress tracking and error handling
   - Incremental analysis for large repositories

### Phase 3: Recommendation Engine (Weeks 5-6)
1. **Repository-Specific Generators**
   - TypeScript/React/Node.js generators
   - Azure/DevOps specific recommendations
   - Healthcare/Enterprise patterns

2. **Template System**
   - Dynamic template generation
   - Variable substitution engine
   - Example code generation

### Phase 4: API Enhancement (Weeks 7-8)
1. **New API Endpoints**
   - Multi-repository search
   - Cross-repository comparisons
   - Template generation APIs

2. **Performance Optimization**
   - Query optimization
   - Caching layers
   - Response compression

## Scalability Considerations

### Database Performance
- **Partitioning**: Consider partitioning patterns table by repository_id
- **Indexing Strategy**: Composite indexes for common query patterns
- **Connection Pooling**: Implement connection pooling for concurrent requests

### Memory Management
- **Pattern Caching**: Cache frequently accessed patterns in Redis
- **Lazy Loading**: Load patterns on-demand rather than in memory
- **Background Processing**: Use job queues for heavy analysis tasks

### API Performance
- **Response Pagination**: Implement cursor-based pagination for large result sets
- **Partial Responses**: Allow clients to specify required fields
- **Compression**: Enable gzip compression for API responses

## Security Considerations

### Repository Access Control
- **Authentication**: JWT-based authentication for API access
- **Authorization**: Role-based access control per repository
- **Audit Logging**: Track all pattern access and modifications

### Data Protection
- **Input Validation**: Validate all incoming pattern and repository data
- **SQL Injection Prevention**: Use parameterized queries exclusively
- **Rate Limiting**: Implement rate limiting for analysis endpoints

## Monitoring & Observability

### Metrics to Track
- Pattern extraction success rates
- Repository analysis completion times
- Recommendation generation accuracy
- API response times and error rates

### Health Checks
- Database connectivity and performance
- Repository analysis job queue health
- Pattern extraction service status
- Recommendation engine responsiveness

## Repository-Specific Configurations

### Intellipact (892 patterns)
- **Focus**: Full-stack TypeScript patterns
- **Recommendations**: Authentication, API design, React hooks
- **Templates**: CRUD operations, middleware patterns

### IntelliPact-Observability (247 patterns)
- **Focus**: DevOps, monitoring, logging
- **Recommendations**: Prometheus metrics, log aggregation
- **Templates**: Health checks, alert configurations

### Normalization_Middleware (321 patterns)
- **Focus**: Azure middleware, data transformation
- **Recommendations**: Pipeline patterns, error handling
- **Templates**: Middleware functions, Azure integrations

### bMigrate (156 patterns)
- **Focus**: Legacy system migration
- **Recommendations**: Data migration patterns, compatibility layers
- **Templates**: Migration scripts, rollback procedures

### Tool-Box (127 patterns)
- **Focus**: Utility functions and helpers
- **Recommendations**: Reusable utilities, helper functions
- **Templates**: Common utility patterns, error handling

### Western-Dental (89 patterns)
- **Focus**: Healthcare-specific patterns
- **Recommendations**: HIPAA compliance, data security
- **Templates**: Patient data handling, audit trails

### azfunc (78 patterns)
- **Focus**: Azure Functions, serverless
- **Recommendations**: Function optimization, cold start reduction
- **Templates**: HTTP triggers, timer functions

### intellipact-landing-page (43 patterns)
- **Focus**: React frontend, performance optimization
- **Recommendations**: SEO optimization, lazy loading
- **Templates**: Component patterns, performance hooks

### RefactorForge (201 patterns)
- **Focus**: Code analysis, refactoring tools
- **Recommendations**: AST manipulation, code transformation
- **Templates**: Analyzer patterns, refactoring utilities

## Success Metrics

1. **Pattern Coverage**: Successfully extract 2,154+ patterns across 9 repositories
2. **Recommendation Quality**: Generate 5+ relevant recommendations per repository
3. **Performance**: Sub-200ms response time for pattern searches
4. **Accuracy**: 90%+ accuracy in tech stack detection
5. **Usability**: Generate usable code templates from extracted patterns

## Conclusion

This multi-repository architecture transforms RefactorForge into a comprehensive code intelligence platform capable of analyzing, understanding, and providing recommendations across diverse technology stacks and domains. The modular design ensures scalability while maintaining the simplicity and effectiveness of the current system.