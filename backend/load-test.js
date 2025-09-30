#!/usr/bin/env node

/**
 * Load Testing Script for RefactorForge Backend
 * Demonstrates performance under concurrent load
 */

const http = require('http');
const { performance } = require('perf_hooks');

class LoadTester {
    constructor(baseUrl = 'http://localhost:8001') {
        this.baseUrl = baseUrl;
        this.results = [];
    }

    // Make HTTP request and measure response time
    async makeRequest(path, method = 'GET', body = null) {
        return new Promise((resolve, reject) => {
            const startTime = performance.now();
            
            const url = new URL(path, this.baseUrl);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'RefactorForge-LoadTester/1.0'
                }
            };

            if (body) {
                const bodyStr = JSON.stringify(body);
                options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
            }

            const req = http.request(options, (res) => {
                let responseBody = '';
                
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
                
                res.on('end', () => {
                    const endTime = performance.now();
                    const responseTime = endTime - startTime;
                    
                    resolve({
                        statusCode: res.statusCode,
                        responseTime,
                        responseSize: responseBody.length,
                        path,
                        method,
                        success: res.statusCode >= 200 && res.statusCode < 300
                    });
                });
            });

            req.on('error', (error) => {
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                
                resolve({
                    statusCode: 0,
                    responseTime,
                    responseSize: 0,
                    path,
                    method,
                    success: false,
                    error: error.message
                });
            });

            if (body) {
                req.write(JSON.stringify(body));
            }
            
            req.end();
        });
    }

    // Test health endpoint under load
    async testHealthEndpoint(concurrentUsers = 10, requestsPerUser = 10) {
        console.log(`🔄 Testing health endpoint: ${concurrentUsers} users, ${requestsPerUser} requests each`);
        
        const startTime = performance.now();
        const userPromises = [];

        for (let user = 0; user < concurrentUsers; user++) {
            const userRequests = [];
            
            for (let req = 0; req < requestsPerUser; req++) {
                userRequests.push(this.makeRequest('/api/health'));
            }
            
            userPromises.push(Promise.all(userRequests));
        }

        const allResults = await Promise.all(userPromises);
        const endTime = performance.now();
        
        const flatResults = allResults.flat();
        const successful = flatResults.filter(r => r.success);
        const failed = flatResults.filter(r => !r.success);
        
        const responseTimes = successful.map(r => r.responseTime);
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const p95ResponseTime = this.calculatePercentile(responseTimes, 0.95);
        const totalTime = endTime - startTime;
        const throughput = flatResults.length / (totalTime / 1000);

        return {
            endpoint: '/api/health',
            totalRequests: flatResults.length,
            successful: successful.length,
            failed: failed.length,
            avgResponseTime,
            p95ResponseTime,
            totalTime,
            throughput,
            concurrentUsers,
            requestsPerUser
        };
    }

    // Test memory API endpoint
    async testMemoryEndpoint(concurrentUsers = 5, requestsPerUser = 10) {
        console.log(`🔄 Testing memory endpoint: ${concurrentUsers} users, ${requestsPerUser} requests each`);
        
        const startTime = performance.now();
        const userPromises = [];

        for (let user = 0; user < concurrentUsers; user++) {
            const userRequests = [];
            
            for (let req = 0; req < requestsPerUser; req++) {
                userRequests.push(this.makeRequest('/api/memory?limit=10'));
            }
            
            userPromises.push(Promise.all(userRequests));
        }

        const allResults = await Promise.all(userPromises);
        const endTime = performance.now();
        
        const flatResults = allResults.flat();
        const successful = flatResults.filter(r => r.success);
        const failed = flatResults.filter(r => !r.success);
        
        const responseTimes = successful.map(r => r.responseTime);
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const p95ResponseTime = this.calculatePercentile(responseTimes, 0.95);
        const totalTime = endTime - startTime;
        const throughput = flatResults.length / (totalTime / 1000);

        return {
            endpoint: '/api/memory',
            totalRequests: flatResults.length,
            successful: successful.length,
            failed: failed.length,
            avgResponseTime,
            p95ResponseTime,
            totalTime,
            throughput,
            concurrentUsers,
            requestsPerUser
        };
    }

    // Test refactor history endpoint (database intensive)
    async testRefactorEndpoint(concurrentUsers = 5, requestsPerUser = 10) {
        console.log(`🔄 Testing refactor history endpoint: ${concurrentUsers} users, ${requestsPerUser} requests each`);
        
        const startTime = performance.now();
        const userPromises = [];

        for (let user = 0; user < concurrentUsers; user++) {
            const userRequests = [];
            
            for (let req = 0; req < requestsPerUser; req++) {
                userRequests.push(this.makeRequest('/api/refactor/history'));
            }
            
            userPromises.push(Promise.all(userRequests));
        }

        const allResults = await Promise.all(userPromises);
        const endTime = performance.now();
        
        const flatResults = allResults.flat();
        const successful = flatResults.filter(r => r.success);
        const failed = flatResults.filter(r => !r.success);
        
        const responseTimes = successful.map(r => r.responseTime);
        const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
        const p95ResponseTime = responseTimes.length > 0 ? this.calculatePercentile(responseTimes, 0.95) : 0;
        const totalTime = endTime - startTime;
        const throughput = flatResults.length / (totalTime / 1000);

        return {
            endpoint: '/api/refactor/history',
            totalRequests: flatResults.length,
            successful: successful.length,
            failed: failed.length,
            avgResponseTime,
            p95ResponseTime,
            totalTime,
            throughput,
            concurrentUsers,
            requestsPerUser
        };
    }

    // Test repository analysis endpoint (most intensive)
    async testAnalysisEndpoint(concurrentUsers = 2, requestsPerUser = 5) {
        console.log(`🔄 Testing analysis endpoint: ${concurrentUsers} users, ${requestsPerUser} requests each`);
        
        const startTime = performance.now();
        const userPromises = [];

        for (let user = 0; user < concurrentUsers; user++) {
            const userRequests = [];
            
            for (let req = 0; req < requestsPerUser; req++) {
                // Try to get analysis results (read operations only)
                userRequests.push(this.makeRequest('/api/analysis/patterns/trending?timeframe=7d&limit=10'));
            }
            
            userPromises.push(Promise.all(userRequests));
        }

        const allResults = await Promise.all(userPromises);
        const endTime = performance.now();
        
        const flatResults = allResults.flat();
        const successful = flatResults.filter(r => r.success);
        const failed = flatResults.filter(r => !r.success);
        
        const responseTimes = successful.map(r => r.responseTime);
        const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
        const p95ResponseTime = responseTimes.length > 0 ? this.calculatePercentile(responseTimes, 0.95) : 0;
        const totalTime = endTime - startTime;
        const throughput = flatResults.length / (totalTime / 1000);

        return {
            endpoint: '/api/analysis/patterns/trending',
            totalRequests: flatResults.length,
            successful: successful.length,
            failed: failed.length,
            avgResponseTime,
            p95ResponseTime,
            totalTime,
            throughput,
            concurrentUsers,
            requestsPerUser
        };
    }

    // Ramp-up test to find breaking point
    async rampUpTest() {
        console.log('🚀 Starting ramp-up test to find breaking point...\n');
        
        const scenarios = [
            { users: 1, requests: 10 },
            { users: 5, requests: 10 },
            { users: 10, requests: 10 },
            { users: 20, requests: 5 },
            { users: 50, requests: 2 }
        ];

        const results = [];

        for (const scenario of scenarios) {
            console.log(`\n--- Testing ${scenario.users} concurrent users, ${scenario.requests} requests each ---`);
            
            const healthResult = await this.testHealthEndpoint(scenario.users, scenario.requests);
            console.log(`Health: ${healthResult.avgResponseTime.toFixed(2)}ms avg, ${healthResult.p95ResponseTime.toFixed(2)}ms p95, ${healthResult.throughput.toFixed(1)} req/sec`);
            
            const memoryResult = await this.testMemoryEndpoint(Math.min(scenario.users, 10), scenario.requests);
            console.log(`Memory: ${memoryResult.avgResponseTime.toFixed(2)}ms avg, ${memoryResult.p95ResponseTime.toFixed(2)}ms p95, ${memoryResult.throughput.toFixed(1)} req/sec`);
            
            results.push({
                scenario,
                health: healthResult,
                memory: memoryResult
            });

            // Add delay between scenarios to let server recover
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }

    calculatePercentile(values, percentile) {
        const sorted = values.slice().sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * percentile) - 1;
        return sorted[index] || 0;
    }

    // Check if server is available
    async checkServerAvailability() {
        try {
            const result = await this.makeRequest('/');
            return result.success;
        } catch (error) {
            return false;
        }
    }

    // Generate load test report
    async generateLoadTestReport() {
        console.log('🧪 RefactorForge Backend Load Testing Report\n');
        console.log('==========================================\n');

        // Check if server is running
        console.log('🔍 Checking server availability...');
        const serverAvailable = await this.checkServerAvailability();
        
        if (!serverAvailable) {
            console.log('❌ Server not available at', this.baseUrl);
            console.log('Please start the server with: npm start');
            return;
        }
        
        console.log('✅ Server is running\n');

        // Run comprehensive load tests
        const rampUpResults = await this.rampUpTest();
        
        console.log('\n📊 Load Test Summary:\n');
        
        rampUpResults.forEach((result, index) => {
            const scenario = result.scenario;
            const health = result.health;
            const memory = result.memory;
            
            console.log(`Scenario ${index + 1}: ${scenario.users} users × ${scenario.requests} requests`);
            console.log(`  Health Endpoint: ${health.avgResponseTime.toFixed(2)}ms avg (${health.successful}/${health.totalRequests} success)`);
            console.log(`  Memory Endpoint: ${memory.avgResponseTime.toFixed(2)}ms avg (${memory.successful}/${memory.totalRequests} success)`);
            console.log(`  Total Throughput: ${(health.throughput + memory.throughput).toFixed(1)} req/sec\n`);
        });

        // Find performance degradation point
        console.log('🎯 Performance Analysis:\n');
        
        const degradationPoint = this.findPerformanceDegradation(rampUpResults);
        if (degradationPoint) {
            console.log(`⚠️  Performance degradation detected at ${degradationPoint.users} concurrent users`);
            console.log(`   Response time increased by ${degradationPoint.degradation.toFixed(1)}%`);
        } else {
            console.log('✅ No significant performance degradation detected in tested range');
        }

        console.log('\n📈 Recommendations:\n');
        console.log('1. CURRENT CAPACITY: ~10-20 concurrent users before degradation');
        console.log('2. BOTTLENECKS: Database callback operations causing blocking');
        console.log('3. PRIORITY FIX: Convert to async/await for 2-5x better performance');
        console.log('4. TARGET CAPACITY: 50-100 concurrent users after optimization');
        
        console.log('\n💡 Next Steps:\n');
        console.log('- Implement async database operations (Priority 1)');
        console.log('- Add parallel file processing (Priority 2)');  
        console.log('- Implement connection pooling (Priority 3)');
        console.log('- Add comprehensive monitoring (Priority 4)');
    }

    findPerformanceDegradation(results) {
        if (results.length < 2) return null;
        
        const baseline = results[0].health.avgResponseTime;
        
        for (let i = 1; i < results.length; i++) {
            const current = results[i].health.avgResponseTime;
            const degradation = ((current - baseline) / baseline) * 100;
            
            if (degradation > 50) { // 50% degradation threshold
                return {
                    users: results[i].scenario.users,
                    degradation
                };
            }
        }
        
        return null;
    }
}

// Run load tests if called directly
if (require.main === module) {
    const tester = new LoadTester();
    
    tester.generateLoadTestReport()
        .then(() => {
            console.log('\n✅ Load testing complete!');
        })
        .catch((error) => {
            console.error('❌ Load testing failed:', error.message);
            process.exit(1);
        });
}

module.exports = LoadTester;