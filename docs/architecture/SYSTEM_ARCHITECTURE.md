# RefactorForge System Architecture & Documentation

## 🚀 Overview

RefactorForge is an advanced code intelligence platform that provides comprehensive repository analysis, pattern extraction, and automated refactoring recommendations. The system features real-time GitHub scanning, performance monitoring, and intelligent code improvement suggestions with enterprise-grade reliability and security.

### Key Capabilities
- **Multi-Repository Analysis**: Simultaneous scanning and analysis of multiple GitHub repositories
- **Advanced Pattern Recognition**: ML-powered extraction of code patterns, anti-patterns, and best practices
- **Security Analysis**: Automated detection of vulnerabilities, misconfigurations, and compliance issues
- **Performance Optimization**: Identification of bottlenecks with optimization recommendations
- **Type Safety Analysis**: Comprehensive TypeScript/JavaScript type safety validation
- **Real-Time Monitoring**: Live GitHub webhook integration with performance tracking
- **Enterprise Security**: Comprehensive secrets management and authentication systems

## 🏗️ System Architecture

### Services & Ports

| Service | Port | Description | Status | Performance Features |
|---------|------|-------------|---------|----------------------|
| **RefactorForge Backend** | 8001 | Express/TypeScript API server | ✅ Running | Connection pooling, caching, streaming |
| **RefactorForge Frontend** | 8745 | React/TypeScript application with advanced features | ✅ Running | Code splitting, lazy loading, memoization, real-time updates |
| **Memory API Server** | 3721 | Semantic pattern engine & AI analysis | ✅ Running | Embeddings caching, async processing |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│           RefactorForge Frontend (Port 8745)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Dashboard  │  │  Repository  │  │ Performance  │     │
│  │   Component  │  │   Analysis   │  │  Monitoring  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Pattern    │  │   Security   │  │  Webhook     │     │
│  │   Explorer   │  │   Scanner    │  │ Management   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           RefactorForge Backend API (Port 8001)             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐  │
│  │  GitHub Scanner │ │ Performance     │ │ Secrets      │  │
│  │  • Rate Limit   │ │ Monitor         │ │ Manager      │  │
│  │  • Caching      │ │ • Real-time     │ │ • AWS/Azure  │  │
│  │  • Streaming    │ │ • Alerting      │ │ • GCP        │  │
│  └─────────────────┘ └─────────────────┘ └──────────────┘  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐  │
│  │ Repository      │ │ Pattern         │ │ Webhook      │  │
│  │ Analyzer        │ │ Extraction      │ │ Processor    │  │
│  │ • Tech Stack    │ │ • Security      │ │ • GitHub     │  │
│  │ • Dependencies  │ │ • Performance   │ │ • Real-time  │  │
│  └─────────────────┘ └─────────────────┘ └──────────────┘  │
│                    SQLite Database with Optimizations       │
│              • Connection Pooling • Query Caching           │
│              • Indexed Queries • Prepared Statements        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Memory & AI Analysis System (Port 3721)           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐  │
│  │  Semantic       │ │  Pattern        │ │ Improvement  │  │
│  │  Search Engine  │ │  Enrichment     │ │ Generator    │  │
│  │  • Embeddings   │ │  • Quality      │ │ • AI-powered │  │
│  │  • Vector DB    │ │  • Metrics      │ │ • Context    │  │
│  └─────────────────┘ └─────────────────┘ └──────────────┘  │
│            OpenAI GPT-4 + Embeddings Integration            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         External Integrations & Services                    │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐  │
│  │  GitHub API     │ │  Cloud Secrets  │ │ Monitoring   │  │
│  │  • REST/GraphQL │ │  • AWS KMS      │ │ • Prometheus │  │
│  │  • Webhooks     │ │  • Azure KV     │ │ • Grafana    │  │
│  │  • Rate Limits  │ │  • GCP Secret   │ │ • DataDog    │  │
│  └─────────────────┘ └─────────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 📡 API Endpoints

### RefactorForge Backend (Port 8001) - Enhanced with Performance Optimizations

