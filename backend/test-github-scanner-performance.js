#!/usr/bin/env node

/**
 * Performance test for GitHub Scanner
 * Tests the actual implementation to verify:
 * 1. Current batch size (claimed to be 5)
 * 2. File processing limit (claimed to be 50)
 * 3. Rate limiting behavior
 * 4. Processing time per file
 */

const { performance } = require('perf_hooks');

// Import the compiled JavaScript version
const { GitHubScanner } = require('./dist/services/github-scanner.js');

async function testScannerPerformance() {
    console.log('🔬 GitHub Scanner Performance Test\n');
    console.log('=' .repeat(50));
    
    // Initialize scanner without token for testing
    const scanner = new GitHubScanner();
    
    // Test repository (small public repo)
    const testRepo = {
        owner: 'octocat',
        repo: 'Hello-World',
        branch: 'master'
    };
    
    console.log(`\n📊 Testing with repository: ${testRepo.owner}/${testRepo.repo}`);
    console.log('-'.repeat(50));
    
    // Measure scan performance
    const startTime = performance.now();
    let scanResult;
    
    try {
        // Monkey-patch to intercept internal calls for monitoring
        const originalCheckRateLimit = scanner.checkRateLimit.bind(scanner);
        let rateLimitCalls = 0;
        scanner.checkRateLimit = async function() {
            rateLimitCalls++;
            return originalCheckRateLimit();
        };
        
        const originalGetFileContent = scanner.getFileContent.bind(scanner);
        let fileContentCalls = 0;
        const fileFetchTimes = [];
        scanner.getFileContent = async function(...args) {
            const fetchStart = performance.now();
            fileContentCalls++;
            const result = await originalGetFileContent(...args);
            const fetchTime = performance.now() - fetchStart;
            fileFetchTimes.push(fetchTime);
            console.log(`  📄 File ${fileContentCalls}: ${args[1]} (${fetchTime.toFixed(2)}ms)`);
            return result;
        };
        
        console.log('\n🔍 Starting scan...');
        scanResult = await scanner.scanRepository(testRepo);
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        console.log('\n📈 Performance Metrics:');
        console.log('-'.repeat(50));
        console.log(`✅ Scan Successful: ${scanResult.scanSuccessful}`);
        console.log(`⏱️  Total Scan Time: ${(totalTime / 1000).toFixed(2)} seconds`);
        console.log(`📁 Files Processed: ${fileContentCalls}`);
        console.log(`🔄 Rate Limit Checks: ${rateLimitCalls}`);
        console.log(`📊 Patterns Found: ${scanResult.patterns.length}`);
        console.log(`🔒 Security Issues: ${scanResult.securityIssues.length}`);
        console.log(`📝 Type Safety Issues: ${scanResult.typeSafetyIssues.length}`);
        console.log(`⚡ Performance Issues: ${scanResult.performanceIssues.length}`);
        
        if (fileFetchTimes.length > 0) {
            const avgFetchTime = fileFetchTimes.reduce((a, b) => a + b, 0) / fileFetchTimes.length;
            const maxFetchTime = Math.max(...fileFetchTimes);
            const minFetchTime = Math.min(...fileFetchTimes);
            
            console.log('\n📊 File Fetch Statistics:');
            console.log(`  Average: ${avgFetchTime.toFixed(2)}ms`);
            console.log(`  Min: ${minFetchTime.toFixed(2)}ms`);
            console.log(`  Max: ${maxFetchTime.toFixed(2)}ms`);
        }
        
        // Verify implementation details from code
        console.log('\n🔍 Implementation Verification:');
        console.log('-'.repeat(50));
        
        // Check source code for constants
        const fs = require('fs');
        const sourceCode = fs.readFileSync('./src/services/github-scanner.ts', 'utf8');
        
        // Extract BATCH_SIZE
        const batchSizeMatch = sourceCode.match(/BATCH_SIZE\s*=\s*(\d+)/);
        const batchSize = batchSizeMatch ? parseInt(batchSizeMatch[1]) : 'not found';
        console.log(`📦 BATCH_SIZE in code: ${batchSize}`);
        
        // Extract file limit
        const fileLimitMatch = sourceCode.match(/slice\(0,\s*(\d+)\)/);
        const fileLimit = fileLimitMatch ? parseInt(fileLimitMatch[1]) : 'not found';
        console.log(`📄 File processing limit: ${fileLimit}`);
        
        // Check for rate limit handling
        const hasRateLimitCheck = sourceCode.includes('checkRateLimit');
        const hasRateLimitWait = sourceCode.includes('rateLimitReset');
        const hasExponentialBackoff = sourceCode.includes('exponential') || sourceCode.includes('backoff');
        
        console.log(`🔄 Has rate limit check: ${hasRateLimitCheck}`);
        console.log(`⏳ Has rate limit wait logic: ${hasRateLimitWait}`);
        console.log(`📈 Has exponential backoff: ${hasExponentialBackoff}`);
        
        // Check for delay between batches
        const delayMatch = sourceCode.match(/setTimeout\(resolve,\s*(\d+)\)/);
        const batchDelay = delayMatch ? parseInt(delayMatch[1]) : 'not found';
        console.log(`⏱️  Delay between batches: ${batchDelay}ms`);
        
    } catch (error) {
        console.error('\n❌ Scan failed:', error.message);
        const endTime = performance.now();
        console.log(`⏱️  Failed after: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Test Complete\n');
}

// Run the test
testScannerPerformance().catch(console.error);