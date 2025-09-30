# RefactorForge Webhook Integration Guide

## Table of Contents
- [Overview](#overview)
- [Supported Webhook Events](#supported-webhook-events)
- [GitHub Webhook Setup](#github-webhook-setup)
- [Webhook Security](#webhook-security)
- [Configuration](#configuration)
- [Event Processing](#event-processing)
- [Testing Webhooks](#testing-webhooks)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

## Overview

RefactorForge supports real-time webhook integration with GitHub to automatically analyze code changes, detect patterns, and provide immediate feedback on pull requests and pushes. This enables continuous code quality monitoring and automated analysis workflows.

### Key Benefits
- **Real-time Analysis**: Automatic code analysis on every push or pull request
- **Continuous Monitoring**: Stay updated with repository changes without manual intervention
- **Automated Recommendations**: Generate refactoring suggestions automatically
- **Issue Detection**: Identify security vulnerabilities and performance issues immediately
- **Pattern Tracking**: Monitor code pattern evolution over time

### Architecture
```
GitHub Repository → Webhook Event → RefactorForge → Analysis → Database → Notifications
```

## Supported Webhook Events

RefactorForge processes the following GitHub webhook events:

### Push Events
**Trigger**: When code is pushed to any branch
- Analyzes changed files for new patterns
- Updates existing pattern analysis
- Generates recommendations for code improvements
- Tracks code quality metrics over time

**Payload Example**:
```json
{
  "ref": "refs/heads/main",
  "before": "abc123...",
  "after": "def456...",
  "commits": [
    {
      "id": "def456789",
      "message": "Add new feature",
      "added": ["src/newFile.ts"],
      "modified": ["src/existingFile.ts"],
      "removed": []
    }
  ]
}
```

### Pull Request Events
**Trigger**: When pull requests are opened, updated, or closed
- Analyzes PR changes for potential issues
- Provides automated code review comments
- Suggests improvements and refactoring opportunities
- Tracks PR-specific metrics

**Supported Actions**:
- `opened`: New pull request created
- `synchronize`: Pull request updated with new commits
- `reopened`: Closed pull request reopened
- `closed`: Pull request closed (with merge status)

**Payload Example**:
```json
{
  "action": "opened",
  "pull_request": {
    "number": 123,
    "title": "Add authentication system",
    "head": {
      "ref": "feature/auth",
      "sha": "abc123456"
    },
    "base": {
      "ref": "main",
      "sha": "def789012"
    }
  }
}
```

### Issue Events
**Trigger**: When issues are created, updated, or closed
- Links issues to detected code patterns
- Provides context for bug reports and feature requests
- Tracks issue resolution patterns

**Supported Actions**:
- `opened`: New issue created
- `closed`: Issue closed
- `reopened`: Issue reopened
- `edited`: Issue description or title edited

### Repository Events
**Trigger**: When repository settings change
- Updates repository analysis configuration
- Refreshes integration settings
- Handles repository visibility changes

## GitHub Webhook Setup

### Prerequisites
1. **GitHub Repository**: You must have admin access to the repository
2. **RefactorForge Instance**: Running instance with public URL or ngrok tunnel
3. **Webhook Secret**: Secure secret key for payload validation

### Step-by-Step Setup

#### 1. Generate Webhook Secret
First, generate a secure secret key for webhook validation:

```bash
# Generate a secure random secret
openssl rand -hex 32
# Example output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Set in your environment
export GITHUB_WEBHOOK_SECRET=your_generated_secret_here
```

#### 2. Configure RefactorForge
Add webhook configuration to your environment variables:

```bash
# .env file
GITHUB_WEBHOOK_SECRET=your_generated_secret_here
WEBHOOK_ENABLED=true
WEBHOOK_ENDPOINT_PATH=/api/webhooks/github
```

#### 3. Set Up GitHub Webhook
1. Navigate to your GitHub repository
2. Go to **Settings** → **Webhooks**
3. Click **Add webhook**

**Webhook Configuration**:
- **Payload URL**: `https://your-domain.com/api/webhooks/github`
  - For local development with ngrok: `https://abc123.ngrok.io/api/webhooks/github`
- **Content type**: `application/json`
- **Secret**: Enter your generated webhook secret
- **SSL verification**: Enable (recommended)

**Events to Subscribe To**:
```json
{
  "events": [
    "push",
    "pull_request",
    "issues",
    "repository"
  ]
}
```

Or select **"Send me everything"** for comprehensive monitoring.

#### 4. Test the Webhook
GitHub will send a test payload immediately after creation:

```bash
# Check webhook delivery in GitHub
# Settings → Webhooks → Recent Deliveries

# Check RefactorForge logs
curl http://localhost:8001/api/webhooks/test
```

### Local Development Setup

For local development, use ngrok to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Expose local port
ngrok http 8001

# Use the provided HTTPS URL in GitHub webhook configuration
# Example: https://abc123.ngrok.io/api/webhooks/github
```

## Webhook Security

RefactorForge implements comprehensive security measures for webhook processing:

### Signature Validation
All webhook payloads are validated using HMAC-SHA256 signatures:

```typescript
// Automatic signature validation
const signature = request.headers['x-hub-signature-256'];
const payload = JSON.stringify(request.body);
const expectedSignature = `sha256=${crypto
  .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
  .update(payload)
  .digest('hex')}`;

if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}
```

### IP Allowlisting
Configure IP allowlisting for additional security:

```bash
# Environment configuration
WEBHOOK_ALLOWED_IPS=192.30.252.0/22,185.199.108.0/22,140.82.112.0/20

# Or disable for GitHub's dynamic IPs (less secure)
WEBHOOK_IP_VALIDATION=false
```

### Rate Limiting
Webhook endpoints are protected by rate limiting:

```typescript
// Rate limiting configuration
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many webhook requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Request Validation
All webhook payloads undergo strict validation:

```typescript
// Payload schema validation
const pushEventSchema = z.object({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  commits: z.array(z.object({
    id: z.string(),
    message: z.string(),
    added: z.array(z.string()),
    modified: z.array(z.string()),
    removed: z.array(z.string())
  })),
  repository: z.object({
    full_name: z.string(),
    private: z.boolean()
  })
});
```

## Configuration

### Environment Variables

Complete webhook configuration options:

```bash
# Webhook Configuration
WEBHOOK_ENABLED=true
WEBHOOK_ENDPOINT_PATH=/api/webhooks/github
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Security Settings
WEBHOOK_IP_VALIDATION=true
WEBHOOK_ALLOWED_IPS=192.30.252.0/22,185.199.108.0/22,140.82.112.0/20
WEBHOOK_SIGNATURE_VALIDATION=true

# Processing Configuration
WEBHOOK_ASYNC_PROCESSING=true
WEBHOOK_QUEUE_ENABLED=true
WEBHOOK_BATCH_SIZE=10
WEBHOOK_PROCESSING_TIMEOUT=30000

# Retry Configuration
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY=1000
WEBHOOK_EXPONENTIAL_BACKOFF=true

# Logging and Monitoring
WEBHOOK_LOGGING_ENABLED=true
WEBHOOK_METRICS_ENABLED=true
WEBHOOK_ALERT_ON_FAILURES=true
```

### Application Configuration

Configure webhook processing in your application:

```typescript
// config/webhook-config.ts
export const webhookConfig = {
  enabled: process.env.WEBHOOK_ENABLED === 'true',
  secret: process.env.GITHUB_WEBHOOK_SECRET || '',
  endpointPath: process.env.WEBHOOK_ENDPOINT_PATH || '/api/webhooks/github',
  
  security: {
    validateSignature: process.env.WEBHOOK_SIGNATURE_VALIDATION !== 'false',
    validateIP: process.env.WEBHOOK_IP_VALIDATION !== 'false',
    allowedIPs: process.env.WEBHOOK_ALLOWED_IPS?.split(',') || [],
  },
  
  processing: {
    async: process.env.WEBHOOK_ASYNC_PROCESSING !== 'false',
    queueEnabled: process.env.WEBHOOK_QUEUE_ENABLED !== 'false',
    batchSize: parseInt(process.env.WEBHOOK_BATCH_SIZE || '10'),
    timeout: parseInt(process.env.WEBHOOK_PROCESSING_TIMEOUT || '30000'),
  },
  
  retry: {
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3'),
    delay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000'),
    exponentialBackoff: process.env.WEBHOOK_EXPONENTIAL_BACKOFF !== 'false',
  }
};
```

## Event Processing

### Processing Pipeline

RefactorForge processes webhook events through a sophisticated pipeline:

```
1. Receive Webhook → 2. Validate Signature → 3. Parse Event → 4. Queue Processing → 5. Analyze Code → 6. Update Database → 7. Send Notifications
```

### Push Event Processing

When a push event is received:

1. **Event Validation**: Verify signature and payload structure
2. **Repository Lookup**: Find or create repository record
3. **Change Analysis**: Identify added, modified, and removed files
4. **Pattern Extraction**: Analyze changed files for code patterns
5. **Issue Detection**: Scan for security, performance, and type safety issues
6. **Recommendation Generation**: Create improvement suggestions
7. **Database Update**: Store analysis results
8. **Notification Dispatch**: Send alerts and notifications

```typescript
// Push event processing
export async function processPushEvent(payload: GitHubPushPayload): Promise<void> {
  const { repository, commits, ref } = payload;
  
  logger.info('Processing push event', {
    repository: repository.full_name,
    branch: ref,
    commits: commits.length
  });
  
  // Get changed files from all commits
  const changedFiles = commits.reduce((files, commit) => {
    return files.concat(commit.added, commit.modified);
  }, [] as string[]);
  
  // Filter for supported file types
  const codeFiles = changedFiles.filter(file => 
    /\.(ts|tsx|js|jsx|py|java|go)$/.test(file)
  );
  
  if (codeFiles.length === 0) {
    logger.info('No code files changed, skipping analysis');
    return;
  }
  
  // Analyze code changes
  const analysisResults = await analyzeChangedFiles({
    repository: {
      owner: repository.owner.login,
      repo: repository.name,
      branch: ref.replace('refs/heads/', '')
    },
    files: codeFiles,
    commitShas: commits.map(c => c.id)
  });
  
  // Update database with results
  await updateRepositoryAnalysis(repository.full_name, analysisResults);
  
  // Generate notifications
  await generateChangeNotifications(repository.full_name, analysisResults);
}
```

### Pull Request Event Processing

Pull request events trigger targeted analysis:

1. **Diff Analysis**: Compare base and head branches
2. **Focused Scanning**: Analyze only changed files
3. **Impact Assessment**: Evaluate potential impact of changes
4. **Automated Review**: Generate code review comments
5. **PR Status Update**: Update pull request status

```typescript
// Pull request event processing
export async function processPullRequestEvent(payload: GitHubPullRequestPayload): Promise<void> {
  const { action, pull_request, repository } = payload;
  
  if (!['opened', 'synchronize'].includes(action)) {
    return; // Only process relevant actions
  }
  
  logger.info('Processing pull request event', {
    repository: repository.full_name,
    pr: pull_request.number,
    action
  });
  
  // Get PR diff
  const diffAnalysis = await analyzePullRequestDiff({
    repository: {
      owner: repository.owner.login,
      repo: repository.name,
      branch: pull_request.head.ref
    },
    baseSha: pull_request.base.sha,
    headSha: pull_request.head.sha,
    prNumber: pull_request.number
  });
  
  // Generate review comments
  const reviewComments = await generateReviewComments(diffAnalysis);
  
  // Post comments to GitHub (if configured)
  if (reviewComments.length > 0) {
    await postPullRequestComments(
      repository.full_name,
      pull_request.number,
      reviewComments
    );
  }
}
```

### Asynchronous Processing

For high-volume repositories, webhook events are processed asynchronously:

```typescript
// Queue-based processing
import { Queue, Worker } from 'bullmq';

const webhookQueue = new Queue('webhook-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    }
  }
});

// Add webhook event to queue
export async function queueWebhookEvent(eventType: string, payload: unknown): Promise<void> {
  await webhookQueue.add(eventType, payload, {
    priority: getEventPriority(eventType),
    delay: getProcessingDelay(eventType)
  });
}

// Process webhook events
const worker = new Worker('webhook-processing', async (job) => {
  const { name, data } = job;
  
  switch (name) {
    case 'push':
      await processPushEvent(data);
      break;
    case 'pull_request':
      await processPullRequestEvent(data);
      break;
    case 'issues':
      await processIssueEvent(data);
      break;
    default:
      logger.warn('Unsupported webhook event type', { eventType: name });
  }
}, { connection: redisConnection });
```

## Testing Webhooks

### Local Testing

#### 1. Using ngrok
```bash
# Terminal 1: Start RefactorForge
npm run dev

# Terminal 2: Start ngrok
ngrok http 8001

# Use the ngrok URL in GitHub webhook configuration
```

#### 2. Manual Testing
```bash
# Test endpoint availability
curl -X POST http://localhost:8001/api/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen": "Testing webhook"}'
```

#### 3. GitHub Webhook Tester
Use GitHub's webhook delivery testing:
1. Go to repository **Settings** → **Webhooks**
2. Click on your webhook
3. Navigate to **Recent Deliveries**
4. Click **Redeliver** on any payload

### Integration Testing

Create comprehensive webhook tests:

```typescript
// __tests__/webhooks/github-webhook.test.ts
import request from 'supertest';
import crypto from 'crypto';
import app from '../../src/index';

describe('GitHub Webhook', () => {
  const webhookSecret = 'test-secret';
  
  function signPayload(payload: string): string {
    return `sha256=${crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex')}`;
  }
  
  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = webhookSecret;
  });
  
  describe('Push Events', () => {
    it('should process push event successfully', async () => {
      const payload = JSON.stringify({
        ref: 'refs/heads/main',
        commits: [{
          id: 'abc123',
          message: 'Test commit',
          added: ['src/test.ts'],
          modified: [],
          removed: []
        }],
        repository: {
          full_name: 'testuser/testrepo',
          owner: { login: 'testuser' },
          name: 'testrepo'
        }
      });
      
      const response = await request(app)
        .post('/api/webhooks/github')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', signPayload(payload))
        .set('Content-Type', 'application/json')
        .send(payload);
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
```

### Load Testing

Test webhook performance under load:

```javascript
// webhook-load-test.js
const autocannon = require('autocannon');

const loadTest = autocannon({
  url: 'http://localhost:8001/api/webhooks/github',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-GitHub-Event': 'push',
    'X-Hub-Signature-256': 'sha256=test-signature'
  },
  body: JSON.stringify({
    ref: 'refs/heads/main',
    commits: [],
    repository: { full_name: 'test/repo' }
  }),
  connections: 10,
  pipelining: 1,
  duration: 30 // 30 seconds
});

loadTest.on('done', (result) => {
  console.log('Load test completed:');
  console.log(`Requests: ${result.requests.total}`);
  console.log(`Errors: ${result.errors}`);
  console.log(`Avg latency: ${result.latency.average}ms`);
});
```

## Troubleshooting

### Common Issues

#### 1. Webhook Not Receiving Events
**Symptoms**: No webhook events being processed
**Causes & Solutions**:

```bash
# Check webhook URL accessibility
curl -I https://your-domain.com/api/webhooks/github

# Verify webhook configuration in GitHub
# Settings → Webhooks → Check Recent Deliveries

# Check RefactorForge logs
tail -f logs/webhook.log

# Verify environment variables
echo $GITHUB_WEBHOOK_SECRET
echo $WEBHOOK_ENABLED
```

#### 2. Signature Validation Failures
**Symptoms**: "Invalid webhook signature" errors
**Causes & Solutions**:

```bash
# Verify webhook secret matches GitHub configuration
echo $GITHUB_WEBHOOK_SECRET

# Check payload encoding
# Ensure payload is raw JSON, not URL-encoded

# Debug signature generation
node -e "
const crypto = require('crypto');
const payload = 'your-payload-here';
const secret = process.env.GITHUB_WEBHOOK_SECRET;
console.log('Expected:', 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex'));
"
```

#### 3. Processing Timeouts
**Symptoms**: Webhook requests timing out
**Causes & Solutions**:

```bash
# Increase processing timeout
export WEBHOOK_PROCESSING_TIMEOUT=60000

# Enable async processing
export WEBHOOK_ASYNC_PROCESSING=true

# Check system resources
top -p $(pgrep node)
```

#### 4. Rate Limiting Issues
**Symptoms**: Too many webhook requests rejected
**Causes & Solutions**:

```typescript
// Adjust rate limiting configuration
const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // Increase limit
  skip: (req) => {
    // Skip rate limiting for certain conditions
    return req.headers['x-github-event'] === 'ping';
  }
});
```

### Debugging Tools

#### 1. Webhook Event Inspector
Create a debugging endpoint:

```typescript
// Debug webhook events
app.post('/api/webhooks/debug', (req, res) => {
  console.log('Webhook Debug:');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: req.body
  });
});
```

#### 2. Event Replay System
Store and replay webhook events for testing:

```typescript
// Store webhook events for replay
const webhookEvents = [];

app.post('/api/webhooks/github', (req, res) => {
  // Store event for replay
  webhookEvents.push({
    timestamp: Date.now(),
    headers: req.headers,
    body: req.body
  });
  
  // Process normally...
});

// Replay endpoint
app.post('/api/webhooks/replay/:index', (req, res) => {
  const event = webhookEvents[parseInt(req.params.index)];
  if (event) {
    // Replay the event
    processWebhookEvent(event.body);
    res.json({ success: true, replayed: event });
  } else {
    res.status(404).json({ error: 'Event not found' });
  }
});
```

#### 3. Health Monitoring
Monitor webhook processing health:

```bash
# Check webhook processing status
curl http://localhost:8001/api/webhooks/status

# View processing metrics
curl http://localhost:8001/api/webhooks/metrics

# Check failed events
curl http://localhost:8001/api/webhooks/failures
```

## Advanced Configuration

### Webhook Event Filtering

Filter webhook events based on repository or event type:

```typescript
// config/webhook-filters.ts
export const webhookFilters = {
  repositories: {
    // Only process events for specific repositories
    allowlist: [
      'org/important-repo',
      'user/critical-project'
    ],
    // Skip certain repositories
    blocklist: [
      'org/archived-repo',
      'user/test-sandbox'
    ]
  },
  
  events: {
    // Process only specific event types
    allowlist: ['push', 'pull_request'],
    // Skip certain actions
    skipActions: {
      pull_request: ['labeled', 'unlabeled'],
      issues: ['assigned', 'unassigned']
    }
  },
  
  branches: {
    // Only process specific branches
    allowlist: ['main', 'develop', 'release/*'],
    // Skip feature branches
    blocklist: ['feature/*', 'hotfix/*']
  },
  
  files: {
    // Only process changes to specific file types
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.java'],
    // Skip certain directories
    skipPaths: ['node_modules/', 'dist/', 'build/', '__tests__/']
  }
};
```

### Custom Event Processors

Create custom processors for specific event types:

```typescript
// processors/custom-push-processor.ts
export class CustomPushProcessor {
  async process(payload: GitHubPushPayload): Promise<ProcessingResult> {
    // Custom processing logic
    const result = await this.analyzeCommitPatterns(payload.commits);
    
    // Generate custom notifications
    await this.notifyTeamLeads(result);
    
    return result;
  }
  
  private async analyzeCommitPatterns(commits: Commit[]): Promise<Analysis> {
    // Advanced commit pattern analysis
    const patterns = await Promise.all(
      commits.map(commit => this.extractCommitPatterns(commit))
    );
    
    return this.aggregatePatterns(patterns);
  }
}
```

### Webhook Analytics

Track webhook processing analytics:

```typescript
// analytics/webhook-analytics.ts
export class WebhookAnalytics {
  async trackEvent(eventType: string, processingTime: number, success: boolean): Promise<void> {
    const metrics = {
      eventType,
      processingTime,
      success,
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      activeHandles: process._getActiveHandles().length
    };
    
    // Store in time-series database
    await this.storeMetrics(metrics);
    
    // Update real-time dashboard
    this.updateDashboard(metrics);
  }
  
  async getProcessingMetrics(timeRange: string): Promise<WebhookMetrics> {
    return {
      totalEvents: await this.getTotalEvents(timeRange),
      successRate: await this.getSuccessRate(timeRange),
      averageProcessingTime: await this.getAverageProcessingTime(timeRange),
      errorRate: await this.getErrorRate(timeRange),
      peakProcessingTime: await this.getPeakProcessingTime(timeRange)
    };
  }
}
```

### Integration with External Services

Integrate webhook processing with external services:

```typescript
// integrations/external-services.ts
export class ExternalIntegrations {
  async notifySlack(analysisResult: AnalysisResult): Promise<void> {
    if (analysisResult.criticalIssues > 0) {
      await this.slackClient.postMessage({
        channel: '#code-quality',
        text: `🚨 Critical issues detected in ${analysisResult.repository}`,
        attachments: [{
          color: 'danger',
          fields: [{
            title: 'Issues Found',
            value: analysisResult.criticalIssues.toString(),
            short: true
          }]
        }]
      });
    }
  }
  
  async updateJira(analysisResult: AnalysisResult): Promise<void> {
    // Create JIRA tickets for critical issues
    for (const issue of analysisResult.criticalIssues) {
      await this.jiraClient.createIssue({
        project: 'CODE',
        issueType: 'Bug',
        summary: `Critical Issue: ${issue.description}`,
        description: issue.details
      });
    }
  }
  
  async sendEmail(analysisResult: AnalysisResult): Promise<void> {
    // Send email notifications to team members
    await this.emailService.send({
      to: analysisResult.teamMembers,
      subject: `Code Analysis Report: ${analysisResult.repository}`,
      template: 'analysis-report',
      data: analysisResult
    });
  }
}
```

---

## Summary

RefactorForge's webhook integration provides a powerful foundation for real-time code analysis and continuous quality monitoring. By following this guide, you can:

- Set up secure and reliable webhook processing
- Configure custom event handling for your specific needs
- Implement robust error handling and monitoring
- Scale webhook processing for high-volume repositories
- Integrate with external services for enhanced workflows

For additional support or advanced configuration requirements, refer to the [API Documentation](API_DOCUMENTATION.md) or contact our support team.

---

*Last Updated: January 15, 2025*
*Version: 2.1.0*