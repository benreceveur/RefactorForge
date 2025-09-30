#!/usr/bin/env node

/**
 * Simple API Test for GitHub Integration
 * Can run without installing additional dependencies
 */

const http = require('http');
const https = require('https');

const CONFIG = {
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8001',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8745',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Simple HTTP request utility
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Test runner
class SimpleAPITester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
  }

  async runTest(name, testFn) {
    process.stdout.write(`  Testing ${name}... `);
    const startTime = Date.now();

    try {
      const result = await testFn();
      const duration = Date.now() - startTime;

      if (result.warning) {
        this.log(`⚠️  WARNING (${duration}ms)`, 'yellow');
        if (result.message) {
          console.log(`    ${result.message}`);
        }
        this.results.warnings++;
      } else {
        this.log(`✅ PASS (${duration}ms)`, 'green');
        this.results.passed++;
      }

      this.results.tests.push({
        name,
        status: result.warning ? 'warning' : 'passed',
        duration,
        message: result.message
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`❌ FAIL (${duration}ms)`, 'red');
      console.log(`    Error: ${error.message}`);
      this.results.failed++;
      this.results.tests.push({
        name,
        status: 'failed',
        duration,
        error: error.message
      });
    }
  }

  async testBackendHealth() {
    const { status, data } = await makeRequest(`${CONFIG.BACKEND_URL}/api/health`);

    // Backend returns 503 when degraded, but that's acceptable when GitHub token is not configured
    if (status === 503 && data.status === 'degraded') {
      // Check if it's only degraded due to GitHub
      if (data.checks?.github?.status === 'unhealthy' && data.checks?.database?.status === 'healthy') {
        return {
          warning: true,
          message: `Service degraded: ${data.checks.github.error || 'GitHub integration unhealthy'}`
        };
      }
      throw new Error(`Service is degraded: ${JSON.stringify(data.checks)}`);
    }

    if (status !== 200 && status !== 503) {
      throw new Error(`Expected status 200 or 503, got ${status}`);
    }

    if (data.status === 'ok' || data.status === 'healthy') {
      return { success: true };
    }

    return {
      warning: true,
      message: `Service status: ${data.status}`
    };
  }

  async testGitHubIntegrations() {
    const { status, data } = await makeRequest(`${CONFIG.BACKEND_URL}/api/github/integrations`);

    if (status !== 200) {
      throw new Error(`Expected status 200, got ${status}`);
    }

    if (!data.hasOwnProperty('integrations')) {
      throw new Error('Response missing integrations property');
    }

    if (!Array.isArray(data.integrations)) {
      throw new Error('Integrations should be an array');
    }

    // Check for GitHub token
    if (data.error) {
      return {
        warning: true,
        message: `GitHub API: ${data.error}`
      };
    }

    return { success: true };
  }

  async testFrontendAccess() {
    try {
      const { status } = await makeRequest(CONFIG.FRONTEND_URL);

      if (status !== 200) {
        throw new Error(`Frontend returned status ${status}`);
      }

      return { success: true };
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Frontend server is not running');
      }
      throw error;
    }
  }

  async testGitHubPageRoute() {
    const { status } = await makeRequest(`${CONFIG.FRONTEND_URL}/github`);

    if (status !== 200 && status !== 304) {
      throw new Error(`GitHub page returned status ${status}`);
    }

    return { success: true };
  }

  async testAddIntegration() {
    if (!CONFIG.GITHUB_TOKEN) {
      return {
        warning: true,
        message: 'Skipped - No GitHub token configured'
      };
    }

    const { status, data } = await makeRequest(
      `${CONFIG.BACKEND_URL}/api/github/integrations`,
      {
        method: 'POST',
        body: JSON.stringify({
          repository: 'facebook/react',
          settings: {
            autoSave: true,
            categories: ['frontend']
          }
        })
      }
    );

    if (status === 400 && data.error && data.error.includes('token')) {
      return {
        warning: true,
        message: 'GitHub token required for this operation'
      };
    }

    if (status !== 200 && status !== 201) {
      throw new Error(`Expected status 200/201, got ${status}`);
    }

    return { success: true };
  }

  async testSyncIntegration() {
    const { status, data } = await makeRequest(
      `${CONFIG.BACKEND_URL}/api/github/integrations/test-123/sync`,
      {
        method: 'POST'
      }
    );

    if (!CONFIG.GITHUB_TOKEN && status === 400) {
      return {
        warning: true,
        message: 'GitHub token required for sync'
      };
    }

    if (status !== 200) {
      throw new Error(`Sync returned status ${status}`);
    }

    return { success: true };
  }

  async testCORS() {
    // Test CORS headers
    const { status } = await makeRequest(
      `${CONFIG.BACKEND_URL}/api/github/integrations`,
      {
        headers: {
          'Origin': 'http://localhost:8745'
        }
      }
    );

    if (status !== 200) {
      throw new Error(`CORS request returned status ${status}`);
    }

    return { success: true };
  }

  async run() {
    this.log('\n╔════════════════════════════════════════════════════════════╗', 'bright');
    this.log('║          REFACTORFORGE GITHUB INTEGRATION TESTS           ║', 'bright');
    this.log('╚════════════════════════════════════════════════════════════╝', 'bright');

    console.log(`\n📍 Backend URL: ${colors.blue}${CONFIG.BACKEND_URL}${colors.reset}`);
    console.log(`📍 Frontend URL: ${colors.blue}${CONFIG.FRONTEND_URL}${colors.reset}`);
    console.log(`🔑 GitHub Token: ${CONFIG.GITHUB_TOKEN ?
      colors.green + 'Configured' :
      colors.yellow + 'Not configured (some tests will be skipped)'}${colors.reset}`);

    this.log('\n🔍 Running Backend Tests...', 'magenta');
    this.log('─'.repeat(40), 'bright');

    await this.runTest('Backend Health Check', () => this.testBackendHealth());
    await this.runTest('GitHub Integrations Endpoint', () => this.testGitHubIntegrations());
    await this.runTest('Add Integration API', () => this.testAddIntegration());
    await this.runTest('Sync Integration API', () => this.testSyncIntegration());
    await this.runTest('CORS Configuration', () => this.testCORS());

    this.log('\n🌐 Running Frontend Tests...', 'magenta');
    this.log('─'.repeat(40), 'bright');

    await this.runTest('Frontend Server Access', () => this.testFrontendAccess());
    await this.runTest('GitHub Page Route', () => this.testGitHubPageRoute());

    // Print summary
    this.log('\n' + '═'.repeat(60), 'bright');
    this.log('                       TEST SUMMARY', 'bright');
    this.log('═'.repeat(60), 'bright');

    const total = this.results.passed + this.results.failed + this.results.warnings;
    const passRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;

    console.log(`  ${colors.green}✅ Passed:${colors.reset}  ${this.results.passed}/${total}`);
    console.log(`  ${colors.yellow}⚠️  Warning:${colors.reset} ${this.results.warnings}/${total}`);
    console.log(`  ${colors.red}❌ Failed:${colors.reset}  ${this.results.failed}/${total}`);
    console.log(`  ${colors.blue}📈 Pass Rate:${colors.reset} ${passRate}%`);

    if (this.results.failed > 0) {
      this.log('\n❌ Failed Tests:', 'red');
      this.results.tests
        .filter(t => t.status === 'failed')
        .forEach(t => {
          console.log(`  • ${t.name}: ${t.error}`);
        });
    }

    if (this.results.warnings > 0) {
      this.log('\n⚠️  Tests with Warnings:', 'yellow');
      this.results.tests
        .filter(t => t.status === 'warning')
        .forEach(t => {
          console.log(`  • ${t.name}: ${t.message}`);
        });
    }

    // Provide fix suggestions
    if (this.results.failed > 0 || this.results.warnings > 0) {
      this.log('\n💡 Suggested Fixes:', 'blue');

      if (!CONFIG.GITHUB_TOKEN) {
        console.log(`  1. Set GitHub token: ${colors.yellow}export GITHUB_TOKEN="your_token_here"${colors.reset}`);
      }

      const backendFailed = this.results.tests.some(t =>
        t.name.includes('Backend') && t.status === 'failed'
      );

      if (backendFailed) {
        console.log(`  2. Start backend server: ${colors.yellow}cd backend && npm run dev${colors.reset}`);
      }

      const frontendFailed = this.results.tests.some(t =>
        t.name.includes('Frontend') && t.status === 'failed'
      );

      if (frontendFailed) {
        console.log(`  3. Start frontend server: ${colors.yellow}cd frontend && npm start${colors.reset}`);
      }
    }

    this.log('\n' + '═'.repeat(60), 'bright');

    if (this.results.failed === 0) {
      this.log('           🎉 ALL CRITICAL TESTS PASSED! 🎉', 'green');
    } else {
      this.log('         ⚠️  SOME TESTS FAILED - SEE ABOVE ⚠️', 'red');
    }

    this.log('═'.repeat(60) + '\n', 'bright');

    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run tests
if (require.main === module) {
  const tester = new SimpleAPITester();
  tester.run().catch(error => {
    console.error(`\n${colors.red}💥 Test suite crashed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}