| Endpoint | Method | Description | Performance Features |
|----------|--------|-------------|---------------------|
| `/` | GET | Service information and feature discovery | Static response, CDN-ready |
| `/api/health` | GET | Comprehensive health check with metrics | 5s caching, optimized queries |
| `/api/repositories` | GET/POST | Repository management and analysis | Pagination, filtering, indexing |
| `/api/repositories/:id/scan` | POST | Initiate comprehensive repository scan | Async processing, progress tracking |
| `/api/repositories/:id/patterns` | GET | Get extracted patterns for repository | Query optimization, result caching |
| `/api/patterns` | GET | Search patterns across all repositories | Full-text search, aggregations |
| `/api/analysis/jobs` | GET/POST | Analysis job management | Background processing, status tracking |
| `/api/github/integrations` | GET/POST | GitHub repository integrations | Rate limit management, webhook support |
| `/api/github/integrations/:id/sync` | POST | Manual integration synchronization | Optimized GitHub API usage |
| `/api/webhooks/github` | POST | GitHub webhook event processing | Async processing, signature validation |
| `/api/performance/metrics` | GET | Performance monitoring data | Time-series data, configurable windows |
| `/api/performance/alerts` | GET/POST | Performance alert management | Real-time alerting, resolution tracking |

### Memory API Server (Port 3721)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/improvements` | GET | Get code improvement suggestions |
| `/api/patterns` | GET | Get all patterns |
| `/api/patterns/search` | POST | Search patterns semantically |
| `/api/patterns/similar` | POST | Find similar patterns |
| `/api/patterns` | POST | Save new pattern |
| `/api/patterns/enriched` | GET | Get enriched patterns |
| `/api/patterns/metrics` | GET | Get pattern metrics |
| `/api/patterns/insights` | GET | Get pattern insights |
| `/api/analytics` | GET | Get memory analytics |
| `/api/repositories` | GET | Get repository information |
| `/api/timeline` | GET | Get activity timeline |

## 🎯 Key Features

### 1. Code Refactoring Analysis
- **AI-powered code analysis** using GPT models
- **Pattern detection** for common code issues
- **Improvement suggestions** with impact metrics
- **Before/after code comparisons**

### 2. Contact Management
- Store and manage developer contacts
- Track interaction history
- Context preservation for continuity

### 3. Memory System Integration
- **Semantic search** across code patterns
- **Pattern enrichment** with quality metrics
- **Repository-aware** pattern detection
- **Embeddings-based** similarity matching
- **Historical pattern tracking**

### 4. Improvement Tracking
- **Impact categorization** (Critical, High, Medium)
- **Time estimates** for implementation
- **Bug prevention metrics**
- **Performance gain predictions**
- **Team assignment** recommendations

## 🔧 Technology Stack

### Frontend (Enhanced)
- **React 18** with TypeScript and Concurrent Features
- **Material-UI v5** with emotion-based styling
- **React Query** for server state management and caching
- **React Router v6** with lazy loading
- **Webpack 5** with module federation
- **TypeScript 5.0** with strict mode

### Backend (Performance-Optimized)
- **Node.js 18+** with ES2022 features
- **Express.js** with helmet security middleware
- **TypeScript 5.0** with advanced type safety
- **SQLite3** with WAL mode and optimized settings
- **Better-SQLite3** for synchronous operations
- **LRU-Cache** for application-level caching
- **P-Limit** for concurrency control

### Security & Secrets Management
- **AWS Secrets Manager** integration
- **Azure Key Vault** support
- **Google Cloud Secret Manager** compatibility
- **Hashicorp Vault** integration (planned)
- **Environment-based configuration** with validation
- **JWT token management** with refresh logic

### GitHub Integration
- **Octokit REST API v6** with retry logic
- **GitHub App** authentication support
- **Webhook signature validation** with HMAC
- **GraphQL API** for advanced queries (planned)
- **Fine-grained personal access tokens** support

### Performance Monitoring
- **Native Node.js Performance Hooks**
- **Event Loop Delay Monitoring**
- **Garbage Collection Tracking**
- **Memory Usage Profiling**
- **Custom Metrics Collection**
- **Prometheus-compatible exports** (planned)

### Memory & AI System
- **OpenAI GPT-4** for code analysis
- **OpenAI Embeddings (text-embedding-3-large)** for similarity
- **Vector Database** with FAISS integration (planned)
- **Semantic Pattern Engine** with caching
- **Async Pattern Processing** with queue management
- **Context-aware AI Analysis** with repository understanding

### Development & DevOps
- **ESLint** with TypeScript rules
- **Prettier** for code formatting
- **Jest** for unit testing
- **Supertest** for API testing
- **Docker** containerization
- **GitHub Actions** for CI/CD
- **Dependabot** for security updates

## 📊 Data Models

### Contact
```typescript
interface Contact {
  id: string;
  name: string;
  email: string;
  lastInteraction: string;
  context: string;
}
```

