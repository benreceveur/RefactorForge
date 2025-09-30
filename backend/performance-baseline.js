#!/usr/bin/env node

/**
 * Performance Baseline Monitor
 * Captures current performance metrics before async optimization
 */

const http = require('http');

class PerformanceBaseline {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      healthCheck: { times: [], average: 0, min: 0, max: 0 },
      memory: { times: [], average: 0, min: 0, max: 0 },
      concurrentLoad: { users: 0, avgResponseTime: 0, errors: 0 }
    };
  }

  async measureEndpoint(path, samples = 10) {
    console.log(`📊 Measuring ${path} (${samples} samples)...`);
    const times = [];

    for (let i = 0; i < samples; i++) {
      const start = process.hrtime();
      
      try {
        await this.makeRequest(path);
        const [seconds, nanoseconds] = process.hrtime(start);
        const milliseconds = seconds * 1000 + nanoseconds / 1000000;
        times.push(milliseconds);
        
        if (i % 3 === 0) process.stdout.write('.');
      } catch (error) {
        console.error(`Error measuring ${path}:`, error.message);
        times.push(999999); // Mark as failed
      }
    }

    console.log(''); // New line
    return {
      times,
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times)
    };
  }

  makeRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8001,
        path,
        method: 'GET',
        timeout: 5000
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
      req.setTimeout(5000);
      req.end();
    });
  }

  async measureConcurrentLoad(users = 10) {
    console.log(`🔥 Testing concurrent load (${users} users)...`);
    
    const promises = [];
    const startTime = Date.now();

    for (let i = 0; i < users; i++) {
      promises.push(this.makeRequest('/api/health'));
    }

    const results = await Promise.allSettled(promises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const errors = results.filter(r => r.status === 'rejected').length;

    return {
      users,
      totalTime,
      avgResponseTime: totalTime / users,
      successful,
      errors,
      successRate: (successful / users) * 100
    };
  }

  async run() {
    console.log('🎯 RefactorForge Performance Baseline Measurement');
    console.log('================================================');
    console.log(`Started at: ${new Date().toLocaleString()}\n`);

    try {
      // Test server availability
      console.log('🔌 Testing server connection...');
      await this.makeRequest('/');
      console.log('✅ Server is responding\n');

      // Measure individual endpoints
      this.results.healthCheck = await this.measureEndpoint('/api/health', 20);
      console.log(`Health Check: ${this.results.healthCheck.average.toFixed(1)}ms avg (${this.results.healthCheck.min.toFixed(1)}-${this.results.healthCheck.max.toFixed(1)}ms)\n`);

      this.results.memory = await this.measureEndpoint('/api/memory?limit=10', 20);
      console.log(`Memory API: ${this.results.memory.average.toFixed(1)}ms avg (${this.results.memory.min.toFixed(1)}-${this.results.memory.max.toFixed(1)}ms)\n`);

      // Test concurrent load
      this.results.concurrentLoad = await this.measureConcurrentLoad(20);
      console.log(`Concurrent Load (20 users): ${this.results.concurrentLoad.avgResponseTime.toFixed(1)}ms avg, ${this.results.concurrentLoad.successRate}% success\n`);

      // Generate summary
      this.generateSummary();
      this.saveBaseline();

    } catch (error) {
      console.error('❌ Baseline measurement failed:', error.message);
      process.exit(1);
    }
  }

  generateSummary() {
    console.log('📈 PERFORMANCE BASELINE SUMMARY');
    console.log('================================');
    console.log(`Health Check Endpoint: ${this.results.healthCheck.average.toFixed(1)}ms average`);
    console.log(`Memory API Endpoint: ${this.results.memory.average.toFixed(1)}ms average`);
    console.log(`Concurrent Capacity: ${this.results.concurrentLoad.successRate}% success rate with 20 users`);
    
    // Performance assessment
    const healthScore = this.results.healthCheck.average < 100 ? '🟢 Good' : 
                       this.results.healthCheck.average < 200 ? '🟡 Fair' : '🔴 Poor';
    
    console.log(`\n🎯 Current Performance Score: ${healthScore}`);
    console.log('   Target after optimization: 🟢 Excellent (<50ms health checks)');
  }

  saveBaseline() {
    const fs = require('fs');
    const filename = `/Users/benreceveur/GitHub/RefactorForge/backend/performance-baseline-${Date.now()}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Baseline saved to: ${filename}`);
    
    // Also save as current baseline for comparison
    fs.writeFileSync('/Users/benreceveur/GitHub/RefactorForge/backend/current-baseline.json', JSON.stringify(this.results, null, 2));
  }
}

// Run if called directly
if (require.main === module) {
  const baseline = new PerformanceBaseline();
  baseline.run().catch(console.error);
}

module.exports = PerformanceBaseline;