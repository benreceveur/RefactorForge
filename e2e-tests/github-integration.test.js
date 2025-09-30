/**
 * End-to-End Tests for GitHub Integration Feature
 * RefactorForge Application
 */

const assert = require('assert');
const fetch = require('node-fetch');
const { chromium } = require('@playwright/test');

// Test configuration
const CONFIG = {
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8745',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8001',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  TEST_TIMEOUT: 30000
};

// Test data
const TEST_DATA = {
  mockRepository: 'facebook/react',
  invalidRepository: 'invalid-repo-name',
  githubUrl: 'https://github.com/facebook/react'
};

// Utility functions
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (endpoint, options = {}) => {
  const url = `${CONFIG.BACKEND_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return {
    status: response.status,
    data: await response.json()
  };
};

// Test Suite
class GitHubIntegrationE2ETests {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.testResults = [];
  }

  async setup() {
    console.log('🚀 Setting up test environment...');
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0
    });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    console.log('✅ Browser setup complete');
  }

  async teardown() {
    console.log('🧹 Cleaning up test environment...');
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    console.log('✅ Cleanup complete');
  }

  async runTest(testName, testFn) {
    console.log(`\n📝 Running test: ${testName}`);
    const startTime = Date.now();

    try {
      await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ PASSED: ${testName} (${duration}ms)`);
      this.testResults.push({ name: testName, status: 'passed', duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ FAILED: ${testName} (${duration}ms)`);
      console.error(`   Error: ${error.message}`);
      this.testResults.push({
        name: testName,
        status: 'failed',
        duration,
        error: error.message
      });
    }
  }

  // Backend API Tests
  async testBackendHealthCheck() {
    const { status, data } = await makeRequest('/api/health');
    assert.strictEqual(status, 200, 'Health check should return 200');
    assert.strictEqual(data.status, 'healthy', 'Service should be healthy');
  }

  async testGitHubIntegrationsEndpoint() {
    const { status, data } = await makeRequest('/api/github/integrations');
    assert.strictEqual(status, 200, 'GitHub integrations endpoint should return 200');
    assert.ok(data.hasOwnProperty('integrations'), 'Response should have integrations property');
    assert.ok(Array.isArray(data.integrations), 'Integrations should be an array');
    assert.ok(data.hasOwnProperty('total'), 'Response should have total count');
    assert.ok(data.hasOwnProperty('active'), 'Response should have active count');

    // Check for token configuration
    if (data.error) {
      console.log(`   ⚠️  Warning: ${data.error}`);
      if (data.error.includes('token')) {
        console.log('   💡 Tip: Set GITHUB_TOKEN environment variable for full functionality');
      }
    }
  }

  async testAddGitHubIntegration() {
    const { status, data } = await makeRequest('/api/github/integrations', {
      method: 'POST',
      body: JSON.stringify({
        repository: TEST_DATA.mockRepository,
        settings: {
          autoSave: true,
          categories: ['react', 'frontend'],
          minStars: 1
        }
      })
    });

    if (!CONFIG.GITHUB_TOKEN) {
      assert.strictEqual(status, 400, 'Should return 400 without GitHub token');
      assert.ok(data.error.includes('token'), 'Error should mention token requirement');
    } else {
      assert.strictEqual(status, 200, 'Should successfully add integration');
      assert.ok(data.id, 'Response should have integration ID');
      assert.strictEqual(data.repository, TEST_DATA.mockRepository, 'Repository name should match');
    }
  }

  async testSyncGitHubIntegration() {
    const integrationId = 'integration-test-123';
    const { status, data } = await makeRequest(`/api/github/integrations/${integrationId}/sync`, {
      method: 'POST'
    });

    if (!CONFIG.GITHUB_TOKEN) {
      assert.strictEqual(status, 400, 'Should return 400 without GitHub token');
    } else {
      assert.strictEqual(status, 200, 'Sync endpoint should return 200');
      assert.ok(data.success, 'Sync should be successful');
    }
  }

  async testInvalidRepository() {
    const { status, data } = await makeRequest('/api/github/integrations', {
      method: 'POST',
      body: JSON.stringify({
        repository: TEST_DATA.invalidRepository
      })
    });

    if (CONFIG.GITHUB_TOKEN) {
      assert.ok(status === 400 || status === 404, 'Should reject invalid repository format');
      assert.ok(data.error, 'Should return error message');
    }
  }

  // Frontend UI Tests
  async testNavigateToGitHubPage() {
    await this.page.goto(CONFIG.FRONTEND_URL);
    await this.page.waitForLoadState('networkidle');

    // Check if GitHub tab exists
    const githubTab = await this.page.locator('button:has-text("GitHub Integration")');
    assert.ok(await githubTab.isVisible(), 'GitHub Integration tab should be visible');

    // Click on GitHub tab
    await githubTab.click();
    await this.page.waitForTimeout(500);

    // Verify URL changed to /github
    const url = this.page.url();
    assert.ok(url.includes('/github'), 'URL should change to /github');

    // Verify GitHub integration page loaded
    const pageTitle = await this.page.locator('h2:has-text("GitHub Integration")');
    assert.ok(await pageTitle.isVisible(), 'GitHub Integration page title should be visible');
  }

  async testAddRepositoryForm() {
    await this.page.goto(`${CONFIG.FRONTEND_URL}/github`);
    await this.page.waitForLoadState('networkidle');

    // Click Add Repository button
    const addButton = await this.page.locator('button:has-text("Add Repository")');
    await addButton.click();

    // Check if form appears
    const form = await this.page.locator('form');
    assert.ok(await form.isVisible(), 'Add repository form should be visible');

    // Check form elements
    const urlInput = await this.page.locator('input[type="url"]');
    assert.ok(await urlInput.isVisible(), 'Repository URL input should be visible');

    // Test form validation
    await urlInput.fill('invalid-url');
    const submitButton = await this.page.locator('button:has-text("Add Repository")').last();
    await submitButton.click();

    // Browser should show validation error for invalid URL
    const isInvalid = await urlInput.evaluate(el => !el.validity.valid);
    assert.ok(isInvalid, 'Should show validation error for invalid URL');

    // Test with valid URL
    await urlInput.fill(TEST_DATA.githubUrl);
    assert.ok(await urlInput.evaluate(el => el.validity.valid), 'Should accept valid GitHub URL');
  }

  async testIntegrationsList() {
    await this.page.goto(`${CONFIG.FRONTEND_URL}/github`);
    await this.page.waitForLoadState('networkidle');

    // Wait for integrations to load
    await this.page.waitForTimeout(2000);

    // Check for loading state or integrations list
    const loadingIndicator = await this.page.locator('text=/Loading GitHub integrations/i');
    const noIntegrationsMessage = await this.page.locator('text=/No GitHub integrations yet/i');
    const integrationCards = await this.page.locator('[class*="card"]').filter({ hasText: /github\.com/i });

    const hasLoaded = !(await loadingIndicator.isVisible());
    assert.ok(hasLoaded, 'Integrations should finish loading');

    // Either show no integrations or show integration cards
    const hasNoIntegrations = await noIntegrationsMessage.isVisible();
    const hasIntegrations = (await integrationCards.count()) > 0;

    assert.ok(hasNoIntegrations || hasIntegrations,
      'Should show either "no integrations" message or integration cards');
  }

  async testIntegrationStats() {
    await this.page.goto(`${CONFIG.FRONTEND_URL}/github`);
    await this.page.waitForLoadState('networkidle');

    // Check for statistics cards
    const activeIntegrationsCard = await this.page.locator('text=/Active Integrations/i');
    const patternsExtractedCard = await this.page.locator('text=/Patterns Extracted/i');
    const webhooksActiveCard = await this.page.locator('text=/Webhooks Active/i');

    assert.ok(await activeIntegrationsCard.isVisible(), 'Active integrations stat should be visible');
    assert.ok(await patternsExtractedCard.isVisible(), 'Patterns extracted stat should be visible');
    assert.ok(await webhooksActiveCard.isVisible(), 'Webhooks active stat should be visible');
  }

  async testErrorHandling() {
    // Test error display when backend is unavailable
    // Mock backend failure by using wrong port
    const wrongUrl = `${CONFIG.FRONTEND_URL}/github`;
    await this.page.goto(wrongUrl);

    // Intercept API calls and force failure
    await this.page.route('**/api/github/integrations', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await this.page.reload();
    await this.page.waitForTimeout(2000);

    // Check if error message is displayed
    const errorMessage = await this.page.locator('text=/Failed to load GitHub integrations/i');
    const retryButton = await this.page.locator('button:has-text("Retry")');

    // Error handling should be present
    assert.ok(
      await errorMessage.isVisible() || await retryButton.isVisible(),
      'Should display error message or retry button on API failure'
    );
  }

  // Integration Tests
  async testEndToEndFlow() {
    if (!CONFIG.GITHUB_TOKEN) {
      console.log('   ⚠️  Skipping end-to-end flow test (requires GITHUB_TOKEN)');
      return;
    }

    // Navigate to GitHub page
    await this.page.goto(`${CONFIG.FRONTEND_URL}/github`);
    await this.page.waitForLoadState('networkidle');

    // Add a repository
    const addButton = await this.page.locator('button:has-text("Add Repository")');
    await addButton.click();

    const urlInput = await this.page.locator('input[type="url"]');
    await urlInput.fill(TEST_DATA.githubUrl);

    const submitButton = await this.page.locator('button:has-text("Add Repository")').last();
    await submitButton.click();

    // Wait for repository to be added
    await this.page.waitForTimeout(3000);

    // Verify repository appears in list
    const repoCard = await this.page.locator(`text=/${TEST_DATA.mockRepository}/i`);
    assert.ok(await repoCard.isVisible(), 'Repository should appear in integrations list');

    // Test sync functionality
    const syncButton = await this.page.locator('button:has-text("Sync Now")').first();
    if (await syncButton.isVisible()) {
      await syncButton.click();

      // Check for syncing state
      const syncingIndicator = await this.page.locator('text=/Syncing/i');
      assert.ok(await syncingIndicator.isVisible(), 'Should show syncing state');
    }
  }

  // Performance Tests
  async testPageLoadPerformance() {
    const startTime = Date.now();
    await this.page.goto(`${CONFIG.FRONTEND_URL}/github`);
    await this.page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`   ⏱️  Page load time: ${loadTime}ms`);
    assert.ok(loadTime < 5000, `Page should load within 5 seconds (actual: ${loadTime}ms)`);
  }

  async testAPIResponseTime() {
    const startTime = Date.now();
    await makeRequest('/api/github/integrations');
    const responseTime = Date.now() - startTime;

    console.log(`   ⏱️  API response time: ${responseTime}ms`);
    assert.ok(responseTime < 2000, `API should respond within 2 seconds (actual: ${responseTime}ms)`);
  }

  // Main test runner
  async runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 GITHUB INTEGRATION E2E TEST SUITE');
    console.log('='.repeat(60));
    console.log(`📍 Frontend URL: ${CONFIG.FRONTEND_URL}`);
    console.log(`📍 Backend URL: ${CONFIG.BACKEND_URL}`);
    console.log(`🔑 GitHub Token: ${CONFIG.GITHUB_TOKEN ? 'Configured' : 'Not configured'}`);
    console.log('='.repeat(60));

    await this.setup();

    // Backend API Tests
    console.log('\n📦 BACKEND API TESTS');
    console.log('-'.repeat(40));
    await this.runTest('Backend Health Check', () => this.testBackendHealthCheck());
    await this.runTest('GitHub Integrations Endpoint', () => this.testGitHubIntegrationsEndpoint());
    await this.runTest('Add GitHub Integration', () => this.testAddGitHubIntegration());
    await this.runTest('Sync GitHub Integration', () => this.testSyncGitHubIntegration());
    await this.runTest('Invalid Repository Handling', () => this.testInvalidRepository());

    // Frontend UI Tests
    console.log('\n🎨 FRONTEND UI TESTS');
    console.log('-'.repeat(40));
    await this.runTest('Navigate to GitHub Page', () => this.testNavigateToGitHubPage());
    await this.runTest('Add Repository Form', () => this.testAddRepositoryForm());
    await this.runTest('Integrations List Display', () => this.testIntegrationsList());
    await this.runTest('Integration Statistics', () => this.testIntegrationStats());
    await this.runTest('Error Handling', () => this.testErrorHandling());

    // Integration Tests
    console.log('\n🔗 INTEGRATION TESTS');
    console.log('-'.repeat(40));
    await this.runTest('End-to-End Flow', () => this.testEndToEndFlow());

    // Performance Tests
    console.log('\n⚡ PERFORMANCE TESTS');
    console.log('-'.repeat(40));
    await this.runTest('Page Load Performance', () => this.testPageLoadPerformance());
    await this.runTest('API Response Time', () => this.testAPIResponseTime());

    await this.teardown();

    // Print summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;
    const totalTime = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`⏱️  Total Time: ${totalTime}ms`);
    console.log(`📈 Pass Rate: ${((passed/total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`  - ${r.name}`);
          console.log(`    Error: ${r.error}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log(failed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED');
    console.log('='.repeat(60) + '\n');

    // Exit with appropriate code
    process.exit(failed === 0 ? 0 : 1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new GitHubIntegrationE2ETests();
  tester.runAllTests().catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = GitHubIntegrationE2ETests;