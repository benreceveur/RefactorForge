/**
 * Input sanitization utilities for security
 */

/**
 * Sanitize HTML/script content from user input
 * Removes or escapes potentially dangerous HTML tags and JavaScript
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return String(input);

  // Remove script tags and their content
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove on* event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*'[^']*'/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
}

/**
 * Validate repository name format
 * Should be in format: owner/repo
 */
export function validateRepositoryFormat(repo: string): boolean {
  if (!repo || typeof repo !== 'string') return false;

  // Empty string is invalid
  if (repo.trim() === '') return false;

  // Must be in owner/repo format
  const parts = repo.split('/');
  if (parts.length !== 2) return false;

  // Both parts must be non-empty and valid
  const [owner, name] = parts;
  if (!owner || !name) return false;

  // Check for valid GitHub username/repo name pattern
  const validPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  return validPattern.test(owner) && validPattern.test(name);
}

/**
 * Sanitize repository input
 */
export function sanitizeRepository(repo: string): string {
  if (!repo || typeof repo !== 'string') return '';

  // Remove any HTML/script tags first
  const cleaned = sanitizeInput(repo);

  // Extract only valid repository format
  const match = cleaned.match(/^([a-zA-Z0-9-]+)\/([a-zA-Z0-9-._]+)$/);
  return match ? `${match[1]}/${match[2]}` : '';
}

/**
 * Validate and sanitize limit/offset pagination params
 */
export function sanitizePaginationParams(limit: any, offset: any, maxLimit = 100): { limit: number; offset: number } {
  const sanitizedLimit = Math.min(Math.max(1, parseInt(String(limit)) || 20), maxLimit);
  const sanitizedOffset = Math.max(0, parseInt(String(offset)) || 0);

  return {
    limit: sanitizedLimit,
    offset: sanitizedOffset
  };
}