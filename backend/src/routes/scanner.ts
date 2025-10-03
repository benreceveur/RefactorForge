import { Router, Request, Response } from 'express';
import { AutomatedScanner } from '../services/automated-scanner';
import { logger } from '../utils/logger';

const router = Router();

// Initialize automated scanner instance (singleton)
let automatedScanner: AutomatedScanner | null = null;

/**
 * Initialize the automated scanner if not already initialized
 */
function initializeScanner(): AutomatedScanner {
  if (!automatedScanner) {
    automatedScanner = new AutomatedScanner(process.env.GITHUB_TOKEN);
  }
  return automatedScanner;
}

/**
 * GET /api/scanner/status - Get automated scanner status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const scanner = initializeScanner();
    const status = await scanner.getScanningStatus();

    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error('Failed to get scanner status:', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to get scanner status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scanner/start - Start automated scanning
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { intervalMinutes = 60 } = req.body;

    const scanner = initializeScanner();
    await scanner.startAutomatedScanning(intervalMinutes);

    res.json({
      success: true,
      message: `Automated scanning started with ${intervalMinutes} minute interval`,
      intervalMinutes
    });
  } catch (error) {
    logger.error('Failed to start automated scanning:', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to start automated scanning',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scanner/stop - Stop automated scanning
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    const scanner = initializeScanner();
    scanner.stopAutomatedScanning();

    res.json({
      success: true,
      message: 'Automated scanning stopped'
    });
  } catch (error) {
    logger.error('Failed to stop automated scanning:', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to stop automated scanning',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scanner/scan/:repositoryId - Manually trigger scan for a repository
 */
router.post('/scan/:repositoryId', async (req: Request, res: Response) => {
  try {
    const { repositoryId } = req.params;

    if (!repositoryId) {
      return res.status(400).json({
        success: false,
        error: 'Repository ID is required'
      });
    }

    const scanner = initializeScanner();
    const result = await scanner.scanRepositoryManually(repositoryId);

    res.json({
      success: true,
      message: `Repository ${repositoryId} scanned`,
      result
    });
  } catch (error) {
    logger.error('Failed to scan repository:', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to scan repository',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scanner/scan-all - Trigger immediate scan of all repositories
 */
router.post('/scan-all', async (req: Request, res: Response) => {
  try {
    const scanner = initializeScanner();

    // Start the scan asynchronously
    setImmediate(async () => {
      try {
        await scanner['performScheduledScans'](); // Access private method for immediate scan
        logger.info('Completed immediate scan of all repositories');
      } catch (error) {
        logger.error('Error during immediate scan:', { error: String(error) });
      }
    });

    res.json({
      success: true,
      message: 'Immediate scan of all repositories initiated',
      note: 'Scan is running in the background'
    });
  } catch (error) {
    logger.error('Failed to initiate scan-all:', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to initiate scan-all',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Auto-start scanner if enabled via environment variable
if (process.env.AUTO_SCANNER_ENABLED === 'true') {
  const intervalMinutes = parseInt(process.env.AUTO_SCANNER_INTERVAL || '60');
  logger.info(`🚀 Auto-starting scanner with ${intervalMinutes} minute interval`);

  setTimeout(() => {
    const scanner = initializeScanner();
    scanner.startAutomatedScanning(intervalMinutes)
      .then(() => logger.info('✅ Automated scanner started successfully'))
      .catch((error) => logger.error('❌ Failed to auto-start scanner:', { error: String(error) }));
  }, 5000); // Delay startup by 5 seconds to let server initialize
}

export default router;