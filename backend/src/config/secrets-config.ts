/**
 * Secrets Configuration for Different Environments
 * Auto-detects cloud provider and configures managed identity
 */

import { SecretConfig } from '../utils/secrets-manager';

export function getSecretsConfig(): SecretConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Auto-detect cloud environment
  if (process.env.AZURE_CLIENT_ID || process.env.MSI_ENDPOINT) {
    // Running on Azure with managed identity
    return {
      provider: 'azure',
      keyVaultUrl: process.env.AZURE_KEY_VAULT_URL || 
                   `https://${process.env.AZURE_KEY_VAULT_NAME}.vault.azure.net/`,
    };
  }
  
  if (process.env.AWS_REGION || process.env.AWS_EXECUTION_ENV) {
    // Running on AWS with IAM roles
    return {
      provider: 'aws',
      region: process.env.AWS_REGION || 'us-east-1',
    };
  }
  
  if (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT) {
    // Running on Google Cloud with service accounts
    return {
      provider: 'gcp',
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
    };
  }
  
  // Default to local for development
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    console.warn('Using local secrets manager for development');
    return {
      provider: 'local',
    };
  }
  
  throw new Error(
    'Could not detect cloud environment for managed identity. ' +
    'Please set appropriate environment variables or configure manually.'
  );
}

export const REQUIRED_SECRETS = [
  'github-webhook-secret',
  'jwt-secret',
  'session-secret',
] as const;

export const OPTIONAL_SECRETS = [
  'github-token',
  'database-encryption-key', 
  'admin-api-key',
  'openai-api-key',
  'memory-api-token',
] as const;

export const SECRET_NAMES = {
  GITHUB_TOKEN: 'github-token',
  GITHUB_WEBHOOK_SECRET: 'github-webhook-secret',
  JWT_SECRET: 'jwt-secret',
  SESSION_SECRET: 'session-secret',
  DATABASE_ENCRYPTION_KEY: 'database-encryption-key',
  ADMIN_API_KEY: 'admin-api-key',
  OPENAI_API_KEY: 'openai-api-key',
  MEMORY_API_TOKEN: 'memory-api-token',
} as const;

// Cloud-specific configurations
export const AZURE_CONFIG = {
  // Azure Key Vault secret naming (lowercase, no underscores)
  SECRET_MAPPING: {
    'github-token': 'github-token',
    'github-webhook-secret': 'github-webhook-secret',
    'jwt-secret': 'jwt-secret',
    'session-secret': 'session-secret',
    'database-encryption-key': 'database-encryption-key',
    'admin-api-key': 'admin-api-key',
    'openai-api-key': 'openai-api-key',
  },
  
  // Required Azure environment variables
  REQUIRED_ENV_VARS: [
    'AZURE_KEY_VAULT_URL', // or AZURE_KEY_VAULT_NAME
  ],
};

export const AWS_CONFIG = {
  // AWS Secrets Manager secret ARNs or names
  SECRET_MAPPING: {
    'github-token': 'refactorforge/github-token',
    'github-webhook-secret': 'refactorforge/github-webhook-secret', 
    'jwt-secret': 'refactorforge/jwt-secret',
    'session-secret': 'refactorforge/session-secret',
    'database-encryption-key': 'refactorforge/database-encryption-key',
    'admin-api-key': 'refactorforge/admin-api-key',
    'openai-api-key': 'refactorforge/openai-api-key',
  },
  
  // Required AWS environment variables (auto-detected in most cases)
  REQUIRED_ENV_VARS: [
    // 'AWS_REGION', // Usually auto-detected
  ],
};

export const GCP_CONFIG = {
  // Google Secret Manager secret names
  SECRET_MAPPING: {
    'github-token': 'github-token',
    'github-webhook-secret': 'github-webhook-secret',
    'jwt-secret': 'jwt-secret', 
    'session-secret': 'session-secret',
    'database-encryption-key': 'database-encryption-key',
    'admin-api-key': 'admin-api-key',
    'openai-api-key': 'openai-api-key',
  },
  
  // Required GCP environment variables
  REQUIRED_ENV_VARS: [
    'GOOGLE_CLOUD_PROJECT', // or GCLOUD_PROJECT
  ],
};

// Development fallback configuration
export const LOCAL_CONFIG = {
  // Map to environment variables for local development
  SECRET_MAPPING: {
    'github-token': 'GITHUB_TOKEN',
    'github-webhook-secret': 'GITHUB_WEBHOOK_SECRET',
    'jwt-secret': 'JWT_SECRET',
    'session-secret': 'SESSION_SECRET',
    'database-encryption-key': 'DATABASE_ENCRYPTION_KEY',
    'admin-api-key': 'ADMIN_API_KEY',
    'openai-api-key': 'OPENAI_API_KEY',
  },
};

export function validateEnvironmentConfiguration(): void {
  const config = getSecretsConfig();
  
  switch (config.provider) {
    case 'azure':
      if (!config.keyVaultUrl) {
        throw new Error('Azure Key Vault URL is required');
      }
      break;
      
    case 'aws':
      // AWS configuration is usually auto-detected
      break;
      
    case 'gcp':
      if (!config.projectId) {
        throw new Error('Google Cloud Project ID is required');
      }
      break;
      
    case 'local':
      console.warn('Using local environment variables for secrets');
      break;
  }
}