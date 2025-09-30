/**
 * Analysis Type Definitions
 * Interfaces for code analysis results and patterns
 */

// Repository Information
export interface RepositoryInfo {
  id: string;
  name: string;
  fullName: string;
  organization: string;
  description?: string | null;
  techStack: string; // Primary tech stack as string
  primaryLanguage: string;
  framework?: string | null;
  patternsCount: number;
  categories: string[];
  branches: string[];
}

// Pattern Detection
export interface Pattern {
  id: string;
  repositoryId: string;
  content: string;
  contentHash: string;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  language: string;
  framework?: string;
  confidenceScore: number;
  contextBefore?: string;
  contextAfter?: string;
  astMetadata: Record<string, unknown>;
  // Legacy fields for compatibility
  name?: string;
  type?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  occurrences?: number;
  files?: string[];
  examples?: AnalysisCodeExample[];
  recommendations?: string[];
}

export interface PatternDetectionResult {
  patternType: string;
  patternName: string;
  filePath: string;
  lineNumber: number | null;
  codeSnippet: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  repository?: GitHubRepositoryContext;
}

export interface GitHubRepositoryContext {
  owner: string;
  repo: string;
  branch: string;
}

// Security Analysis
export interface SecurityPattern {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line: number;
  description: string;
  recommendation: string;
}

// Type Safety Analysis
export interface TypeSafetyIssue {
  file: string;
  line: number;
  issue: string;
  suggestion: string;
}

// Performance Analysis
export interface PerformanceIssue {
  file: string;
  type: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
}

// Analysis Results
export interface AnalysisResult {
  repositoryId: string;
  repositoryName: string;
  timestamp: string;
  patterns: Pattern[];
  securityIssues: SecurityIssue[];
  performanceIssues: PerformanceMetric[];
  codeQualityMetrics: CodeQualityMetrics;
  recommendations: AnalysisRecommendation[];
}

export interface SecurityIssue {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line: number;
  description: string;
  recommendation: string;
  cweId?: string;
  owaspCategory?: string;
}

export interface PerformanceMetric {
  id: string;
  metric: string;
  value: number;
  unit: string;
  benchmark: number;
  status: 'good' | 'warning' | 'critical';
  recommendations?: string[];
}

export interface CodeQualityMetrics {
  complexity: {
    cyclomatic: number;
    cognitive: number;
  };
  maintainability: {
    index: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  duplication: {
    percentage: number;
    duplicatedLines: number;
    totalLines: number;
  };
  coverage?: {
    line: number;
    branch: number;
    function: number;
  };
  issues: {
    bugs: number;
    vulnerabilities: number;
    codeSmells: number;
    securityHotspots: number;
  };
}

export interface AnalysisRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  estimatedEffort: string;
  impact: string;
  relatedPatterns: string[];
}

// Repository Comparison
export interface RepositoryComparison {
  repositories: string[];
  techStackOverlap: Record<string, number>;
  commonPatterns: Pattern[];
  sharedIssues: Array<{
    issue: string;
    repositories: string[];
    severity: string;
  }>;
  recommendations: ComparisonRecommendation[];
}

export interface ComparisonRecommendation {
  title: string;
  description: string;
  affectedRepositories: string[];
  estimatedEffort: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// Analysis Code Example
export interface AnalysisCodeExample {
  title: string;
  description?: string;
  before: string;
  after: string;
  language: string;
  explanation?: string;
}

// Analysis Statistics
export interface AnalysisStatistics {
  totalRepositories: number;
  totalPatterns: number;
  patternsByCategory: Record<string, number>;
  issuesBySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  topIssues: Array<{
    issue: string;
    count: number;
    severity: string;
  }>;
  techStackDistribution: Record<string, number>;
  languageDistribution: Record<string, number>;
  averageMetrics: {
    complexity: number;
    maintainability: number;
    coverage: number;
  };
}

// Scan Results
export interface ScanResult {
  repositoryId: string;
  repositoryName: string;
  scanDate: string;
  scanSuccessful: boolean;
  errorMessage?: string;
  patternsFound: number;
  securityIssues: number;
  typeSafetyIssues: number;
  performanceIssues: number;
  fixedIssues?: {
    total: number;
    security: number;
    typeIssues: number;
    performance: number;
    details: {
      fixedSecurityIssues: string[];
      fixedTypeIssues: string[];
      fixedPerformanceIssues: string[];
    };
  };
}

// Import scanner types for proper typing
export interface ScannerSecurityPattern {
  type: 'missing_middleware' | 'insecure_config' | 'vulnerable_dependency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  filePath: string;
  lineNumber?: number;
  recommendation: string;
}

export interface ScannerTypeSafetyIssue {
  type: 'any_usage' | 'missing_types' | 'type_assertion';
  description: string;
  filePath: string;
  lineNumber: number;
  suggestion: string;
}

export interface ScannerPerformanceIssue {
  type: 'sync_operation' | 'memory_leak' | 'inefficient_loop' | 'large_bundle';
  description: string;
  filePath: string;
  lineNumber?: number;
  impact: string;
  solution: string;
}

// Detailed Scan Results (for recommendation engine)
export interface DetailedScanResults {
  securityIssues: ScannerSecurityPattern[] | number;
  typeSafetyIssues: ScannerTypeSafetyIssue[] | number;
  performanceIssues: ScannerPerformanceIssue[] | number;
  codeQualityMetrics?: CodeQualityMetrics;
  patternsFound?: Pattern[];
}

// Pattern Statistics
export interface PatternStatistics {
  mostCommon: Array<{
    pattern: string;
    count: number;
    repositories: string[];
  }>;
  byCategory: Record<string, number>;
  byRepository: Record<string, number>;
  trends: Array<{
    date: string;
    newPatterns: number;
    resolvedPatterns: number;
  }>;
}