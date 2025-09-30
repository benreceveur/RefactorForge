/**
 * Comprehensive Validation Schemas with Runtime Type Safety
 * Using Zod for runtime validation and type inference
 */

import { z } from 'zod';

// Base validation schemas
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(320, 'Email must not exceed 320 characters');

export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .refine(url => url.startsWith('http://') || url.startsWith('https://'), 
    'URL must use http or https protocol');

export const repositoryNameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Repository name must be in format "owner/repo"')
  .min(3, 'Repository name must be at least 3 characters')
  .max(100, 'Repository name must not exceed 100 characters');

export const semVerSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'Version must be in semantic version format (x.y.z)');

export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format');

// GitHub API validation schemas
export const githubRepositorySchema = z.object({
  id: z.number().int().positive('Repository ID must be a positive integer'),
  name: z.string().min(1, 'Repository name is required'),
  full_name: repositoryNameSchema,
  private: z.boolean(),
  owner: z.object({
    login: z.string().min(1, 'Owner login is required'),
    id: z.number().int().positive('Owner ID must be a positive integer'),
    type: z.enum(['User', 'Organization']),
  }),
  html_url: urlSchema,
  clone_url: urlSchema.optional(),
  ssh_url: z.string().optional(),
  default_branch: z.string().min(1, 'Default branch is required'),
  language: z.string().nullable(),
  stargazers_count: z.number().int().nonnegative('Stargazers count must be non-negative'),
  forks_count: z.number().int().nonnegative('Forks count must be non-negative'),
  open_issues_count: z.number().int().nonnegative('Open issues count must be non-negative'),
  created_at: z.string().datetime('Invalid created date format'),
  updated_at: z.string().datetime('Invalid updated date format'),
  pushed_at: z.string().datetime('Invalid pushed date format'),
  size: z.number().int().nonnegative('Repository size must be non-negative'),
  topics: z.array(z.string()).default([]),
  archived: z.boolean().default(false),
  disabled: z.boolean().default(false),
});

export const githubFileSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  path: z.string().min(1, 'File path is required'),
  sha: z.string().min(40, 'SHA must be at least 40 characters').max(40, 'SHA must be exactly 40 characters'),
  size: z.number().int().nonnegative('File size must be non-negative'),
  url: urlSchema,
  html_url: urlSchema,
  git_url: urlSchema,
  download_url: urlSchema.nullable(),
  type: z.enum(['file', 'dir']),
  content: z.string().optional(),
  encoding: z.enum(['base64', 'utf-8']).optional(),
});

// API request validation schemas
export const repositoryAnalysisRequestSchema = z.object({
  repository: repositoryNameSchema,
  options: z.object({
    includeTests: z.boolean().default(true),
    includeNodeModules: z.boolean().default(false),
    framework: z.string().optional(),
  }).optional().default({
    includeTests: true,
    includeNodeModules: false,
  }),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit must not exceed 100').default(20),
});

export const sortSchema = z.object({
  field: z.string().min(1, 'Sort field is required'),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

// Code improvement validation schemas
export const improvementCategorySchema = z.enum([
  'performance',
  'security', 
  'maintainability',
  'best_practices',
  'code_quality',
  'testing',
  'accessibility',
  'documentation'
]);

export const severitySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const effortSchema = z.enum(['small', 'medium', 'large']);

export const impactSchema = z.enum(['low', 'medium', 'high']);

export const codeExampleSchema = z.object({
  before: z.string().min(1, 'Before code example is required'),
  after: z.string().min(1, 'After code example is required'),
  explanation: z.string().min(1, 'Code example explanation is required'),
});

export const codeImprovementSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1, 'Improvement title is required').max(200, 'Title must not exceed 200 characters'),
  description: z.string().min(1, 'Improvement description is required').max(1000, 'Description must not exceed 1000 characters'),
  category: improvementCategorySchema,
  severity: severitySchema,
  effort: effortSchema,
  impact: impactSchema,
  file: z.string().optional(),
  line: z.number().int().positive('Line number must be positive').optional(),
  examples: codeExampleSchema.optional(),
  tags: z.array(z.string()).default([]),
  estimatedTimeMinutes: z.number().int().positive('Estimated time must be positive').optional(),
});

// Memory Bank validation schemas
export const memoryCategorySchema = z.enum([
  'best_practices',
  'patterns',
  'snippets',
  'troubleshooting',
  'documentation',
  'architecture',
  'security',
  'performance'
]);

export const importanceSchema = z.coerce.number().int().min(1, 'Importance must be at least 1').max(5, 'Importance must not exceed 5');

export const createMemoryItemSchema = z.object({
  title: z.string().min(1, 'Memory item title is required').max(200, 'Title must not exceed 200 characters'),
  content: z.string().min(1, 'Memory item content is required').max(10000, 'Content must not exceed 10000 characters'),
  tags: z.array(z.string()).default([]),
  category: memoryCategorySchema,
  importance: importanceSchema.default(3),
  metadata: z.object({
    source: z.string().optional(),
    context: z.string().optional(),
  }).optional(),
});

export const updateMemoryItemSchema = createMemoryItemSchema.partial().extend({
  id: uuidSchema,
});

export const memorySearchSchema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: memoryCategorySchema.optional(),
  importance: importanceSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// Contact management validation schemas
export const availabilityStatusSchema = z.enum(['available', 'busy', 'away', 'unknown']);

export const contactMethodSchema = z.enum(['email', 'slack', 'teams', 'phone', 'github']);

export const socialLinksSchema = z.object({
  github: urlSchema.optional(),
  linkedin: urlSchema.optional(),
  twitter: urlSchema.optional(),
  website: urlSchema.optional(),
});

