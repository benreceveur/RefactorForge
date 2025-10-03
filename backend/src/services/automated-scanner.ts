import { GitHubScanner } from './github-scanner';
import { RecommendationEngine } from './recommendation-engine';
import { RepositoryAnalyzer } from './repository-analyzer';
import { dbAll, dbRun, dbGet } from '../utils/database-helpers';
import { logger } from '../utils/logger';
import { RepositoryRow } from '../types';

interface ScanSchedule {
  repositoryId: string;
  lastScanned: Date;
  nextScanDue: Date;
  scanInterval: number; // hours
  priority: 'high' | 'medium' | 'low';
}

interface ScanResult {
  repositoryId: string;
  success: boolean;
  newRecommendations: number;
  patternsFound: number;
  securityIssues: number;
  typeSafetyIssues: number;
  performanceIssues: number;
  error?: string;
}

/**
 * Automated Scanner Service
 *
 * Provides automated, periodic scanning of repositories to keep recommendations fresh.
 * Features:
 * - Scheduled repository scanning based on priority
 * - Automatic detection of code changes
 * - Fresh recommendation generation
 * - Old recommendation cleanup
 * - Performance monitoring
 */
export class AutomatedScanner {
  private scanner: GitHubScanner;
  private recommendationEngine: RecommendationEngine;
  private repositoryAnalyzer: RepositoryAnalyzer;
  private isRunning: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor(githubToken?: string) {
    this.scanner = new GitHubScanner(githubToken);
    this.recommendationEngine = new RecommendationEngine();
    this.repositoryAnalyzer = new RepositoryAnalyzer();
  }

