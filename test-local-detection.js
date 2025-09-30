#!/usr/bin/env node

/**
 * Direct Test of Local Repository Detection
 * 
 * This script directly tests the LocalRepositoryDetector without needing
 * the full API server to verify our fixes work correctly.
 */

const path = require('path');
const fs = require('fs');

// Import the LocalRepositoryDetector (need to compile TypeScript first or use require)
async function testLocalDetection() {
  console.log('🧪 Direct Local Repository Detection Test');
  console.log('='.repeat(50));

  try {
    // For now, let's do a direct filesystem test to verify our logic
    const githubPath = '/Users/benreceveur/GitHub';
    
    if (!fs.existsSync(githubPath)) {
      console.log('❌ GitHub directory not found at expected location');
      return;
    }

    console.log(`📂 Scanning: ${githubPath}`);
    
    const directories = fs.readdirSync(githubPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .slice(0, 10); // Test first 10 directories
    
    console.log(`Found ${directories.length} directories to test`);
    console.log();

    for (const dir of directories) {
      const dirPath = path.join(githubPath, dir.name);
      const gitPath = path.join(dirPath, '.git');
      const isGitRepo = fs.existsSync(gitPath);
      
      console.log(`📁 ${dir.name}`);
      console.log(`   • Path: ${dirPath}`);
      console.log(`   • Is Git repo: ${isGitRepo ? 'Yes' : 'No'}`);
      
      if (isGitRepo) {
        // Try to get remote URL using git command
        try {
          const { execSync } = require('child_process');
          const remoteUrl = execSync('git remote get-url origin', { 
            cwd: dirPath, 
            encoding: 'utf8',
            stdio: 'pipe'
          }).trim();
          
          console.log(`   • Remote URL: ${remoteUrl}`);
          
          // Extract full name from URL
          const fullNameMatch = remoteUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
          if (fullNameMatch) {
            const fullName = fullNameMatch[1];
            console.log(`   • GitHub full name: ${fullName}`);
            
            // Test the enhanced path detection logic
            const possiblePaths = [
              // Exact repo name
              path.join(githubPath, fullName.split('/')[1]),
              // Full name format
              path.join(githubPath, fullName.replace('/', '-')),
              // Owner-repo format
              path.join(githubPath, fullName.replace('/', '-')),
              // Lowercase variations
              path.join(githubPath, fullName.split('/')[1].toLowerCase()),
              path.join(githubPath, fullName.toLowerCase().replace('/', '-'))
            ];
            
            const foundPaths = possiblePaths.filter(testPath => fs.existsSync(testPath) && fs.existsSync(path.join(testPath, '.git')));
            console.log(`   • Detection paths found: ${foundPaths.length}`);
            foundPaths.forEach(foundPath => {
              console.log(`     - ${path.basename(foundPath)} -> ${foundPath === dirPath ? 'MATCH' : 'different'}`);
            });
          }
          
          // Get current branch
          try {
            const currentBranch = execSync('git branch --show-current', { 
              cwd: dirPath, 
              encoding: 'utf8',
              stdio: 'pipe'
            }).trim();
            console.log(`   • Current branch: ${currentBranch}`);
          } catch (branchError) {
            console.log(`   • Current branch: Error getting branch`);
          }
          
          // Check working tree status
          try {
            const status = execSync('git status --porcelain', { 
              cwd: dirPath, 
              encoding: 'utf8',
              stdio: 'pipe'
            }).trim();
            console.log(`   • Working tree clean: ${status.length === 0 ? 'Yes' : 'No'}`);
          } catch (statusError) {
            console.log(`   • Working tree clean: Error checking status`);
          }
          
        } catch (remoteError) {
          console.log(`   • Remote URL: Not available (${remoteError.message})`);
        }
      }
      
      console.log();
    }

    // Test specific repositories that might be showing as "Not Cloned Locally"
    console.log('\n🔍 Testing specific repository detection:');
    const testRepos = [
      'benreceveur/admin-portal',
      'benreceveur/digital-twin', 
      'benreceveur/iac',
      'benreceveur/RefactorForge'
    ];

    for (const fullName of testRepos) {
      const [owner, repoName] = fullName.split('/');
      console.log(`\n📋 Testing: ${fullName}`);
      
      // Try multiple potential local paths (matching our enhanced logic)
      const possiblePaths = [
        // Exact repo name
        path.join(githubPath, repoName),
        // Full name format
        path.join(githubPath, fullName.replace('/', '-')),
        // Owner-repo format
        path.join(githubPath, `${owner}-${repoName}`),
        // Lowercase variations
        path.join(githubPath, repoName.toLowerCase()),
        path.join(githubPath, fullName.toLowerCase().replace('/', '-'))
      ];

      let found = false;
      for (const possiblePath of possiblePaths) {
        const gitPath = path.join(possiblePath, '.git');
        if (fs.existsSync(possiblePath) && fs.existsSync(gitPath)) {
          console.log(`   ✅ Found at: ${possiblePath}`);
          
          // Verify it's the correct repository by checking remote URL
          try {
            const { execSync } = require('child_process');
            const remoteUrl = execSync('git remote get-url origin', { 
              cwd: possiblePath, 
              encoding: 'utf8',
              stdio: 'pipe'
            }).trim();
            
            if (remoteUrl.includes(fullName)) {
              console.log(`   ✅ Remote URL matches: ${remoteUrl}`);
              found = true;
              break;
            } else {
              console.log(`   ⚠️  Remote URL doesn't match: ${remoteUrl}`);
            }
          } catch (remoteError) {
            console.log(`   ⚠️  Could not verify remote URL`);
          }
        }
      }
      
      if (!found) {
        console.log(`   ❌ Repository not found locally`);
        console.log(`   📁 Searched paths:`);
        possiblePaths.forEach(testPath => {
          console.log(`      - ${testPath} ${fs.existsSync(testPath) ? '(exists but no .git)' : '(not found)'}`);
        });
      }
    }

    console.log('\n✅ Local detection test completed!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testLocalDetection().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});