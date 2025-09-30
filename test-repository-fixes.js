#!/usr/bin/env node

/**
 * Test Script for Repository Detection Fixes
 * 
 * This script tests the enhanced repository detection functionality
 * to ensure all local repositories are properly detected and displayed.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

async function testRepositoryFixes() {
  console.log('🧪 Testing RefactorForge Repository Detection Fixes');
  console.log('='.repeat(60));

  try {
    // Test 1: Check local repository scanning
    console.log('\n📂 Test 1: Local Repository Scanning');
    try {
      const localScanResponse = await axios.get(`${API_BASE}/api/repositories/local/scan`);
      if (localScanResponse.data.success) {
        console.log(`✅ Local scan successful: ${localScanResponse.data.totalFound} directories found`);
        console.log(`   • Git repositories: ${localScanResponse.data.gitRepositories}`);
        console.log(`   • Non-git directories: ${localScanResponse.data.nonGitDirectories}`);
        console.log(`   • Errors: ${localScanResponse.data.errors.length}`);
      } else {
        console.log('❌ Local scan failed');
      }
    } catch (error) {
      console.log(`⚠️  Local scan endpoint not available: ${error.message}`);
    }

    // Test 2: Check repositories with local status
    console.log('\n🔍 Test 2: Repositories with Local Status');
    try {
      const reposResponse = await axios.get(`${API_BASE}/api/repositories/with-local-status`);
      const repositories = reposResponse.data;
      
      console.log(`✅ Retrieved ${repositories.length} repositories`);
      
      const locallyCloned = repositories.filter(repo => repo.isClonedLocally);
      const withDescriptions = repositories.filter(repo => repo.description && repo.description.trim() !== '');
      const withoutDescriptions = repositories.filter(repo => !repo.description || repo.description.trim() === '');

      console.log(`   • Locally cloned: ${locallyCloned.length}`);
      console.log(`   • With descriptions: ${withDescriptions.length}`);
      console.log(`   • Missing descriptions: ${withoutDescriptions.length}`);

      // Show first few repositories with details
      console.log('\n📊 Sample repositories:');
      repositories.slice(0, 5).forEach((repo, index) => {
        console.log(`   ${index + 1}. ${repo.fullName}`);
        console.log(`      • Language: ${repo.language}`);
        console.log(`      • Description: ${repo.description || 'None'}`);
        console.log(`      • Locally cloned: ${repo.isClonedLocally ? 'Yes' : 'No'}`);
        console.log(`      • Patterns: ${repo.patternsCount}`);
        if (repo.localStatus) {
          console.log(`      • Local branch: ${repo.localStatus.currentBranch || 'Unknown'}`);
          console.log(`      • Local changes: ${repo.localStatus.hasLocalChanges ? 'Yes' : 'No'}`);
        }
        console.log('');
      });

      if (withoutDescriptions.length > 0) {
        console.log(`\n⚠️  Repositories missing descriptions:`);
        withoutDescriptions.forEach(repo => {
          console.log(`   • ${repo.fullName} (${repo.language})`);
        });
      }

    } catch (error) {
      console.log(`❌ Failed to retrieve repositories: ${error.message}`);
    }

    // Test 3: Trigger repository rescan
    console.log('\n🔄 Test 3: Repository Rescan');
    try {
      const rescanResponse = await axios.post(`${API_BASE}/api/repositories/rescan-all`, {});
      if (rescanResponse.data.success) {
        console.log(`✅ Rescan successful`);
        console.log(`   • Total repositories: ${rescanResponse.data.summary.totalRepositories}`);
        console.log(`   • GitHub repositories: ${rescanResponse.data.summary.githubRepositories}`);
        console.log(`   • Local repositories: ${rescanResponse.data.summary.localRepositories}`);
        console.log(`   • Local-only repositories: ${rescanResponse.data.summary.localOnlyRepositories}`);
      } else {
        console.log(`❌ Rescan failed: ${rescanResponse.data.error}`);
      }
    } catch (error) {
      console.log(`⚠️  Rescan endpoint error: ${error.message}`);
    }

    // Test 4: Update metadata
    console.log('\n📝 Test 4: Update Repository Metadata');
    try {
      const updateResponse = await axios.post(`${API_BASE}/api/repositories/update-metadata`, {});
      if (updateResponse.data.success) {
        console.log(`✅ Metadata update successful`);
        console.log(`   • Updated: ${updateResponse.data.updated} repositories`);
        console.log(`   • Errors: ${updateResponse.data.errors}`);
      } else {
        console.log(`❌ Metadata update failed: ${updateResponse.data.error}`);
      }
    } catch (error) {
      console.log(`⚠️  Metadata update error: ${error.message}`);
    }

    // Test 5: Check specific local repositories
    console.log('\n🏠 Test 5: Specific Local Repository Detection');
    const githubPath = '/Users/benreceveur/GitHub';
    if (fs.existsSync(githubPath)) {
      const dirs = fs.readdirSync(githubPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .slice(0, 5); // Test first 5 directories
        
      for (const dir of dirs) {
        const dirPath = path.join(githubPath, dir.name);
        const gitPath = path.join(dirPath, '.git');
        const isGitRepo = fs.existsSync(gitPath);
        
        console.log(`   • ${dir.name}: ${isGitRepo ? 'Git repository' : 'Not a git repository'}`);
        
        if (isGitRepo) {
          try {
            const checkResponse = await axios.get(`${API_BASE}/api/repositories/local/check/benreceveur/${dir.name}`);
            console.log(`     - API check: ${checkResponse.data.isCloned ? 'Detected' : 'Not detected'}`);
          } catch (error) {
            console.log(`     - API check failed: ${error.message}`);
          }
        }
      }
    } else {
      console.log('   GitHub directory not found at expected location');
    }

    console.log('\n✅ Repository detection tests completed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testRepositoryFixes().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testRepositoryFixes };