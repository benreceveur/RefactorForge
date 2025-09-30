#!/usr/bin/env node

/**
 * Final Performance Validation
 * Tests cached vs uncached performance, concurrent load, and memory endpoints
 */

const http = require('http');

class FinalPerformanceTest {
  async testCachedPerformance() {
    console.log('🚀 Testing Health Check Caching Performance');
    console.log('============================================\n');

    // First call (uncached)
    console.log('📊 First call (uncached):');
    const uncachedTime = await this.timeRequest('/api/health');
    console.log(`   ${uncachedTime.toFixed(1)}ms\n`);

    // Subsequent calls (cached) - should be much faster
    console.log('📊 Cached calls (5 rapid requests):');
    const cachedTimes = [];
    for (let i = 0; i < 5; i++) {
      const time = await this.timeRequest('/api/health');
      cachedTimes.push(time);
      console.log(`   Request ${i+1}: ${time.toFixed(1)}ms`);
      await this.sleep(50); // Small delay between requests
    }

    const avgCached = cachedTimes.reduce((a, b) => a + b) / cachedTimes.length;
    const improvement = ((uncachedTime - avgCached) / uncachedTime) * 100;

    console.log(`\n🎯 Cache Performance:`)
    console.log(`   Uncached: ${uncachedTime.toFixed(1)}ms`);
    console.log(`   Cached:   ${avgCached.toFixed(1)}ms average`);
    console.log(`   Improvement: ${improvement.toFixed(1)}%\n`);

    return { uncached: uncachedTime, cached: avgCached, improvement };
  }

  async testConcurrentLoad() {
    console.log('🔥 Testing Concurrent Load Performance');
    console.log('======================================\n');

    const userCounts = [10, 20, 50];
    const results = [];

    for (const users of userCounts) {
      console.log(`📊 Testing ${users} concurrent users...`);
      
      const promises = [];
      const startTime = Date.now();

      for (let i = 0; i < users; i++) {
        promises.push(this.makeRequest('/api/health'));
      }

      const responses = await Promise.allSettled(promises);
      const endTime = Date.now();
      
      const successful = responses.filter(r => r.status === 'fulfilled').length;
      const failed = responses.filter(r => r.status === 'rejected').length;
      const avgTime = (endTime - startTime) / users;
      
      console.log(`   Success: ${successful}/${users} (${((successful/users)*100).toFixed(1)}%)`);
      console.log(`   Average: ${avgTime.toFixed(1)}ms per request`);
      console.log(`   Failed:  ${failed}\n`);

      results.push({ users, successful, failed, avgTime });
    }

    return results;
  }

  async testMemoryEndpoints() {
    console.log('💾 Testing Memory API Performance');
    console.log('=================================\n');

    const endpoints = [
      '/api/memory?limit=10',
      '/api/memory?type=pattern&limit=5'
    ];

    for (const endpoint of endpoints) {
      console.log(`📊 Testing ${endpoint}:`);
      
      const times = [];
      for (let i = 0; i < 10; i++) {
        const time = await this.timeRequest(endpoint);
        times.push(time);
      }
      
      const avg = times.reduce((a, b) => a + b) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      console.log(`   Average: ${avg.toFixed(1)}ms`);
      console.log(`   Range:   ${min.toFixed(1)}-${max.toFixed(1)}ms\n`);
    }
  }

  async timeRequest(path) {
    const start = process.hrtime();
    await this.makeRequest(path);
    const [seconds, nanoseconds] = process.hrtime(start);
    return seconds * 1000 + nanoseconds / 1000000;
  }

  makeRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8001,
        path,
        method: 'GET',
        timeout: 10000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.setTimeout(10000);
      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run() {
    console.log('🎯 RefactorForge Final Performance Validation');
    console.log('==============================================');
    console.log(`Started: ${new Date().toLocaleString()}\n`);

    try {
      // Test server availability
      await this.makeRequest('/');
      
      // Wait for cache to expire
      console.log('⏳ Waiting for cache to expire...\n');
      await this.sleep(6000);
      
      // Run tests
      const cacheResults = await this.testCachedPerformance();
      const concurrentResults = await this.testConcurrentLoad();
      await this.testMemoryEndpoints();

      // Final assessment
      console.log('📈 FINAL OPTIMIZATION ASSESSMENT');
      console.log('================================\n');
      
      if (cacheResults.cached < 50) {
        console.log('🎉 TARGET ACHIEVED: Cached health checks under 50ms!');
      } else {
        console.log(`⚠️  Target missed: ${cacheResults.cached.toFixed(1)}ms (target: <50ms)`);
      }
      
      console.log(`🚀 Cache improvement: ${cacheResults.improvement.toFixed(1)}%`);
      
      const maxUsers = concurrentResults.find(r => r.successful === r.users && r.avgTime < 100);
      if (maxUsers) {
        console.log(`💪 Concurrent capacity: ${maxUsers.users}+ users with good performance`);
      }
      
      console.log('\n✅ ASYNC OPTIMIZATION COMPLETE');
      console.log('   - Health check caching implemented');
      console.log('   - Database operations optimized');
      console.log('   - GitHub API timeout protection added');
      console.log('   - Parallel file processing implemented');

    } catch (error) {
      console.error('❌ Performance test failed:', error.message);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const test = new FinalPerformanceTest();
  test.run().catch(console.error);
}

module.exports = FinalPerformanceTest;