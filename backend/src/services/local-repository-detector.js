const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * LocalRepositoryDetector - Detects and analyzes local Git repositories
 * 
 * This service scans the local GitHub directory to find all repositories
 * and determines their status, remote URLs, and synchronization state.
 */
class LocalRepositoryDetector {
  constructor(githubBasePath = '/Users/benreceveur/GitHub') {
    this.githubBasePath = githubBasePath;
  }

  /**
   * Scan the GitHub directory for all local repositories
   */
  async scanLocalRepositories() {
    const result = {
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

      console.log(`🔍 Scanning for local repositories in: ${this.githubBasePath}`);

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
          result.errors.push(`Error analyzing ${dir.name}: ${error.message || 'Unknown error'}`);
        }
      }

      console.log(`✅ Local repository scan complete: ${result.gitRepositories} git repos, ${result.nonGitDirectories} non-git dirs`);

    } catch (error) {
      const errorMessage = `Failed to scan GitHub directory: ${error.message || 'Unknown error'}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Analyze a single repository directory
   */
  async analyzeRepository(repoPath) {
    const repoName = path.basename(repoPath);
    const gitPath = path.join(repoPath, '.git');
    
    const baseInfo = {
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
      console.warn(`Warning analyzing git repository ${repoName}:`, error);
      // Return partial info even if some git operations fail
    }

    return baseInfo;
  }

  /**
   * Get git remote URL
   */
  getGitRemoteUrl(repoPath) {
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
  extractFullNameFromUrl(url) {
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
  getCurrentBranch(repoPath) {
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
  getLastCommitInfo(repoPath) {
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
  isWorkingTreeClean(repoPath) {
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
  hasUnpushedCommits(repoPath) {
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
   */
  async isRepositoryClonedLocally(fullName) {
    const repoName = fullName.split('/')[1];
    if (!repoName) return false;

    const expectedPath = path.join(this.githubBasePath, repoName);
    const gitPath = path.join(expectedPath, '.git');
    
    return fs.existsSync(expectedPath) && fs.existsSync(gitPath);
  }

  /**
   * Get local repository info by name
   */
  async getLocalRepositoryInfo(fullName) {
    const repoName = fullName.split('/')[1];
    if (!repoName) return null;

    const repoPath = path.join(this.githubBasePath, repoName);
    
    if (!fs.existsSync(repoPath)) {
      return null;
    }

    return this.analyzeRepository(repoPath);
  }

  /**
   * Validate local repository status against GitHub repository
   */
  async validateRepositorySync(fullName) {
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

module.exports = { LocalRepositoryDetector };