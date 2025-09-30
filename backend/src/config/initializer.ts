
import { AppSecrets } from '../utils/secrets-manager';
import { getSecretsConfig, validateEnvironmentConfiguration } from './secrets-config';
import { setupGlobalErrorHandlers } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { initDatabase } from '../database';

/**
 * Initializes the RefactorForge application with secure configuration
 */
export async function initializeApplication() {
  logger.info(`📂 Working directory: ${process.cwd()}`);
  
  // Setup global error handlers first
  setupGlobalErrorHandlers();
  
  // Initialize secrets manager
  try {
    validateEnvironmentConfiguration();
    const secretsConfig = getSecretsConfig();
    AppSecrets.initialize(secretsConfig);
    logger.info(`🔐 Secrets manager initialized: ${secretsConfig.provider}`);
    
    // Validate all required secrets are available
    await AppSecrets.validateAllSecrets();
    logger.info('✅ All required secrets validated');
  } catch (error) {
    logger.error('❌ Failed to initialize secrets manager:', { error: String(error) });
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // Initialize database
  initDatabase();
}
