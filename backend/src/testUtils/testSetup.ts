// Jest test setup file

// Mock secrets manager to return dummy secrets
jest.mock('../utils/secrets-manager', () => ({
  SecretsManager: jest.fn().mockImplementation((config) => ({
    getSecret: jest.fn().mockResolvedValue('test-secret'),
    getSecrets: jest.fn().mockResolvedValue({}),
    validateRequiredSecrets: jest.fn().mockResolvedValue(undefined),
    getCachedSecret: jest.fn().mockResolvedValue('test-secret'),
    clearCache: jest.fn(),
  })),
  AppSecrets: {
    initialize: jest.fn(),
    getGitHubToken: jest.fn().mockResolvedValue('test-github-token'),
    getGitHubWebhookSecret: jest.fn().mockResolvedValue('test-webhook-secret'),
    getJWTSecret: jest.fn().mockResolvedValue('test-jwt-secret'),
    getSessionSecret: jest.fn().mockResolvedValue('test-session-secret'),
    validateAllSecrets: jest.fn().mockResolvedValue(undefined),
  },
}));

// Suppress console logs
if (process.env.NODE_ENV === 'test' && !process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error,
  };
}
