/**
 * Enhanced API Type Definitions
 * Comprehensive type safety for all API interactions
 */

import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

// Base API Response Types
export interface BaseApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: boolean;
  readonly code?: string;
  readonly message?: string;
  readonly timestamp: string;
  readonly correlationId: string;
}

export interface SuccessApiResponse<T> extends BaseApiResponse<T> {
  readonly success: true;
  readonly error?: false;
  readonly data: T;
}

export interface ErrorApiResponse extends BaseApiResponse<never> {
  readonly success: false;
  readonly error: true;
  readonly data?: never;
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export type ApiResponse<T> = SuccessApiResponse<T> | ErrorApiResponse;

// Pagination Types
export interface PaginationMetadata {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface PaginatedApiResponse<T> extends SuccessApiResponse<T[]> {
  readonly pagination: PaginationMetadata;
}

// Request Types
export interface TypedRequest<
  TBody = Record<string, unknown>,
  TQuery extends ParsedQs = ParsedQs,
  TParams extends ParamsDictionary = ParamsDictionary
> extends ExpressRequest {
  readonly body: TBody;
  readonly query: TQuery;
  readonly params: TParams;
}

export interface AuthenticatedRequest<
  TBody = Record<string, unknown>,
  TQuery extends ParsedQs = ParsedQs,
  TParams extends ParamsDictionary = ParamsDictionary
> extends TypedRequest<TBody, TQuery, TParams> {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly role: UserRole;
  };
}

// User and Authentication Types
export const enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer'
}

export interface UserSession {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

// GitHub API Types with strict typing
export interface GitHubRepository {
  readonly id: number;
  readonly name: string;
  readonly full_name: string;
  readonly private: boolean;
  readonly owner: {
    readonly login: string;
    readonly id: number;
    readonly type: 'User' | 'Organization';
  };
  readonly html_url: string;
  readonly clone_url: string;
  readonly ssh_url: string;
  readonly default_branch: string;
  readonly language: string | null;
  readonly stargazers_count: number;
  readonly forks_count: number;
  readonly open_issues_count: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly pushed_at: string;
  readonly size: number;
  readonly topics: readonly string[];
  readonly archived: boolean;
  readonly disabled: boolean;
}

export interface GitHubFile {
  readonly name: string;
  readonly path: string;
  readonly sha: string;
  readonly size: number;
  readonly url: string;
  readonly html_url: string;
  readonly git_url: string;
  readonly download_url: string | null;
  readonly type: 'file' | 'dir';
  readonly content?: string;
  readonly encoding?: 'base64' | 'utf-8';
}

export interface GitHubTreeNode {
  readonly path: string;
  readonly mode: '100644' | '100755' | '040000' | '160000' | '120000';
  readonly type: 'blob' | 'tree' | 'commit';
  readonly sha: string;
  readonly size?: number;
  readonly url: string;
}

export interface GitHubTree {
  readonly sha: string;
  readonly url: string;
  readonly truncated: boolean;
  readonly tree: readonly GitHubTreeNode[];
}

// Error Types with strict constraints
export interface ApiError {
  readonly name: string;
  readonly message: string;
  readonly code: string;
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly timestamp: Date;
  readonly correlationId?: string;
  readonly context?: Record<string, unknown>;
}

export const enum ErrorCode {
  // Client Errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED', 
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server Errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',
  
  // Business Logic Errors
  REPOSITORY_NOT_FOUND = 'REPOSITORY_NOT_FOUND',
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  
  // Security Errors
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
}

// Validation Types
export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly value?: unknown;
  readonly constraint?: string;
}

export interface ValidationResult<T> {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
  readonly data?: T;
}

// Utility Types for enhanced type safety
export type NonEmptyArray<T> = readonly [T, ...T[]];

export type Exact<T, U> = T extends U ? (U extends T ? T : never) : never;

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type StrictOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

// Response Handler Types
export type ApiHandler<TRequest, TResponse> = (
  req: TRequest
) => Promise<ApiResponse<TResponse>>;

export type AuthenticatedApiHandler<TRequest, TResponse> = (
  req: TRequest & { user: UserSession }
) => Promise<ApiResponse<TResponse>>;

// Middleware Types
export type ApiMiddleware = (
  req: TypedRequest,
  res: ExpressResponse,
  next: () => void
) => void | Promise<void>;

export type AsyncApiMiddleware = (
  req: TypedRequest,
  res: ExpressResponse,
  next: (error?: unknown) => void
) => Promise<void>;

// Database Query Types
export interface DatabaseConnection {
  readonly query: <T = unknown>(sql: string, params?: readonly unknown[]) => Promise<T[]>;
  readonly get: <T = unknown>(sql: string, params?: readonly unknown[]) => Promise<T | undefined>;
  readonly run: (sql: string, params?: readonly unknown[]) => Promise<{ changes: number; lastID: number }>;
  readonly transaction: <T>(fn: (db: DatabaseConnection) => Promise<T>) => Promise<T>;
}

export interface QueryResult<T> {
  readonly data: T;
  readonly rowCount: number;
  readonly executionTime: number;
}

// Health Check Types
export const enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded', 
  UNHEALTHY = 'unhealthy'
}

export interface ServiceHealth {
  readonly name: string;
  readonly status: ServiceStatus;
  readonly responseTime?: number;
  readonly error?: string;
  readonly details?: Record<string, unknown>;
}

export interface SystemHealth {
  readonly overall: ServiceStatus;
  readonly services: readonly ServiceHealth[];
  readonly timestamp: Date;
  readonly uptime: number;
}

// Template literal types for better string validation
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type ApiEndpoint = `/api/${string}`;

export type RepositoryName = `${string}/${string}`;

export type SemVer = `${number}.${number}.${number}`;

export type EmailAddress = `${string}@${string}.${string}`;

// Conditional types for enhanced type inference
export type InferApiResponse<T> = T extends ApiHandler<unknown, infer R> ? R : never;

export type ExtractRequestBody<T> = T extends TypedRequest<infer B, ParsedQs, ParamsDictionary> ? B : never;

export type ExtractRequestParams<T> = T extends TypedRequest<Record<string, unknown>, ParsedQs, infer P> ? P : never;

export type ExtractRequestQuery<T> = T extends TypedRequest<Record<string, unknown>, infer Q, ParamsDictionary> ? Q : never;