### Improvement
```typescript
interface Improvement {
  id: string;
  title: string;
  description: string;
  category: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  repository: string;
  platform: string;
  team: string;
  metrics: {
    timeToImplement: string;
    timeSaved: string;
    bugsPrevented: string;
    performanceGain: string;
  };
  tags: string[];
  status: string;
  difficulty: 'easy' | 'medium' | 'hard';
}
```

### Pattern
```typescript
interface Pattern {
  id: string;
  description: string;
  category: string;
  context: {
    repository?: string;
    file?: string;
    language?: string;
  };
  enrichment?: {
    quality: {
      overall: number;
    };
    insights: Array<{
      message: string;
    }>;
    relationships: Array<{
      patternId: string;
      type: string;
      similarity: number;
    }>;
  };
  timestamp: string;
}
```

## 🚦 Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn
- Port availability: 8745, 8001, 3721

### Starting All Services

```bash
# 1. Start RefactorForge Backend (Port 8001)
cd /Users/benreceveur/GitHub/RefactorForge/backend
npm run dev

# 2. Start RefactorForge Frontend (Port 8745)
cd /Users/benreceveur/GitHub/RefactorForge/frontend
npm run dev

# 3. Start Memory API Server (Port 3721)
cd /Users/benreceveur/.claude/memory/integrations/api-server
node server.js

# 4. Start Memory Dashboard (Port 8745)
cd /Users/benreceveur/GitHub/RefactorForge/frontend
npm start
```

### Accessing the Application

- **Main Application**: http://localhost:8745
- **Memory Dashboard**: http://localhost:8745
- **Backend API**: http://localhost:8001/api/health
- **Memory API**: http://localhost:3721/health

## 🔍 Features Deep Dive

### Refactoring Session
1. Click "Start Refactoring Session"
2. Input code for analysis
3. View categorized improvements
4. See implementation time estimates
5. Review bug prevention metrics
6. Check performance gain predictions

### Contact Management
1. Click "Add New Contact"
2. Fill in contact details
3. Track interaction history
4. Maintain context for future reference

### Memory Bank
1. Click "View Memory Bank"
2. Browse stored patterns
3. Search semantic patterns
4. View pattern statistics
5. Access full dashboard for advanced features

## 🛡️ Security Considerations

- CORS configured for cross-origin requests
- Input validation on all endpoints
- SQL injection prevention via parameterized queries
- No hardcoded credentials
- Environment variables for sensitive configuration

## 📈 Performance Optimizations

### Backend Performance Enhancements

#### GitHub Scanner Optimizations
- **Dynamic Batch Sizing**: Adjusts file processing batches based on current GitHub API rate limits (3-10 files per batch)
- **Exponential Backoff Retry**: Handles rate limit errors with intelligent retry logic (1s, 2s, 4s delays)
- **Connection Pooling**: Reuses HTTP connections for GitHub API calls
- **Streaming File Processing**: Handles large files (>1MB) with streaming to prevent memory overflow
- **Intelligent Caching**: 5-minute TTL cache for repository trees and file contents
- **Concurrent Processing**: Up to 8 concurrent API requests for authenticated users, 4 for public access

#### Database Optimizations
- **Connection Pool Management**: Persistent connection pooling with automatic cleanup
- **Query Result Caching**: 30-60 second TTL for frequently accessed data
- **Prepared Statements**: All database queries use prepared statements for performance and security
- **Index Optimization**: Strategic indexing on pattern searches, repository lookups, and time-based queries
- **Batch Operations**: Bulk inserts for pattern data to reduce database round-trips

#### Performance Monitoring System
- **Real-Time Metrics**: Comprehensive tracking of response times, memory usage, CPU utilization
- **Configurable Thresholds**: Environment-specific alerting (dev vs. production thresholds)
- **Event Loop Monitoring**: Tracks Node.js event loop delay to prevent blocking
- **Garbage Collection Tracking**: Monitors GC events to optimize memory management
- **Request Correlation**: Tracks performance across entire request lifecycle

#### Memory Management
- **Automatic Data Cleanup**: Removes old performance data (24-hour retention) and resolved alerts (1-hour retention)
- **Memory Threshold Monitoring**: Configurable memory usage alerts (80% warning, 90% critical)
- **Efficient Data Structures**: Uses appropriate data structures for different use cases
- **Background Processing**: CPU-intensive tasks moved to background workers

### Frontend Performance Enhancements
- **Code Splitting**: Dynamic imports for feature-specific components
- **React Memoization**: Memoized components for expensive rendering operations
- **Virtualized Lists**: Efficient rendering of large pattern lists and repository data
- **Lazy Loading**: On-demand loading of heavy components and data
- **Asset Optimization**: Minified bundles with tree shaking
- **CDN Integration**: Static assets served from CDN for global performance

