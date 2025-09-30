/**
 * Database Type Definitions
 * Defines interfaces for all database table rows and query results
 */

// Repository table
export interface RepositoryRow {
  id: string;
  name: string;
  full_name: string;
  organization: string;
  description: string | null;
  tech_stack: string;
  primary_language: string;
  framework: string | null;
  patterns_count: number;
  categories: string; // JSON string
  branches: string; // JSON string
  analysis_status: 'pending' | 'analyzing' | 'analyzed' | 'error';
  last_analyzed: string | null;
  created_at: string;
  updated_at: string;
  metadata?: string; // JSON string
}

// Repository recommendations table
export interface RecommendationRow {
  id: string;
  repository_id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  time_estimate: string;
  time_saved: string | null;
  bugs_prevented: string | null;
  performance_gain: string | null;
  before_code: string | null;
  after_code: string | null;
  implementation_steps: string; // JSON string
  tags: string; // JSON string
  status: 'active' | 'implemented' | 'dismissed' | 'in_progress';
  difficulty: 'easy' | 'medium' | 'hard' | null;
  created_at: string;
  updated_at: string;
}

// Patterns table
export interface PatternRow {
  id: string;
  repository_id: string;
  file_path: string;
  pattern_type: string;
  pattern_name: string;
  code_snippet: string | null;
  line_number: number | null;
  confidence: number;
  impact_score: number;
  tags: string; // JSON string
  detected_at: string;
  metadata: string; // JSON string
}

// Code improvements table
export interface CodeImprovementRow {
  id: string;
  repository: string;
  repository_name: string;
  tech_stack: string;
  primary_language: string;
  framework: string | null;
  branch: string;
  file_path: string;
  categories: string; // JSON string
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  current_code: string | null;
  improved_code: string | null;
  implementation_steps: string; // JSON string
  estimated_time: string | null;
  time_saved: string | null;
  bugs_prevented: string | null;
  performance_gain: string | null;
  tags: string; // JSON string
  status: 'pending' | 'implemented' | 'dismissed';
  difficulty: 'easy' | 'medium' | 'hard';
  created_at: string;
  updated_at: string;
}

// Analysis results table
export interface AnalysisResultRow {
  id: string;
  repository_id: string;
  analysis_type: string;
  results: string; // JSON string
  metadata: string; // JSON string
  created_at: string;
}

// GitHub integrations table  
export interface GitHubIntegrationRow {
  id: string;
  repository_name: string;
  webhook_id: string | null;
  webhook_secret: string | null;
  access_token: string | null;
  installation_id: string | null;
  created_at: string;
  updated_at: string;
}

// Templates table
export interface TemplateRow {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  framework: string | null;
  template_content: string;
  variables: string; // JSON string
  metadata: string; // JSON string
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// Search history table
export interface SearchHistoryRow {
  id: string;
  query: string;
  results_count: number;
  repository_filter: string | null;
  category_filter: string | null;
  timestamp: string;
}

// Contacts table
export interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  context: string | null;
  last_interaction: string;
  created_at: string;
  updated_at: string;
}

// Helper type for parsed JSON fields
export interface ParsedRecommendation extends Omit<RecommendationRow, 'implementation_steps' | 'tags'> {
  implementation_steps: Array<{
    step: number;
    title: string;
    description: string;
    estimatedTime: string;
  }>;
  tags: string[];
  recommendationType: string; // From category field
}

export interface ParsedPattern extends Omit<PatternRow, 'tags' | 'metadata'> {
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface ParsedRepository extends Omit<RepositoryRow, 'categories' | 'branches'> {
  categories: string[];
  branches: string[];
}