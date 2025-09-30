/**
 * Comprehensive Type Guards and Runtime Type Validation
 * Provides type-safe runtime validation with compile-time guarantees
 */

// Base Type Guards
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isNullish(value: unknown): value is null | undefined {
  return value == null;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

export function isNonEmptyArray<T>(value: readonly T[]): value is readonly [T, ...T[]] {
  return value.length > 0;
}

export function isFunction(value: unknown): value is (...args: readonly unknown[]) => unknown {
  return typeof value === 'function';
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// Enhanced Object Type Guards
export function hasProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

export function hasProperties<T extends Record<PropertyKey, unknown>>(
  obj: unknown,
  keys: readonly (keyof T)[]
): obj is T {
  if (!isObject(obj)) return false;
  return keys.every(key => key in obj);
}

export function isObjectWithStringKeys(value: unknown): value is Record<string, unknown> {
  return isObject(value) && Object.keys(value).every(isString);
}

// String Validation Type Guards
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.length > 0;
}

export function isEmail(value: unknown): value is `${string}@${string}.${string}` {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

export function isUrl(value: unknown): value is `${'http' | 'https'}://${string}` {
  if (!isString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isRepositoryName(value: unknown): value is `${string}/${string}` {
  if (!isString(value)) return false;
  const parts = value.split('/');
  return parts.length === 2 && 
         parts[0] !== undefined && parts[0].length > 0 && 
         parts[1] !== undefined && parts[1].length > 0;
}

export function isSemVer(value: unknown): value is `${number}.${number}.${number}` {
  if (!isString(value)) return false;
  const semVerRegex = /^\d+\.\d+\.\d+$/;
  return semVerRegex.test(value);
}

// Number Validation Type Guards
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

export function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

export function isBetween(min: number, max: number) {
  return (value: unknown): value is number => {
    return isNumber(value) && value >= min && value <= max;
  };
}

// Array Type Guards
export function isArrayOf<T>(
  guard: (item: unknown) => item is T
): (value: unknown) => value is readonly T[] {
  return (value: unknown): value is readonly T[] => {
    return isArray(value) && value.every(guard);
  };
}

export function isNonEmptyArrayOf<T>(
  guard: (item: unknown) => item is T
): (value: unknown) => value is readonly [T, ...T[]] {
  const arrayGuard = isArrayOf(guard);
  return (value: unknown): value is readonly [T, ...T[]] => {
    return arrayGuard(value) && value.length > 0;
  };
}

// Union Type Guards
export function isOneOf<T extends readonly unknown[]>(
  ...values: T
): (value: unknown) => value is T[number] {
  return (value: unknown): value is T[number] => {
    return values.includes(value as T[number]);
  };
}

export function isStringUnion<T extends string>(
  ...values: readonly T[]
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return isString(value) && (values as readonly string[]).includes(value);
  };
}

// API-Specific Type Guards
export function isApiResponse<T>(
  value: unknown,
  dataGuard?: (data: unknown) => data is T
): value is { success: boolean; data?: T; error?: boolean; message?: string } {
  if (!isObject(value)) return false;
  
  if (!hasProperty(value, 'success') || !isBoolean(value.success)) {
    return false;
  }
  
  if (hasProperty(value, 'data') && dataGuard && !dataGuard(value.data)) {
    return false;
  }
  
  if (hasProperty(value, 'error') && !isBoolean(value.error)) {
    return false;
  }
  
  if (hasProperty(value, 'message') && !isString(value.message)) {
    return false;
  }
  
  return true;
}

export function isErrorResponse(
  value: unknown
): value is { success: false; error: true; message: string; code?: string } {
  return (
    isObject(value) &&
    hasProperty(value, 'success') &&
    value.success === false &&
    hasProperty(value, 'error') &&
    value.error === true &&
    hasProperty(value, 'message') &&
    isString(value.message)
  );
}

// GitHub API Type Guards
export function isGitHubRepository(value: unknown): value is {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: { login: string; id: number; type: 'User' | 'Organization' };
} {
  return (
    isObject(value) &&
    hasProperty(value, 'id') &&
    isNumber(value.id) &&
    hasProperty(value, 'name') &&
    isString(value.name) &&
    hasProperty(value, 'full_name') &&
    isString(value.full_name) &&
    hasProperty(value, 'private') &&
    isBoolean(value.private) &&
    hasProperty(value, 'owner') &&
    isObject(value.owner) &&
    hasProperty(value.owner, 'login') &&
    isString(value.owner.login) &&
    hasProperty(value.owner, 'id') &&
    isNumber(value.owner.id) &&
    hasProperty(value.owner, 'type') &&
    (value.owner.type === 'User' || value.owner.type === 'Organization')
  );
}

export function isGitHubFile(value: unknown): value is {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  content?: string;
} {
  return (
    isObject(value) &&
    hasProperty(value, 'name') &&
    isString(value.name) &&
    hasProperty(value, 'path') &&
    isString(value.path) &&
    hasProperty(value, 'sha') &&
    isString(value.sha) &&
    hasProperty(value, 'size') &&
    isNumber(value.size) &&
    hasProperty(value, 'type') &&
    (value.type === 'file' || value.type === 'dir')
  );
}

// Database Type Guards
export function isDatabaseRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value) && Object.keys(value).every(isString);
}

// Validation Result Type Guard
export function isValidationResult<T>(
  value: unknown,
  dataGuard?: (data: unknown) => data is T
): value is { isValid: boolean; errors: readonly string[]; data?: T } {
  if (!isObject(value)) return false;
  
  if (!hasProperty(value, 'isValid') || !isBoolean(value.isValid)) {
    return false;
  }
  
  if (!hasProperty(value, 'errors') || !isArrayOf(isString)(value.errors)) {
    return false;
  }
  
  if (hasProperty(value, 'data') && dataGuard && !dataGuard(value.data)) {
    return false;
  }
  
  return true;
}

// Utility type for creating custom type guards
export type TypeGuard<T> = (value: unknown) => value is T;

// Composable type guard creators
export function createOptionalGuard<T>(
  guard: TypeGuard<T>
): TypeGuard<T | undefined> {
  return (value: unknown): value is T | undefined => {
    return isUndefined(value) || guard(value);
  };
}

export function createNullableGuard<T>(
  guard: TypeGuard<T>
): TypeGuard<T | null> {
  return (value: unknown): value is T | null => {
    return isNull(value) || guard(value);
  };
}

export function createNullishGuard<T>(
  guard: TypeGuard<T>
): TypeGuard<T | null | undefined> {
  return (value: unknown): value is T | null | undefined => {
    return isNullish(value) || guard(value);
  };
}

// Complex validation helpers
export function validateAndTransform<T, R>(
  value: unknown,
  guard: TypeGuard<T>,
  transform: (value: T) => R
): R | null {
  if (guard(value)) {
    return transform(value);
  }
  return null;
}

export function assertType<T>(
  value: unknown,
  guard: TypeGuard<T>,
  message?: string
): asserts value is T {
  if (!guard(value)) {
    throw new TypeError(message || `Type assertion failed`);
  }
}