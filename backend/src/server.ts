
import app from './app';
import { logger } from './utils/logger';
import { getSecretsConfig } from './config/secrets-config';
import { initializeApplication } from './config/initializer';

const PORT = process.env.PORT || 8001;

/**
 * Starts the RefactorForge server with comprehensive initialization
 */
export async function startServer() {
  try {
    // Initialize secrets and other async resources
    await initializeApplication();
    
    const server = app.listen(PORT, () => {
      logger.info(`🚀 RefactorForge Backend running on port ${PORT}`);
      logger.info(`📍 Health check: http://localhost:${PORT}/api/health`);
      logger.info(`🔐 Secrets provider: ${getSecretsConfig().provider}`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Graceful shutdown starting...`);
      
      server.close((err) => {
        if (err) {
          logger.error('Error during server shutdown:', { error: String(err) });
          process.exit(1);
        }
        
        logger.info('Server closed. Exiting process.');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('❌ Failed to start server:', { error: String(error) });
    process.exit(1);
  }
}
