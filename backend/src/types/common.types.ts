/**
 * Common Type Definitions
 * Shared interfaces and types used across the application
 */

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Recommendation Types
export interface Recommendation {
  id: string;
  repositoryId: string;
  title: string;
  description: string;
  recommendationType: RecommendationType;
  priority: Priority;
  applicablePatterns: string[];
  codeExamples: CodeExample[];
  implementationSteps: ImplementationStep[];
  estimatedEffort: string;
  tags: string[];
  status: RecommendationStatus;
  metrics?: RecommendationMetrics;
}

export type RecommendationType = 
  | 'security'
  | 'performance'
  | 'architecture'
  | 'best_practices'
  | 'testing'
  | 'documentation'
  | 'refactoring'
  | 'type_safety';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type RecommendationStatus = 'active' | 'implemented' | 'dismissed' | 'in_progress';

export interface ImplementationStep {
  step: number;
  title: string;
  description: string;
  estimatedTime: string;
}

export interface RecommendationMetrics {
  timeSaved?: string;
  bugsPrevented?: string | number; // Support both string descriptions and numeric values
  performanceGain?: string;
  maintainabilityImprovement?: string;
  bugsPreventedCount?: number; // Explicit numeric field for calculations
}

export interface CodeExample {
  title: string;
  description?: string;
  before: string;
  after: string;
  language: string;
  explanation?: string;
}

// Error Types
export interface ApplicationError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  stack?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  constraint?: string;
}

// Health Check Types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version?: string;
  dependencies?: Record<string, DependencyHealth>;
  metrics?: SystemMetrics;
}

export interface DependencyHealth {
  status: 'healthy' | 'unhealthy' | 'unknown' | 'authenticated' | 'unauthenticated';
  message?: string;
  latency?: number;
  lastChecked?: string;
  error?: string;
  tables?: Record<string, unknown>;
  type?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: string;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk?: {
    used: number;
    total: number;
    percentage: number;
  };
}

// Analytics Types
export interface AnalyticsData {
  totalPatterns: number;
  totalRecommendations: number;
  recommendationsByType: Record<RecommendationType, number>;
  recommendationsByPriority: Record<Priority, number>;
  repositoryStats: RepositoryStatistics[];
  trends: TrendData[];
}

export interface RepositoryStatistics {
  repositoryId: string;
  repositoryName: string;
  patternsCount: number;
  recommendationsCount: number;
  implementedCount: number;
  dismissedCount: number;
  averageImplementationTime?: string;
  healthScore?: number;
}

export interface TrendData {
  date: string;
  metric: string;
  value: number;
  change: number;
  changePercentage: number;
}

// Search Types
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  pagination?: PaginationOptions;
  sort?: SortOptions;
}

export interface SearchFilters {
  repository?: string;
  category?: string;
  severity?: Priority;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

export interface SearchResult<T = unknown> {
  items: T[];
  total: number;
  facets?: SearchFacets;
  query: string;
  executionTime: number;
}

export interface SearchFacets {
  categories: Record<string, number>;
  repositories: Record<string, number>;
  severities: Record<string, number>;
  tags: Record<string, number>;
}

// WebHook Types
export interface WebhookEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  source: string;
  signature?: string;
}

export interface WebhookResponse {
  received: boolean;
  processed: boolean;
  message?: string;
  error?: string;
}

// Configuration Types
export interface AppConfiguration {
  database: DatabaseConfig;
  github?: GitHubConfig;
  redis?: RedisConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
}

export interface DatabaseConfig {
  path: string;
  maxConnections?: number;
  timeout?: number;
}

export interface GitHubConfig {
  token?: string;
  webhookSecret?: string;
  appId?: string;
  privateKey?: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  destination: 'console' | 'file' | 'both';
  filePath?: string;
}

export interface SecurityConfig {
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    max: number;
  };
  helmet: boolean;
  jwtSecret?: string;
}