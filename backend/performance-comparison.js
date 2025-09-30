#!/usr/bin/env node

/**
 * Performance Comparison Report
 * Shows before/after optimization results
 */

const fs = require('fs');

function loadBaseline(filename) {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Could not load ${filename}:`, error.message);
    return null;
  }
}

function generateComparisonReport() {
  console.log('🎯 ASYNC OPTIMIZATION RESULTS COMPARISON');
  console.log('=========================================\n');

  // Find baseline files
  const files = fs.readdirSync('.').filter(f => f.startsWith('performance-baseline-'));
  
  if (files.length < 2) {
    console.log('❌ Need at least 2 baseline files for comparison');
    return;
  }

  // Sort by timestamp (filename contains timestamp)
  files.sort();
  const beforeFile = files[0];
  const afterFile = files[files.length - 1];

  const before = loadBaseline(beforeFile);
  const after = loadBaseline(afterFile);

  if (!before || !after) return;

  console.log(`📊 BEFORE: ${new Date(before.timestamp).toLocaleString()}`);
  console.log(`📊 AFTER:  ${new Date(after.timestamp).toLocaleString()}\n`);

  // Health Check Comparison
  const healthBefore = before.healthCheck.average;
  const healthAfter = after.healthCheck.average;
  const healthImprovement = ((healthBefore - healthAfter) / healthBefore) * 100;

  console.log('🔍 HEALTH CHECK ENDPOINT:');
  console.log(`   Before: ${healthBefore.toFixed(1)}ms average`);
  console.log(`   After:  ${healthAfter.toFixed(1)}ms average`);
  console.log(`   Change: ${healthImprovement > 0 ? '🟢' : '🔴'} ${healthImprovement.toFixed(1)}% ${healthImprovement > 0 ? 'improvement' : 'regression'}\n`);

  // Memory API Comparison
  const memoryBefore = before.memory.average;
  const memoryAfter = after.memory.average;
  const memoryImprovement = ((memoryBefore - memoryAfter) / memoryBefore) * 100;

  console.log('💾 MEMORY API ENDPOINT:');
  console.log(`   Before: ${memoryBefore.toFixed(1)}ms average`);
  console.log(`   After:  ${memoryAfter.toFixed(1)}ms average`);
  console.log(`   Change: ${memoryImprovement > 0 ? '🟢' : '🔴'} ${memoryImprovement.toFixed(1)}% ${memoryImprovement > 0 ? 'improvement' : 'regression'}\n`);

  // Concurrent Load Comparison
  const concurrentBefore = before.concurrentLoad.avgResponseTime;
  const concurrentAfter = after.concurrentLoad.avgResponseTime;
  const concurrentImprovement = ((concurrentBefore - concurrentAfter) / concurrentBefore) * 100;

  console.log('🔥 CONCURRENT LOAD (20 users):');
  console.log(`   Before: ${concurrentBefore.toFixed(1)}ms average`);
  console.log(`   After:  ${concurrentAfter.toFixed(1)}ms average`);
  console.log(`   Change: ${concurrentImprovement > 0 ? '🟢' : '🔴'} ${concurrentImprovement.toFixed(1)}% ${concurrentImprovement > 0 ? 'improvement' : 'regression'}\n`);

  // Overall Assessment
  console.log('📈 OVERALL ASSESSMENT:');
  const overallScore = (healthImprovement + concurrentImprovement) / 2;
  
  if (overallScore > 10) {
    console.log('   🎉 EXCELLENT: Significant performance improvements achieved');
  } else if (overallScore > 5) {
    console.log('   ✅ GOOD: Noticeable performance improvements');
  } else if (overallScore > 0) {
    console.log('   🟡 MODERATE: Some performance improvements');
  } else {
    console.log('   ❌ POOR: No significant improvements or regression');
  }

  // Recommendations
  console.log('\n🚀 OPTIMIZATION IMPACT SUMMARY:');
  console.log('================================');
  console.log('✅ Database operations converted to async helpers');
  console.log('✅ GitHub API calls optimized with timeout protection');  
  console.log('✅ Parallel file processing implemented in GitHub scanner');
  console.log('✅ All callback patterns replaced with async/await');
  
  if (healthAfter > 100) {
    console.log('\n⚠️  FURTHER OPTIMIZATION OPPORTUNITIES:');
    console.log('   • Consider caching GitHub API responses');
    console.log('   • Add database connection pooling');
    console.log('   • Implement health check caching (5-10 second TTL)');
  }

  console.log(`\n🎯 Target: <50ms health checks (Currently: ${healthAfter.toFixed(1)}ms)`);
}

generateComparisonReport();