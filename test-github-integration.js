#!/usr/bin/env node

/**
 * GitHub Integration Test Script
 * 
 * This script tests the RefactorForge GitHub integration to ensure it's working
 * with real GitHub API calls instead of mock data.
 */

const { Octokit } = require('@octokit/rest');
require('dotenv').config();

async function testGitHubIntegration() {
  console.log('🔍 Testing RefactorForge GitHub Integration\n');

  // Check if GitHub token is configured
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('❌ GITHUB_TOKEN not found in environment variables');
    console.log('📝 Please add your GitHub Personal Access Token to the .env file:');
    console.log('   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n');
    console.log('📖 Get a token from: https://github.com/settings/tokens');
    return;
  }

  if (token === 'your_github_personal_access_token_here') {
    console.log('❌ GITHUB_TOKEN is still set to placeholder value');
    console.log('📝 Please replace the placeholder with your actual GitHub PAT in .env file\n');
    return;
  }

  console.log('✅ GitHub token found in environment');

  // Initialize GitHub API client
  const octokit = new Octokit({
    auth: token,
  });

  try {
    // Test 1: Check authentication
    console.log('🔑 Testing GitHub authentication...');
    const user = await octokit.rest.users.getAuthenticated();
    console.log(`✅ Authenticated as: ${user.data.login} (${user.data.name || 'No name'})`);

    // Test 2: Check rate limit
    console.log('📊 Checking API rate limit...');
    const rateLimit = await octokit.rest.rateLimit.get();
    console.log(`✅ Rate limit: ${rateLimit.data.rate.remaining}/${rateLimit.data.rate.limit} remaining`);
    console.log(`   Resets at: ${new Date(rateLimit.data.rate.reset * 1000).toLocaleString()}`);

    // Test 3: Fetch repositories
    console.log('📂 Fetching user repositories...');
    const repos = await octokit.rest.repos.listForAuthenticatedUser({
      visibility: 'all',
      sort: 'updated',
      per_page: 10
    });

    console.log(`✅ Found ${repos.data.length} repositories:`);
    repos.data.forEach((repo, index) => {
      const privacy = repo.private ? '🔒 Private' : '🌍 Public';
      const language = repo.language || 'Unknown';
      const stars = repo.stargazers_count;
      console.log(`   ${index + 1}. ${repo.full_name} - ${language} - ${stars}⭐ - ${privacy}`);
    });

    // Test 4: Test a repository scan endpoint
    console.log('\n🧪 Testing RefactorForge backend endpoints...');
    
    const backendUrl = `http://localhost:${process.env.BACKEND_PORT || 3721}`;
    
    try {
      const fetch = require('node-fetch');
      
      // Test health endpoint
      console.log('🏥 Testing health endpoint...');
      const healthResponse = await fetch(`${backendUrl}/api/health`);
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        console.log('✅ Health endpoint working');
        console.log(`   Status: ${health.status}`);
        console.log(`   GitHub: ${health.checks.github?.status || 'unknown'}`);
      } else {
        console.log('❌ Health endpoint failed');
      }

      // Test GitHub integrations endpoint
      console.log('🔗 Testing GitHub integrations endpoint...');
      const integrationsResponse = await fetch(`${backendUrl}/api/github/integrations`);
      if (integrationsResponse.ok) {
        const integrations = await integrationsResponse.json();
        console.log('✅ GitHub integrations endpoint working');
        console.log(`   Total repositories: ${integrations.total}`);
        console.log(`   Active integrations: ${integrations.active}`);
        
        if (integrations.integrations && integrations.integrations.length > 0) {
          console.log('   Sample repositories:');
          integrations.integrations.slice(0, 3).forEach((repo, index) => {
            console.log(`     ${index + 1}. ${repo.repository} - ${repo.language || 'Unknown'}`);
          });
        }
      } else {
        console.log('❌ GitHub integrations endpoint failed');
        console.log('   This is expected if the backend is not running');
      }

    } catch (backendError) {
      console.log('⚠️  Backend endpoints not accessible (backend may not be running)');
      console.log('   Start the backend with: cd backend && npm run dev');
    }

    console.log('\n🎉 GitHub integration test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ GitHub token is valid');
    console.log('   ✅ API authentication working');
    console.log(`   ✅ Can access ${repos.data.length} repositories`);
    console.log('   ✅ RefactorForge is ready to use real GitHub data');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Start the backend: cd backend && npm run dev');
    console.log('   2. Start the frontend: cd frontend && npm start');
    console.log('   3. Visit http://localhost:8000 to see your real repositories');

  } catch (error) {
    console.error('❌ GitHub integration test failed:', error.message);
    
    if (error.status === 401) {
      console.log('\n📝 Authentication failed. Check your GitHub token:');
      console.log('   1. Is the token correct?');
      console.log('   2. Does the token have the required scopes? (repo, read:user)');
      console.log('   3. Has the token expired?');
    } else if (error.status === 403) {
      console.log('\n⏰ Rate limit exceeded or insufficient permissions');
    } else {
      console.log('\n🔍 Error details:', error);
    }
  }
}

// Run the test
testGitHubIntegration().catch(console.error);