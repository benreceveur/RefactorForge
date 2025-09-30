import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';

export interface LocalRepositoryInfo {
  name: string;
  fullName: string;
  localPath: string;
  isGitRepository: boolean;
  remoteUrl?: string;
  currentBranch?: string;
  lastCommit?: string;
  isCleanWorkingTree?: boolean;
  hasUnpushedCommits?: boolean;
}

export interface LocalRepositoryDetectionResult {
  localRepositories: LocalRepositoryInfo[];
  totalFound: number;
  gitRepositories: number;
  nonGitDirectories: number;
  errors: string[];
}

/**
 * LocalRepositoryDetector - Detects and analyzes local Git repositories
 * 
 * This service scans the local GitHub directory to find all repositories
 * and determines their status, remote URLs, and synchronization state.
 */
export class LocalRepositoryDetector {
  private readonly githubBasePath: string;

  constructor(githubBasePath: string = '/Users/benreceveur/GitHub') {
    this.githubBasePath = githubBasePath;
  }

  /**
   * Scan the GitHub directory for all local repositories
   */
  async scanLocalRepositories(): Promise<LocalRepositoryDetectionResult> {
    const result: LocalRepositoryDetectionResult = {
      localRepositories: [],
      totalFound: 0,
      gitRepositories: 0,
      nonGitDirectories: 0,
      errors: []
    };

    try {
      if (!fs.existsSync(this.githubBasePath)) {
        result.errors.push(`GitHub base path does not exist: ${this.githubBasePath}`);
        return result;
      }

      logger.info(`🔍 Scanning for local repositories in: ${this.githubBasePath}`);

      const entries = fs.readdirSync(this.githubBasePath, { withFileTypes: true });
      const directories = entries.filter(entry => entry.isDirectory());

      result.totalFound = directories.length;

      for (const dir of directories) {
        try {
          const repoPath = path.join(this.githubBasePath, dir.name);
          const repoInfo = await this.analyzeRepository(repoPath);
          
          if (repoInfo) {
            result.localRepositories.push(repoInfo);
            if (repoInfo.isGitRepository) {
              result.gitRepositories++;
            } else {
              result.nonGitDirectories++;
            }
          }
        } catch (error) {
          result.errors.push(`Error analyzing ${dir.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      logger.info(`✅ Local repository scan complete: ${result.gitRepositories} git repos, ${result.nonGitDirectories} non-git dirs`);

    } catch (error) {
      const errorMessage = `Failed to scan GitHub directory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMessage);
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Analyze a single repository directory
   */
  private async analyzeRepository(repoPath: string): Promise<LocalRepositoryInfo | null> {
    const repoName = path.basename(repoPath);
    const gitPath = path.join(repoPath, '.git');
    
    const baseInfo: LocalRepositoryInfo = {
      name: repoName,
      fullName: `unknown/${repoName}`, // Will be updated if we find remote
      localPath: repoPath,
      isGitRepository: false
    };

    // Check if it's a git repository
    if (!fs.existsSync(gitPath)) {
      return baseInfo; // Return non-git directory info
    }

    baseInfo.isGitRepository = true;

    try {
      // Get remote URL
      const remoteUrl = this.getGitRemoteUrl(repoPath);
      if (remoteUrl) {
        baseInfo.remoteUrl = remoteUrl;
        baseInfo.fullName = this.extractFullNameFromUrl(remoteUrl) || baseInfo.fullName;
      }

      // Get current branch
      baseInfo.currentBranch = this.getCurrentBranch(repoPath);

      // Get last commit
      baseInfo.lastCommit = this.getLastCommitInfo(repoPath);

      // Check working tree status
      baseInfo.isCleanWorkingTree = this.isWorkingTreeClean(repoPath);

      // Check for unpushed commits
      baseInfo.hasUnpushedCommits = this.hasUnpushedCommits(repoPath);

    } catch (error) {
      logger.warn(`Warning analyzing git repository ${repoName}:`, { error: String(error) });
      // Return partial info even if some git operations fail
    }

    return baseInfo;
  }

  /**
   * Get git remote URL
   */
  private getGitRemoteUrl(repoPath: string): string | undefined {
    try {
      const result = execSync('git remote get-url origin', { 
        cwd: repoPath, 
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      return result || undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Extract full repository name from Git URL
   */
  private extractFullNameFromUrl(url: string): string | undefined {
    try {
      // Handle both SSH and HTTPS URLs
      // SSH: git@github.com:owner/repo.git
      // HTTPS: https://github.com/owner/repo.git
      
      let match = url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
      if (match) {
        return match[1];
      }
      
      // Handle other Git hosting services
      match = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
      return match ? match[1] : undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get current branch name
   */
  private getCurrentBranch(repoPath: string): string | undefined {
    try {
      const result = execSync('git branch --show-current', { 
        cwd: repoPath, 
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      return result || undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get last commit info
   */
  private getLastCommitInfo(repoPath: string): string | undefined {
    try {
      const result = execSync('git log -1 --pretty=format:"%h - %s (%cr)"', { 
        cwd: repoPath, 
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      return result || undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Check if working tree is clean
   */
  private isWorkingTreeClean(repoPath: string): boolean {
    try {
      const result = execSync('git status --porcelain', { 
        cwd: repoPath, 
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      return result.length === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if there are unpushed commits
   */
  private hasUnpushedCommits(repoPath: string): boolean {
    try {
      // First check if there's a remote tracking branch
      const trackingBranch = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { 
        cwd: repoPath, 
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      if (!trackingBranch) {
        return false; // No tracking branch
      }

      // Count commits ahead of remote
      const result = execSync('git rev-list --count @{u}..HEAD', { 
        cwd: repoPath, 
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      return parseInt(result) > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a specific repository exists locally
   * Enhanced to handle various naming patterns and remote URLs
   */
  async isRepositoryClonedLocally(fullName: string): Promise<boolean> {
    const [owner, repoName] = fullName.split('/');
    if (!owner || !repoName) return false;

    // Try multiple potential local paths
    const possiblePaths = [
      // Exact repo name
      path.join(this.githubBasePath, repoName),
      // Full name format
      path.join(this.githubBasePath, fullName.replace('/', '-')),
      // Owner-repo format
      path.join(this.githubBasePath, `${owner}-${repoName}`),
      // Lowercase variations
      path.join(this.githubBasePath, repoName.toLowerCase()),
      path.join(this.githubBasePath, fullName.toLowerCase().replace('/', '-'))
    ];

    for (const possiblePath of possiblePaths) {
      const gitPath = path.join(possiblePath, '.git');
      if (fs.existsSync(possiblePath) && fs.existsSync(gitPath)) {
        // Verify it's the correct repository by checking remote URL
        const remoteUrl = this.getGitRemoteUrl(possiblePath);
        if (remoteUrl && remoteUrl.includes(fullName)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get local repository info by name
   * Enhanced to handle various naming patterns
   */
  async getLocalRepositoryInfo(fullName: string): Promise<LocalRepositoryInfo | null> {
    const [owner, repoName] = fullName.split('/');
    if (!owner || !repoName) return null;

    // Try multiple potential local paths (same as isRepositoryClonedLocally)
    const possiblePaths = [
      // Exact repo name
      path.join(this.githubBasePath, repoName),
      // Full name format
      path.join(this.githubBasePath, fullName.replace('/', '-')),
      // Owner-repo format
      path.join(this.githubBasePath, `${owner}-${repoName}`),
      // Lowercase variations
      path.join(this.githubBasePath, repoName.toLowerCase()),
      path.join(this.githubBasePath, fullName.toLowerCase().replace('/', '-'))
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        const repoInfo = await this.analyzeRepository(possiblePath);
        if (repoInfo && repoInfo.isGitRepository) {
          // Verify it's the correct repository by checking remote URL
          const remoteUrl = this.getGitRemoteUrl(possiblePath);
          if (remoteUrl && remoteUrl.includes(fullName)) {
            return repoInfo;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Validate local repository status against GitHub repository
   */
  async validateRepositorySync(fullName: string): Promise<{
    isCloned: boolean;
    remoteMatches: boolean;
    hasLocalChanges: boolean;
    needsPush: boolean;
    localInfo?: LocalRepositoryInfo;
  }> {
    const localInfo = await this.getLocalRepositoryInfo(fullName);
    
    if (!localInfo || !localInfo.isGitRepository) {
      return {
        isCloned: false,
        remoteMatches: false,
        hasLocalChanges: false,
        needsPush: false
      };
    }

    const expectedUrl = `https://github.com/${fullName}.git`;
    const remoteMatches = localInfo.remoteUrl?.includes(fullName) || false;

    return {
      isCloned: true,
      remoteMatches,
      hasLocalChanges: !localInfo.isCleanWorkingTree,
      needsPush: localInfo.hasUnpushedCommits || false,
      localInfo
    };
  }
}