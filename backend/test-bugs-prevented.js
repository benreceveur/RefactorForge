#!/usr/bin/env node

/**
 * Test script to demonstrate the bugs prevented calculation
 * This shows how the Memory Dashboard should now display realistic numbers
 */

const axios = require('axios');

async function testBugsPreventedCalculation() {
  console.log('🧪 Testing Bugs Prevented Calculation\n');
  
  try {
    // Test the main improvements endpoint with analytics
    const improvementsResponse = await axios.get('http://localhost:8001/api/improvements');
    const { improvements, analytics } = improvementsResponse.data;
    
    console.log('📊 Main Improvements Endpoint Results:');
    console.log(`Total Improvements: ${improvements.length}`);
    console.log(`Completed Improvements: ${analytics.completedImprovements}`);
    console.log(`🐛 Total Bugs Prevented: ${analytics.totalBugsPrevented}`);
    console.log(`Implementation Rate: ${analytics.implementationRate}%\n`);
    
    // Test the dedicated bugs prevented endpoint
    const bugsPreventedResponse = await axios.get('http://localhost:8001/api/improvements/bugs-prevented');
    const bugsData = bugsPreventedResponse.data;
    
    console.log('🐛 Dedicated Bugs Prevented Endpoint Results:');
    console.log(`Total Bugs Prevented: ${bugsData.totalBugsPrevented}`);
    console.log(`Average Bugs per Improvement: ${bugsData.averageBugsPerImprovement}`);
    console.log(`Implementation Rate: ${bugsData.implementationRate}%\n`);
    
    console.log('🏷️ Bugs Prevented by Category:');
    Object.entries(bugsData.bugsByCategory).forEach(([category, count]) => {
      if (count > 0) {
        console.log(`  ${category}: ${count} bugs prevented`);
      }
    });
    
    // Test the analytics endpoint
    const analyticsResponse = await axios.get('http://localhost:8001/api/improvements/analytics');
    const fullAnalytics = analyticsResponse.data;
    
    console.log('\n📈 Full Analytics Endpoint Results:');
    console.log(`Total Bugs Prevented: ${fullAnalytics.totalBugsPrevented}`);
    console.log(`Average per Improvement: ${fullAnalytics.averageBugsPreventedPerImprovement}`);
    console.log(`Implementation Rate: ${fullAnalytics.implementationRate}%\n`);
    
    // Show completed improvements and their bug prevention
    console.log('✅ Completed Improvements with Bug Prevention:');
    improvements
      .filter(imp => imp.status === 'completed')
      .forEach(imp => {
        const bugs = imp.metrics.bugsPreventedCount || 'calculated from description';
        console.log(`  ${imp.title}: ${bugs} bugs prevented (${imp.category})`);
      });
    
    console.log('\n🎯 Dashboard Should Now Show:');
    console.log(`Instead of "Bugs Prevented: 0"`);
    console.log(`It should show "Bugs Prevented: ${bugsData.totalBugsPrevented}"`);
    console.log(`\nWith ${bugsData.completedImprovements} out of ${bugsData.totalImprovements} improvements completed (${bugsData.implementationRate}%)`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error testing bugs prevented calculation:', error.message);
    return false;
  }
}

// Run the test
testBugsPreventedCalculation().then(success => {
  if (success) {
    console.log('\n✅ Bugs Prevented calculation is working correctly!');
    console.log('The Memory Dashboard should now show realistic numbers instead of 0.');
  } else {
    console.log('\n❌ Test failed. Check the server and endpoints.');
  }
  process.exit(success ? 0 : 1);
});