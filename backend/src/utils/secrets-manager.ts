/**
 * Secrets Manager using Managed Identity
 * Supports Azure Key Vault, AWS Secrets Manager, and Google Secret Manager
 */

import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export interface SecretConfig {
  provider: 'azure' | 'aws' | 'gcp' | 'local';
  keyVaultUrl?: string;
  region?: string;
  projectId?: string;
}

export class SecretsManager {
  private azureClient?: SecretClient;
  private awsClient?: SecretsManagerClient;
  private gcpClient?: SecretManagerServiceClient;
  private config: SecretConfig;

  constructor(config: SecretConfig) {
    this.config = config;
    this.initializeClient();
  }

  private initializeClient(): void {
    switch (this.config.provider) {
      case 'azure':
        if (!this.config.keyVaultUrl) {
          throw new Error('Azure Key Vault URL is required');
        }
        const credential = new DefaultAzureCredential();
        this.azureClient = new SecretClient(this.config.keyVaultUrl, credential);
        break;

      case 'aws':
        this.awsClient = new SecretsManagerClient({
          region: this.config.region || 'us-east-1',
          credentials: fromNodeProviderChain(),
        });
        break;

      case 'gcp':
        this.gcpClient = new SecretManagerServiceClient();
        break;

      case 'local':
        // For development/testing only
        console.warn('Using local secrets manager - not recommended for production');
        break;

      default:
        throw new Error(`Unsupported secrets provider: ${this.config.provider}`);
    }
  }

  async getSecret(secretName: string): Promise<string> {
    try {
      switch (this.config.provider) {
        case 'azure':
          const azureSecret = await this.azureClient!.getSecret(secretName);
          if (!azureSecret.value) {
            throw new Error(`Secret ${secretName} has no value`);
          }
          return azureSecret.value;

        case 'aws':
          const awsResponse = await this.awsClient!.send(new GetSecretValueCommand({
            SecretId: secretName,
          }));
          if (!awsResponse.SecretString) {
            throw new Error(`Secret ${secretName} has no value`);
          }
          return awsResponse.SecretString;

        case 'gcp':
          const [gcpResponse] = await this.gcpClient!.accessSecretVersion({
            name: `projects/${this.config.projectId}/secrets/${secretName}/versions/latest`,
          });
          if (!gcpResponse.payload?.data) {
            throw new Error(`Secret ${secretName} has no value`);
          }
          return gcpResponse.payload.data.toString();

        case 'local':
          // Fallback to environment variables for local development
          const value = process.env[secretName.replace(/-/g, '_').toUpperCase()];
          if (!value) {
            throw new Error(`Local secret ${secretName} not found in environment`);
          }
          return value;

        default:
          throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
    } catch (error) {
      console.error(`Failed to retrieve secret ${secretName}:`, error);
      throw new Error(`Secret retrieval failed: ${secretName}`);
    }
  }

  async getSecrets(secretNames: string[]): Promise<Record<string, string>> {
    const secrets: Record<string, string> = {};
    
    // Retrieve secrets in parallel for better performance
    const promises = secretNames.map(async (name) => {
      try {
        const value = await this.getSecret(name);
        secrets[name] = value;
      } catch (error) {
        console.error(`Failed to get secret ${name}:`, error);
        throw error;
      }
    });

    await Promise.all(promises);
    return secrets;
  }

  async validateRequiredSecrets(requiredSecrets: string[]): Promise<void> {
    const missing: string[] = [];

    for (const secretName of requiredSecrets) {
      try {
        await this.getSecret(secretName);
      } catch (error) {
        missing.push(secretName);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required secrets: ${missing.join(', ')}`);
    }
  }

  // Cache secrets in memory for performance (with TTL)
  private secretCache = new Map<string, { value: string; expires: number }>();
  private cacheTTL = 300000; // 5 minutes

  async getCachedSecret(secretName: string): Promise<string> {
    const cached = this.secretCache.get(secretName);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    const value = await this.getSecret(secretName);
    this.secretCache.set(secretName, {
      value,
      expires: Date.now() + this.cacheTTL,
    });

    return value;
  }

  clearCache(): void {
    this.secretCache.clear();
  }
}

// Singleton instance
let secretsManager: SecretsManager;

export function initializeSecretsManager(config: SecretConfig): void {
  secretsManager = new SecretsManager(config);
}

export function getSecretsManager(): SecretsManager {
  if (!secretsManager) {
    throw new Error('SecretsManager not initialized. Call initializeSecretsManager() first.');
  }
  return secretsManager;
}

// Helper functions for common secrets
export class AppSecrets {
  private static manager: SecretsManager;

  static initialize(config: SecretConfig): void {
    this.manager = new SecretsManager(config);
  }

  static async getGitHubToken(): Promise<string> {
    return await this.manager.getCachedSecret('github-token');
  }

  static async getGitHubWebhookSecret(): Promise<string> {
    return await this.manager.getCachedSecret('github-webhook-secret');
  }

  static async getJWTSecret(): Promise<string> {
    return await this.manager.getCachedSecret('jwt-secret');
  }

  static async getSessionSecret(): Promise<string> {
    return await this.manager.getCachedSecret('session-secret');
  }

  static async getDatabaseEncryptionKey(): Promise<string> {
    return await this.manager.getCachedSecret('database-encryption-key');
  }

  static async getAdminAPIKey(): Promise<string> {
    return await this.manager.getCachedSecret('admin-api-key');
  }

  static async validateAllSecrets(): Promise<void> {
    const requiredSecrets = [
      'github-webhook-secret',
      'jwt-secret',
      'session-secret',
    ];

    const optionalSecrets = [
      'github-token',
      'database-encryption-key',
      'admin-api-key',
      'openai-api-key',
    ];

    // Validate required secrets
    await this.manager.validateRequiredSecrets(requiredSecrets);

    // Log missing optional secrets
    for (const secret of optionalSecrets) {
      try {
        await this.manager.getSecret(secret);
      } catch (error) {
        console.warn(`Optional secret '${secret}' not configured`);
      }
    }
  }
}

export default SecretsManager;