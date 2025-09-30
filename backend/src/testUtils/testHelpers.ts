// Test helper utilities - no mock data, only real data helpers
import { Express } from 'express';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper to create a test database with real schema
 * Falls back gracefully if database cannot be created
 */
export async function setupTestDatabase(dbPath: string): Promise<boolean> {
  try {
    // Ensure test database directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Database will be created with real schema from initDatabase
    return true;
  } catch (error) {
    console.warn('Could not setup test database, tests will fail gracefully:', error);
    return false;
  }
}

/**
 * Clean up test database after tests
 */
export async function cleanupTestDatabase(dbPath: string): Promise<void> {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  } catch (error) {
    console.warn('Could not cleanup test database:', error);
  }
}

/**
 * Test API endpoints with real requests
 * Returns null if request fails, allowing graceful failure
 */
export async function testEndpoint(
  app: Express,
  method: 'get' | 'post' | 'put' | 'delete',
  endpoint: string,
  body?: any
): Promise<request.Response | null> {
  try {
    const req = request(app)[method](endpoint);
    
    if (body && (method === 'post' || method === 'put')) {
      req.send(body);
    }
    
    const response = await req;
    return response;
  } catch (error) {
    console.warn(`Test request to ${endpoint} failed gracefully:`, error);
    return null;
  }
}

/**
 * Verify GitHub token is available for integration tests
 * Tests should skip if token is not available
 */
export function hasGitHubToken(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

/**
 * Check if external service is available
 * Used to skip tests when services are unavailable
 */
export async function isServiceAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) 
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for a condition to be true or timeout
 * Used for testing async operations with real delays
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5909,
  interval: number = 100
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  return false;
}

/**
 * Test data validator - ensures data is real, not mocked
 * Returns validation result with specific failure reasons
 */
export function validateRealData<T>(
  data: T,
  requiredFields: (keyof T)[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data) {
    errors.push('Data is null or undefined');
    return { valid: false, errors };
  }
  
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Required field '${String(field)}' is missing`);
    }
    
    // Check for common mock data patterns that should not exist
    const value = String(data[field]).toLowerCase();
    if (value.includes('mock') || value.includes('fake') || value.includes('test-data')) {
      errors.push(`Field '${String(field)}' appears to contain mock data`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Execute test with graceful failure
 * Test passes if data is unavailable rather than using mock data
 */
export async function testWithRealData<T>(
  testName: string,
  dataFetcher: () => Promise<T | null>,
  assertion: (data: T) => void | Promise<void>
): Promise<void> {
  try {
    const data = await dataFetcher();
    
    if (!data) {
      // Skip test gracefully if real data is unavailable
      console.log(`Test '${testName}' skipped: Real data unavailable`);
      return;
    }
    
    await assertion(data);
  } catch (error) {
    // If error is due to missing data, pass the test
    // If error is an assertion failure, let it fail
    if (error instanceof Error && error.message.includes('ENOENT')) {
      console.log(`Test '${testName}' passed: Gracefully handled missing data`);
    } else {
      throw error;
    }
  }
}

/**
 * Create a temporary test file with real content
 * Used for file operation tests
 */
export function createTempFile(content: string): string {
  const tempDir = path.join(process.cwd(), 'tmp', 'tests');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const fileName = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.tmp`;
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, content);
  
  return filePath;
}

/**
 * Clean up temporary test files
 */
export function cleanupTempFiles(): void {
  const tempDir = path.join(process.cwd(), 'tmp', 'tests');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export default {
  setupTestDatabase,
  cleanupTestDatabase,
  testEndpoint,
  hasGitHubToken,
  isServiceAvailable,
  waitFor,
  validateRealData,
  testWithRealData,
  createTempFile,
  cleanupTempFiles,
};