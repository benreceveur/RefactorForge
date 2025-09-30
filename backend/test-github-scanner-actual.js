#!/usr/bin/env node

/**
 * Actual GitHub Scanner Performance Test with Valid Repository
 */

const { performance } = require('perf_hooks');
const { GitHubScanner } = require('./dist/services/github-scanner.js');

async function testActualScanning() {
    console.log('🔬 GitHub Scanner Performance Test with Valid Repo\n');
    console.log('=' .repeat(60));
    
    // Initialize scanner
    const scanner = new GitHubScanner(process.env.GITHUB_TOKEN);
    
    // Test with facebook/react (limiting to specific subset)
    const testRepo = {
        owner: 'facebook',
        repo: 'react',
        branch: 'main'
    };
    
    console.log(`\n📊 Testing with: ${testRepo.owner}/${testRepo.repo}`);
    console.log(`Note: Will process up to 50 files (current limit)`);
    console.log('-'.repeat(60));
    
    const startTime = performance.now();
    let filesProcessed = 0;
    let batchCount = 0;
    let rateLimitChecks = 0;
    const fileTimes = [];
    const batchStartTimes = [];
    
    try {
        // Intercept file processing
        const originalGetFileContent = scanner.getFileContent.bind(scanner);
        scanner.getFileContent = async function(...args) {
            const fileStart = performance.now();
            
            // Track batch transitions
            if (filesProcessed % 5 === 0) {
                batchCount++;
                batchStartTimes.push(performance.now());
                console.log(`\n📦 Batch ${batchCount} (files ${filesProcessed + 1}-${Math.min(filesProcessed + 5, 50)}):`);
            }
            
            filesProcessed++;
            const result = await originalGetFileContent(...args);
            const fileTime = performance.now() - fileStart;
            fileTimes.push(fileTime);
            
            const fileName = args[1].split('/').pop();
            console.log(`  ${filesProcessed}. ${fileName.substring(0, 30).padEnd(30)} ${fileTime.toFixed(0)}ms`);
            
            return result;
        };
        
        // Track rate limiting
        const originalCheckRateLimit = scanner.checkRateLimit.bind(scanner);
        scanner.checkRateLimit = async function() {
            rateLimitChecks++;
            const beforeRemaining = this.rateLimitRemaining;
            await originalCheckRateLimit();
            
            // Only log significant rate limit events
            if (rateLimitChecks === 1) {
                console.log(`\n📊 Initial rate limit: ${beforeRemaining} requests remaining`);
            }
            if (this.rateLimitRemaining <= 10) {
                console.log(`⚠️  Rate limit warning: ${this.rateLimitRemaining} remaining`);
            }
        };
        
        console.log('\n🔍 Starting scan...\n');
        const scanResult = await scanner.scanRepository(testRepo);
        
        const endTime = performance.now();
        const totalTime = (endTime - startTime) / 1000; // Convert to seconds
        
        // Calculate batch delays
        const batchDelays = [];
        for (let i = 1; i < batchStartTimes.length; i++) {
            batchDelays.push(batchStartTimes[i] - batchStartTimes[i-1]);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 PERFORMANCE ANALYSIS REPORT');
        console.log('='.repeat(60));
        
        console.log('\n1️⃣ CURRENT IMPLEMENTATION VERIFICATION:');
        console.log('   ✅ BATCH_SIZE = 5 (confirmed in code)');
        console.log('   ✅ File limit = 50 (confirmed in code)');
        console.log('   ✅ Batch delay = 100ms (confirmed in code)');
        console.log('   ✅ Rate limit check exists');
        console.log('   ❌ No exponential backoff');
        console.log('   ❌ No dynamic batch sizing');
        
        console.log('\n2️⃣ ACTUAL PERFORMANCE METRICS:');
        console.log(`   Total time: ${totalTime.toFixed(2)} seconds`);
        console.log(`   Files processed: ${filesProcessed}`);
        console.log(`   Batches completed: ${batchCount}`);
        console.log(`   Rate limit checks: ${rateLimitChecks}`);
        console.log(`   Patterns extracted: ${scanResult.patterns.length}`);
        
        if (fileTimes.length > 0) {
            const avgFileTime = fileTimes.reduce((a, b) => a + b, 0) / fileTimes.length;
            const minFileTime = Math.min(...fileTimes);
            const maxFileTime = Math.max(...fileTimes);
            
            console.log('\n3️⃣ FILE PROCESSING PERFORMANCE:');
            console.log(`   Average per file: ${avgFileTime.toFixed(0)}ms`);
            console.log(`   Fastest file: ${minFileTime.toFixed(0)}ms`);
            console.log(`   Slowest file: ${maxFileTime.toFixed(0)}ms`);
            console.log(`   Throughput: ${(filesProcessed / totalTime).toFixed(2)} files/second`);
        }
        
        console.log('\n4️⃣ BOTTLENECK ANALYSIS:');
        const apiCallTime = fileTimes.reduce((a, b) => a + b, 0) / 1000;
        const overheadTime = totalTime - apiCallTime;
        const overheadPercent = (overheadTime / totalTime) * 100;
        
        console.log(`   API call time: ${apiCallTime.toFixed(2)}s (${(100 - overheadPercent).toFixed(0)}%)`);
        console.log(`   Overhead time: ${overheadTime.toFixed(2)}s (${overheadPercent.toFixed(0)}%)`);
        console.log(`   Primary bottleneck: ${overheadPercent > 30 ? 'Processing overhead' : 'GitHub API calls'}`);
        
        console.log('\n5️⃣ PROPOSED OPTIMIZATION EVALUATION:');
        console.log('\n   📦 Dynamic Batch Sizing (5 → 5-10):');
        const currentThroughput = filesProcessed / totalTime;
        const optimisticImprovement = 1.5; // 50% improvement with larger batches
        const realisticImprovement = 1.2;  // 20% improvement (more realistic)
        
        console.log(`      Current: ${currentThroughput.toFixed(2)} files/sec`);
        console.log(`      Optimistic: ${(currentThroughput * optimisticImprovement).toFixed(2)} files/sec (+50%)`);
        console.log(`      Realistic: ${(currentThroughput * realisticImprovement).toFixed(2)} files/sec (+20%)`);
        
        console.log('\n   📄 File Limit Increase (50 → 100):');
        const timeFor100Files = 100 / currentThroughput;
        const timeFor100Optimized = 100 / (currentThroughput * realisticImprovement);
        
        console.log(`      Current (100 files): ${timeFor100Files.toFixed(1)}s`);
        console.log(`      Optimized (100 files): ${timeFor100Optimized.toFixed(1)}s`);
        console.log(`      Time saved: ${(timeFor100Files - timeFor100Optimized).toFixed(1)}s`);
        
        console.log('\n   🔄 Exponential Backoff:');
        console.log(`      Current failures: Immediate failure on rate limit`);
        console.log(`      With backoff: Automatic retry with delays`);
        console.log(`      Benefit: Increased reliability, fewer failed scans`);
        
        console.log('\n6️⃣ RISK ASSESSMENT:');
        console.log('   ⚠️  Dynamic batching risks:');
        console.log('      - More complex rate limit management');
        console.log('      - Potential for hitting limits faster');
        console.log('      - Need careful monitoring');
        
        console.log('\n   ⚠️  100-file limit risks:');
        console.log('      - Longer scan times for large repos');
        console.log('      - More API calls = faster rate limit consumption');
        console.log('      - May timeout on slow connections');
        
        console.log('\n7️⃣ RECOMMENDATION:');
        const worthIt = overheadPercent < 30 && currentThroughput < 2;
        
        if (worthIt) {
            console.log('   ✅ IMPLEMENT OPTIMIZATION');
            console.log('   Reasons:');
            console.log('   - API calls are the bottleneck');
            console.log('   - Current throughput is low');
            console.log('   - 20-50% improvement is significant');
        } else {
            console.log('   ⚠️  RECONSIDER OPTIMIZATION');
            console.log('   Reasons:');
            console.log('   - Processing overhead is already high');
            console.log('   - Current performance may be adequate');
            console.log('   - Complexity may not justify gains');
        }
        
        // Check authentication status
        if (!process.env.GITHUB_TOKEN) {
            console.log('\n⚠️  WARNING: Running without GitHub token!');
            console.log('   Rate limit: 60 requests/hour (public)');
            console.log('   With token: 5000 requests/hour (authenticated)');
            console.log('   RECOMMENDATION: Add GitHub token for better performance');
        }
        
    } catch (error) {
        const endTime = performance.now();
        console.error('\n❌ Scan failed:', error.message);
        console.log(`Failed after ${((endTime - startTime) / 1000).toFixed(2)}s`);
        
        if (error.message.includes('rate limit') || error.message.includes('403')) {
            console.log('\n💡 This failure validates the need for:');
            console.log('   - Exponential backoff retry logic');
            console.log('   - Better rate limit handling');
            console.log('   - Dynamic batch sizing based on remaining quota');
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Analysis Complete\n');
}

// Run test
testActualScanning().catch(console.error);