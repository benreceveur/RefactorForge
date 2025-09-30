/**
 * Central export point for all type definitions
 */

// Database Types
export type * from './database.types';

// GitHub API Types
export type * from './github.types';

// Analysis Types
export type * from './analysis.types';

// Template Types
export type {
  Template,
  TemplateCategory,
  ProgrammingLanguage,
  TemplateVariable,
  VariableType,
  TemplateVariableValue,
  VariableValidation,
  TemplateMetadata,
  TemplateExample,
  TemplateGenerationRequest,
  GenerationOptions,
  TemplateGenerationResult,
  TemplateValidationError, // Renamed to avoid conflict
  TemplateContext,
  UserPreferences,
  TemplateResolution,
  ConditionalBlock,
  TemplateSearchCriteria,
  TemplateSearchResult,
  TemplateExport,
  TemplateImportResult,
  TemplateAnalytics
} from './template.types';

// Common Types (export all except ValidationError to avoid conflicts)
export type {
  ApiResponse,
  PaginatedResponse,
  Recommendation,
  RecommendationType,
  Priority,
  RecommendationStatus,
  ImplementationStep,
  RecommendationMetrics,
  CodeExample, // From common.types
  ApplicationError,
  ValidationError, // From common.types
  HealthStatus,
  DependencyHealth,
  SystemMetrics,
  AnalyticsData,
  RepositoryStatistics,
  TrendData,
  SearchQuery,
  SearchFilters,
  PaginationOptions,
  SortOptions,
  SearchResult,
  SearchFacets,
  WebhookEvent,
  WebhookResponse,
  AppConfiguration,
  DatabaseConfig,
  GitHubConfig,
  RedisConfig,
  LoggingConfig,
  SecurityConfig
} from './common.types';