### Memory System Performance
- **Cached Embeddings**: Vector embeddings cached for faster similarity matching
- **Async Pattern Loading**: Non-blocking pattern enrichment and analysis
- **Semantic Search Optimization**: Optimized vector similarity calculations
- **Background AI Processing**: LLM calls moved to background queues

### Network Optimizations
- **HTTP/2 Support**: Multiplexed connections for improved performance
- **Gzip Compression**: Response compression for reduced bandwidth
- **Request Batching**: Multiple operations combined into single API calls
- **Intelligent Polling**: Dynamic polling intervals based on activity

### Monitoring and Alerting
- **Performance Baselines**: Automatic establishment of performance baselines
- **Predictive Alerting**: Machine learning-based anomaly detection
- **Multi-tier Alerting**: Different alert severities with escalation paths
- **Performance Dashboards**: Real-time visualization of system metrics

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Check for existing processes: `lsof -i :PORT`
   - Kill process: `kill -9 PID`

2. **Memory API Not Responding**
   - Verify server is running: `curl http://localhost:3721/health`
   - Check logs for errors
   - Ensure OpenAI API key is configured

3. **Frontend Compilation Errors**
   - Clear cache: `rm -rf node_modules/.cache`
   - Reinstall dependencies: `npm install`

## 📚 Memory System Integration

The memory system provides advanced AI-powered code analysis:

- **Semantic Search**: Find patterns using natural language
- **Pattern Enrichment**: Automatic quality scoring and insights
- **Repository Detection**: Context-aware pattern matching
- **Embeddings**: Vector-based similarity matching
- **Analytics**: Usage statistics and trends

## 🔄 Data Flow

1. User initiates action in Frontend (8745)
2. Frontend calls RefactorForge Backend (8001)
3. Backend processes request, may call Memory API (3721)
4. Memory API performs AI analysis using OpenAI
5. Results flow back through the chain
6. Frontend displays enriched results

## 🎯 Current & Future Enhancements

### ✅ Recently Implemented (v2.1.0)
- [x] **Advanced GitHub Scanner** with rate limit optimization
- [x] **Performance Monitoring System** with real-time alerting
- [x] **Comprehensive Security Analysis** with vulnerability detection
- [x] **Type Safety Analysis** for TypeScript/JavaScript
- [x] **Multi-provider Secrets Management** (AWS, Azure, GCP)
- [x] **Webhook Integration** for real-time GitHub events
- [x] **Optimized Database Layer** with connection pooling and caching
- [x] **Enterprise-grade Error Handling** with detailed logging
- [x] **JSDoc Documentation** for all major components
- [x] **OpenAPI Specification** with comprehensive examples

### 🚀 In Progress (v2.2.0)
- [ ] **GraphQL API** for flexible data querying
- [ ] **WebSocket Support** for real-time dashboard updates
- [ ] **Advanced Analytics Dashboard** with trend analysis
- [ ] **Batch Processing Engine** for large-scale repository analysis
- [ ] **CI/CD Pipeline Integration** (GitHub Actions, Jenkins, Azure DevOps)
- [ ] **Team Collaboration Features** with role-based access
- [ ] **Export Functionality** (PDF, Excel, JSON reports)

### 📋 Planned (v2.3.0+)
- [ ] **Custom Pattern Training** with machine learning
- [ ] **Multi-language Support** expansion (Python, Java, Go, Rust)
- [ ] **Code Quality Metrics** with technical debt analysis
- [ ] **Dependency Vulnerability Scanning**
- [ ] **License Compliance Analysis**
- [ ] **Code Coverage Integration**
- [ ] **Performance Regression Detection**
- [ ] **Automated Code Review Comments**
- [ ] **Integration with Popular IDEs** (VS Code, IntelliJ)
- [ ] **Mobile Application** for monitoring and alerts

## 📝 Configuration

### Environment Variables

Create `.env` files in respective directories:

```bash
# Backend (.env)
PORT=8001
DATABASE_URL=./database.sqlite

# Memory API (.env)
PORT=3721
OPENAI_API_KEY=your_key_here
```

## 🤝 Contributing

1. Check existing issues and patterns
2. Test changes against all services
3. Ensure TypeScript compilation passes
4. Verify API endpoint compatibility
5. Update documentation as needed

## 📄 License

Internal use only - RefactorForge proprietary system

---

*Last Updated: January 15, 2025*
*Version: 2.1.0*
*Performance Optimizations: January 2025*
*Documentation Refresh: January 2025*