/**
 * Template Engine Type Definitions
 * Interfaces for template system and code generation
 */

// Template Definition
export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  language: ProgrammingLanguage;
  framework?: string;
  templateContent: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory = 
  | 'component'
  | 'service'
  | 'api'
  | 'database'
  | 'configuration'
  | 'testing'
  | 'documentation'
  | 'security'
  | 'performance'
  | 'utility';

export type ProgrammingLanguage = 
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin';

// Template Variables
export interface TemplateVariable {
  name: string;
  type: VariableType;
  description?: string;
  required: boolean;
  defaultValue?: TemplateVariableValue;
  validation?: VariableValidation;
  placeholder?: string;
}

export type VariableType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'enum'
  | 'date';

export type TemplateVariableValue = 
  | string 
  | number 
  | boolean 
  | null
  | string[]
  | Record<string, unknown>;

export interface VariableValidation {
  pattern?: string; // Regex pattern
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: string[];
  customValidator?: string; // Function name to call
}

// Template Metadata
export interface TemplateMetadata {
  author?: string;
  version?: string;
  tags: string[];
  dependencies?: string[];
  compatibleWith?: string[];
  examples?: TemplateExample[];
  documentation?: string;
  license?: string;
}

export interface TemplateExample {
  title: string;
  description?: string;
  variables: Record<string, TemplateVariableValue>;
  expectedOutput: string;
}

// Template Generation
export interface TemplateGenerationRequest {
  templateId: string;
  variables: Record<string, TemplateVariableValue>;
  options?: GenerationOptions;
}

export interface GenerationOptions {
  formatOutput?: boolean;
  validateVariables?: boolean;
  includeComments?: boolean;
  indentSize?: number;
  lineEndings?: 'unix' | 'windows';
}

export interface TemplateGenerationResult {
  success: boolean;
  generatedCode?: string;
  errors?: TemplateValidationError[];
  warnings?: string[];
  metadata?: {
    templateName: string;
    generatedAt: string;
    variablesUsed: Record<string, TemplateVariableValue>;
  };
}

export interface TemplateValidationError {
  field: string;
  message: string;
  value?: TemplateVariableValue;
  expectedType?: string;
}

// Template Context
export interface TemplateContext {
  repository?: {
    name: string;
    organization: string;
    techStack: string[];
    language: string;
    framework?: string;
  };
  user?: {
    id: string;
    preferences?: UserPreferences;
  };
  environment?: {
    nodeVersion?: string;
    npmVersion?: string;
    platform?: string;
  };
  customContext?: Record<string, unknown>;
}

export interface UserPreferences {
  indentStyle: 'tabs' | 'spaces';
  indentSize: number;
  quoteStyle: 'single' | 'double';
  semicolons: boolean;
  trailingComma: boolean;
  lineWidth: number;
}

// Template Resolution
export interface TemplateResolution {
  templateId: string;
  resolvedContent: string;
  resolvedVariables: Record<string, TemplateVariableValue>;
  conditionalBlocks: ConditionalBlock[];
  includedPartials: string[];
}

export interface ConditionalBlock {
  condition: string;
  included: boolean;
  content: string;
  lineStart: number;
  lineEnd: number;
}

// Template Search
export interface TemplateSearchCriteria {
  query?: string;
  category?: TemplateCategory;
  language?: ProgrammingLanguage;
  framework?: string;
  tags?: string[];
  minUsageCount?: number;
  sortBy?: 'name' | 'usage' | 'created' | 'updated';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface TemplateSearchResult {
  templates: Template[];
  totalCount: number;
  facets?: {
    categories: Record<TemplateCategory, number>;
    languages: Record<ProgrammingLanguage, number>;
    frameworks: Record<string, number>;
    topTags: Array<{ tag: string; count: number }>;
  };
}

// Template Import/Export
export interface TemplateExport {
  version: string;
  exportedAt: string;
  templates: Template[];
  metadata?: {
    exportedBy?: string;
    description?: string;
    checksum?: string;
  };
}

export interface TemplateImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{
    templateName: string;
    error: string;
  }>;
}

// Template Analytics
export interface TemplateAnalytics {
  templateId: string;
  usageCount: number;
  lastUsed?: string;
  averageGenerationTime: number;
  successRate: number;
  commonVariableValues: Record<string, Array<{
    value: TemplateVariableValue;
    count: number;
  }>>;
  userFeedback?: {
    rating: number;
    reviews: number;
  };
}