export const createContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required').max(100, 'Name must not exceed 100 characters'),
  email: emailSchema,
  role: z.string().max(100, 'Role must not exceed 100 characters').optional(),
  company: z.string().max(100, 'Company must not exceed 100 characters').optional(),
  expertise: z.array(z.string()).default([]),
  availability: availabilityStatusSchema.default('unknown'),
  preferredContactMethod: contactMethodSchema.default('email'),
  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').optional(),
  socialLinks: socialLinksSchema.optional(),
});

export const updateContactSchema = createContactSchema.partial().extend({
  id: uuidSchema,
});

export const contactSearchSchema = z.object({
  query: z.string().optional(),
  expertise: z.array(z.string()).optional(),
  company: z.string().optional(),
  availability: availabilityStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// Database operation validation schemas
export const databaseQuerySchema = z.object({
  sql: z.string().min(1, 'SQL query is required'),
  params: z.array(z.unknown()).optional(),
});

// User preferences validation schemas
export const themeSchema = z.enum(['light', 'dark', 'auto']);

export const languageSchema = z.string().min(2, 'Language code must be at least 2 characters').max(10, 'Language code must not exceed 10 characters');

export const notificationPreferencesSchema = z.object({
  email: z.boolean().default(true),
  inApp: z.boolean().default(true),
  analysisComplete: z.boolean().default(true),
  weeklyDigest: z.boolean().default(false),
});

export const analysisOptionsSchema = z.object({
  includeTests: z.boolean().default(true),
  includeNodeModules: z.boolean().default(false),
  preferredFramework: z.string().optional(),
});

export const dashboardPreferencesSchema = z.object({
  defaultView: z.enum(['grid', 'list']).default('grid'),
  itemsPerPage: z.coerce.number().int().min(5).max(100).default(20),
  showMetrics: z.boolean().default(true),
});

export const userPreferencesSchema = z.object({
  theme: themeSchema.default('auto'),
  language: languageSchema.default('en'),
  notifications: notificationPreferencesSchema.default({
    email: true,
    inApp: true,
    analysisComplete: true,
    weeklyDigest: false,
  }),
  defaultAnalysisOptions: analysisOptionsSchema.default({
    includeTests: true,
    includeNodeModules: false,
  }),
  dashboard: dashboardPreferencesSchema.default({
    defaultView: 'grid',
    itemsPerPage: 20,
    showMetrics: true,
  }),
});

// API response validation schemas
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.literal(true),
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
  timestamp: z.string().optional(),
  correlationId: z.string().optional(),
});

export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.literal(true),
  data: dataSchema,
  error: z.literal(false).optional(),
  timestamp: z.string().optional(),
  correlationId: z.string().optional(),
});

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.literal(true),
  data: z.array(dataSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
  error: z.literal(false).optional(),
  timestamp: z.string().optional(),
  correlationId: z.string().optional(),
});

// Health check validation schemas
export const serviceStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);

export const serviceHealthSchema = z.object({
  name: z.string(),
  status: serviceStatusSchema,
  responseTime: z.number().nonnegative().optional(),
  error: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const systemHealthSchema = z.object({
  overall: serviceStatusSchema,
  services: z.array(serviceHealthSchema),
  timestamp: z.string(),
  uptime: z.number().nonnegative(),
});

// Configuration validation schemas
export const appConfigSchema = z.object({
  port: z.coerce.number().int().min(1024).max(65535).default(8001),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  apiUrl: urlSchema.optional(),
  wsUrl: urlSchema.optional(),
  database: z.object({
    type: z.enum(['sqlite', 'postgres', 'mysql']).default('sqlite'),
    url: z.string().optional(),
    path: z.string().optional(),
  }),
  github: z.object({
    token: z.string().optional(),
    webhookSecret: z.string().optional(),
  }).optional(),
  security: z.object({
    jwtSecret: z.string().min(32, 'JWT secret must be at least 32 characters'),
    saltRounds: z.number().int().min(10).max(15).default(12),
    sessionTimeout: z.number().int().positive().default(3600000), // 1 hour in ms
  }),
  rateLimit: z.object({
    windowMs: z.number().int().positive().default(900000), // 15 minutes
    maxRequests: z.number().int().positive().default(100),
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    format: z.enum(['json', 'text']).default('json'),
  }),
});

// Type inference from schemas
export type GitHubRepository = z.infer<typeof githubRepositorySchema>;
export type GitHubFile = z.infer<typeof githubFileSchema>;
export type RepositoryAnalysisRequest = z.infer<typeof repositoryAnalysisRequestSchema>;
export type CodeImprovement = z.infer<typeof codeImprovementSchema>;
export type CreateMemoryItem = z.infer<typeof createMemoryItemSchema>;
export type UpdateMemoryItem = z.infer<typeof updateMemoryItemSchema>;
export type MemorySearch = z.infer<typeof memorySearchSchema>;
export type CreateContact = z.infer<typeof createContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;
export type ContactSearch = z.infer<typeof contactSearchSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
export type SystemHealth = z.infer<typeof systemHealthSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Sort = z.infer<typeof sortSchema>;

// Validation helper functions
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const errors = result.error.issues.map((err) => 
      err.path.length > 0 ? `${err.path.join('.')}: ${err.message}` : err.message
    );
    return { success: false, errors };
  }
}

export function assertValidData<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validateData(schema, data);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.errors.join(', ')}`);
  }
  return result.data;
}

export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown) => validateData(schema, data);
}

// Express middleware validation helper
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any): void => {
    const result = validateData(schema, req.body);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: true,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: result.errors,
      });
    }
    
    req.body = result.data;
    next();
  };
}