  /**
   * Start automated scanning with configurable interval
   */
  async startAutomatedScanning(intervalMinutes: number = 60): Promise<void> {
    if (this.isRunning) {
      logger.info('Automated scanning is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`🚀 Starting automated scanning with ${intervalMinutes} minute interval`);

    // Initial scan
    await this.performScheduledScans();

    // Set up periodic scanning
    this.scanInterval = setInterval(async () => {
      await this.performScheduledScans();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automated scanning
   */
  stopAutomatedScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isRunning = false;
    logger.info('🛑 Automated scanning stopped');
  }

  /**
   * Perform scheduled scans for repositories due for refresh
   */
  private async performScheduledScans(): Promise<void> {
    logger.info('🔄 Starting scheduled repository scans');

    try {
      // Get repositories that need scanning
      const repositories = await this.getRepositoriesDueForScan();

      if (repositories.length === 0) {
        logger.info('No repositories due for scanning');
        return;
      }

      logger.info(`Found ${repositories.length} repositories due for scanning`);

      const results: ScanResult[] = [];

      for (const repo of repositories) {
        const result = await this.scanRepository(repo);
        results.push(result);

        // Update last scanned timestamp
        await this.updateRepositoryLastScanned(repo.id);

        // Small delay between repositories to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Log summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const totalNewRecommendations = results.reduce((sum, r) => sum + r.newRecommendations, 0);

      logger.info(`✅ Scan complete: ${successful} successful, ${failed} failed, ${totalNewRecommendations} new recommendations`);

      // Clean up old/stale recommendations
      await this.cleanupStaleRecommendations();

    } catch (error) {
      logger.error('❌ Error during scheduled scans:', { error: String(error) });
    }
  }

  /**
   * Scan a single repository and generate fresh recommendations
   */
  private async scanRepository(repo: RepositoryRow): Promise<ScanResult> {
    const result: ScanResult = {
      repositoryId: repo.id,
      success: false,
      newRecommendations: 0,
      patternsFound: 0,
      securityIssues: 0,
      typeSafetyIssues: 0,
      performanceIssues: 0
    };

    try {
      logger.info(`📊 Scanning repository: ${repo.full_name}`);

      // Parse repository info
      const parts = repo.full_name.split('/');
      const owner = parts[0] || 'unknown';
      const repoName = parts[1] || 'unknown';

      // Perform GitHub scan
      const scanResults = await this.scanner.scanRepository({
        owner,
        repo: repoName,
        branch: 'main'
      });

      if (!scanResults.scanSuccessful) {
        throw new Error(scanResults.errorMessage || 'Scan failed');
      }

      result.patternsFound = scanResults.patterns?.length || 0;
      result.securityIssues = Array.isArray(scanResults.securityIssues)
        ? scanResults.securityIssues.length
        : scanResults.securityIssues || 0;
      result.typeSafetyIssues = Array.isArray(scanResults.typeSafetyIssues)
        ? scanResults.typeSafetyIssues.length
        : scanResults.typeSafetyIssues || 0;
      result.performanceIssues = Array.isArray(scanResults.performanceIssues)
        ? scanResults.performanceIssues.length
        : scanResults.performanceIssues || 0;

      // Clear old recommendations
      await this.clearRepositoryRecommendations(repo.id);

      // Generate fresh recommendations based on scan
      const recommendations = await this.recommendationEngine.generateRecommendationsFromScan(
        repo.id,
        {
          securityIssues: scanResults.securityIssues || [],
          typeSafetyIssues: scanResults.typeSafetyIssues || [],
          performanceIssues: scanResults.performanceIssues || []
        }
      );

      result.newRecommendations = recommendations.length;
      result.success = true;

      // Update repository metadata
      await this.updateRepositoryMetadata(repo.id, {
        lastScanned: new Date().toISOString(),
        patternsCount: result.patternsFound,
        activeRecommendations: result.newRecommendations,
        securityIssues: result.securityIssues,
        typeSafetyIssues: result.typeSafetyIssues,
        performanceIssues: result.performanceIssues
      });

      logger.info(`✅ Successfully scanned ${repo.full_name}: ${result.newRecommendations} new recommendations`);

    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Failed to scan ${repo.full_name}:`, { error: String(error) });
    }

    return result;
  }

  /**
   * Get repositories that are due for scanning based on priority
   */
  private async getRepositoriesDueForScan(): Promise<RepositoryRow[]> {
    const now = new Date();

    // Define scan intervals based on repository activity/priority
    const HIGH_PRIORITY_HOURS = 4;    // Scan every 4 hours
    const MEDIUM_PRIORITY_HOURS = 12; // Scan every 12 hours
    const LOW_PRIORITY_HOURS = 24;    // Scan every 24 hours

    try {
      // Get all analyzed repositories
      const repositories = await dbAll(`
        SELECT * FROM repositories
        WHERE analysis_status = 'analyzed'
        ORDER BY last_analyzed ASC
      `) as RepositoryRow[];

      const repositoriesDue: RepositoryRow[] = [];

      for (const repo of repositories) {
        const lastScanned = repo.last_analyzed ? new Date(repo.last_analyzed) : new Date(0);
        const hoursSinceLastScan = (now.getTime() - lastScanned.getTime()) / (1000 * 60 * 60);

        // Determine priority based on patterns count and tech stack
        let scanInterval = MEDIUM_PRIORITY_HOURS;

        if (repo.patterns_count > 100 || repo.tech_stack.includes('react')) {
          scanInterval = HIGH_PRIORITY_HOURS;
        } else if (repo.patterns_count < 20) {
          scanInterval = LOW_PRIORITY_HOURS;
        }

        if (hoursSinceLastScan >= scanInterval) {
          repositoriesDue.push(repo);
        }
      }

      return repositoriesDue;

    } catch (error) {
      logger.error('Failed to get repositories due for scan:', { error: String(error) });
      return [];
    }
  }

  /**
   * Update repository's last scanned timestamp
   */
  private async updateRepositoryLastScanned(repositoryId: string): Promise<void> {
    await dbRun(
      `UPDATE repositories
       SET last_analyzed = ?, updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), new Date().toISOString(), repositoryId]
    );
  }

  /**
   * Update repository metadata after scan
   */
  private async updateRepositoryMetadata(
    repositoryId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const currentMetadata = await dbGet(
      'SELECT metadata FROM repositories WHERE id = ?',
      [repositoryId]
    ) as { metadata: string } | null;

    const existingMetadata = currentMetadata
      ? JSON.parse(currentMetadata.metadata || '{}')
      : {};

    const updatedMetadata = { ...existingMetadata, ...metadata };

    await dbRun(
      `UPDATE repositories
       SET metadata = ?, patterns_count = ?, updated_at = ?
       WHERE id = ?`,
      [
        JSON.stringify(updatedMetadata),
        metadata.patternsCount || 0,
        new Date().toISOString(),
        repositoryId
      ]
    );
  }

  /**
   * Clear old recommendations for a repository
   */
  private async clearRepositoryRecommendations(repositoryId: string): Promise<void> {
    await dbRun(
      'DELETE FROM repository_recommendations WHERE repository_id = ? AND status = ?',
      [repositoryId, 'active']
    );
  }

  /**
   * Clean up stale recommendations (mark as implemented or outdated)
   */
  private async cleanupStaleRecommendations(): Promise<void> {
    try {
      // Mark recommendations older than 30 days as outdated
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await dbRun(
        `UPDATE repository_recommendations
         SET status = 'outdated'
         WHERE status = 'active'
         AND created_at < ?`,
        [thirtyDaysAgo.toISOString()]
      ) as { changes?: number };

      if (result.changes && result.changes > 0) {
        logger.info(`Marked ${result.changes} recommendations as outdated`);
      }

      // Clean up duplicates
      await this.recommendationEngine.cleanupDuplicateRecommendations();

    } catch (error) {
      logger.error('Failed to cleanup stale recommendations:', { error: String(error) });
    }
  }

  /**
   * Manually trigger a scan for a specific repository
   */
  async scanRepositoryManually(repositoryId: string): Promise<ScanResult> {
    const repo = await dbGet(
      'SELECT * FROM repositories WHERE id = ?',
      [repositoryId]
    ) as RepositoryRow | null;

    if (!repo) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    return this.scanRepository(repo);
  }

  /**
   * Get scanning status and statistics
   */
  async getScanningStatus(): Promise<{
    isRunning: boolean;
    lastScanTime?: string;
    repositoriesScanned: number;
    totalRecommendations: number;
    nextScanDue?: string;
  }> {
    const stats = await dbGet(`
      SELECT
        COUNT(DISTINCT r.id) as repositoriesScanned,
        COUNT(rr.id) as totalRecommendations,
        MAX(r.last_analyzed) as lastScanTime
      FROM repositories r
      LEFT JOIN repository_recommendations rr ON r.id = rr.repository_id
      WHERE rr.status = 'active'
    `) as any;

    return {
      isRunning: this.isRunning,
      lastScanTime: stats?.lastScanTime,
      repositoriesScanned: stats?.repositoriesScanned || 0,
      totalRecommendations: stats?.totalRecommendations || 0
    };
  }
}