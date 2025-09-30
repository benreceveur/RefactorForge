#!/usr/bin/env node

/**
 * Test script to verify repository clone status detection
 * This simulates what the frontend should now be doing correctly
 */

const { LocalRepositoryDetector } = require('./backend/src/services/local-repository-detector.js');

async function testRepositoryCloneStatus() {
  const detector = new LocalRepositoryDetector();
  
  console.log('🧪 Testing Repository Clone Status Detection\n');
  
  // Test the repositories you mentioned are showing "Clone Required"
  const testRepos = [
    'IntelliPact/admin-portal',
    'IntelliPact/digital-twin', 
    'IntelliPact/iac',
    'IntelliPact/azfunc',
    'benreceveur/bMigrate'  // This might be under your personal account
  ];
  
  const results = [];
  
  for (const fullName of testRepos) {
    try {
      console.log(`🔍 Testing: ${fullName}`);
      const validation = await detector.validateRepositorySync(fullName);
      
      console.log(`   📋 Results:`);
      console.log(`   - isCloned: ${validation.isCloned}`);
      console.log(`   - remoteMatches: ${validation.remoteMatches}`);
      console.log(`   - hasLocalChanges: ${validation.hasLocalChanges}`);
      console.log(`   - needsPush: ${validation.needsPush}`);
      
      if (validation.localInfo) {
        console.log(`   - localPath: ${validation.localInfo.localPath}`);
        console.log(`   - currentBranch: ${validation.localInfo.currentBranch}`);
        console.log(`   - remoteUrl: ${validation.localInfo.remoteUrl}`);
      }
      
      results.push({
        repository: fullName,
        ...validation
      });
      
      console.log('');
    } catch (error) {
      console.error(`   ❌ Error testing ${fullName}:`, error.message);
      results.push({
        repository: fullName,
        error: error.message,
        isCloned: false,
        remoteMatches: false
      });
      console.log('');
    }
  }
  
  // Summary
  console.log('📊 Summary:');
  console.log('========================================');
  
  const clonedCount = results.filter(r => r.isCloned).length;
  const matchingCount = results.filter(r => r.remoteMatches).length;
  
  console.log(`Total repositories tested: ${results.length}`);
  console.log(`Repositories cloned locally: ${clonedCount}`);
  console.log(`Repositories with matching remotes: ${matchingCount}`);
  console.log('');
  
  // Show what the frontend should display
  console.log('🎨 Frontend Display Status:');
  console.log('========================================');
  
  results.forEach(result => {
    const shouldShowAnalyzeButton = result.isCloned && result.remoteMatches;
    const displayStatus = shouldShowAnalyzeButton ? '✅ ANALYZE BUTTON' : '⚠️  CLONE REQUIRED';
    console.log(`${result.repository}: ${displayStatus}`);
  });
  
  console.log('\n🔧 Fix Applied:');
  console.log('- Removed hardcoded repository list from frontend');
  console.log('- Frontend now uses repo.isClonedLocally from API data'); 
  console.log('- API endpoint /api/repositories/with-local-status provides correct status');
  console.log('- Local repository detector validates against correct organization names');
  
  return results;
}

// Run the test
if (require.main === module) {
  testRepositoryCloneStatus()
    .then(results => {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testRepositoryCloneStatus };