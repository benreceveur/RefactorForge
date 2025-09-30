import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { 
  GitHubPushPayload, 
  GitHubPullRequestPayload, 
  GitHubIssuePayload,
  GitHubCommit,
  GitHubLabel,
  GitHubWebhookPayload
} from '../types';
import { ApiResponse, WebhookResponse } from '../types';
import { AppSecrets } from '../utils/secrets-manager';

const router = Router();

// Webhook event handlers
const handlePushEvent = (payload: GitHubPushPayload) => {
  console.log(`Push to ${payload.repository.full_name} on branch ${payload.ref}`);
  // Extract patterns from commits
  const patterns = payload.commits.map((commit: GitHubCommit) => ({
    repository: payload.repository.full_name,
    branch: payload.ref.replace('refs/heads/', ''),
    message: commit.message,
    author: commit.author.name,
    timestamp: commit.timestamp,
    files: commit.modified.concat(commit.added)
  }));
  
  console.log(`Extracted ${patterns.length} patterns from push event`);
  return patterns;
};

const handlePullRequestEvent = (payload: GitHubPullRequestPayload) => {
  const pr = payload.pull_request;
  console.log(`PR #${pr.number} ${payload.action} in ${payload.repository.full_name}`);
  
  if (payload.action === 'opened' || payload.action === 'synchronize') {
    // Extract patterns from PR
    return {
      repository: payload.repository.full_name,
      prNumber: pr.number,
      title: pr.title,
      description: pr.body,
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
      files: pr.changed_files,
      additions: pr.additions,
      deletions: pr.deletions
    };
  }
  return null;
};

const handleIssueEvent = (payload: GitHubIssuePayload) => {
  const issue = payload.issue;
  console.log(`Issue #${issue.number} ${payload.action} in ${payload.repository.full_name}`);
  
  if (payload.action === 'opened' || payload.action === 'edited') {
    return {
      repository: payload.repository.full_name,
      issueNumber: issue.number,
      title: issue.title,
      body: issue.body,
      labels: issue.labels.map((l: GitHubLabel) => l.name),
      author: issue.user.login
    };
  }
  return null;
};

// Verify GitHub webhook signature
const verifyWebhookSignature = async (req: Request): Promise<boolean> => {
  const signature = req.headers['x-hub-signature-256'] as string;
  
  if (!signature) {
    console.warn('Webhook signature missing');
    return false;
  }
  
  try {
    const secret = await AppSecrets.getGitHubWebhookSecret();
    const payload = JSON.stringify(req.body);
    const computedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  } catch (error) {
    console.error('Failed to verify webhook signature:', error);
    return false;
  }
};

// Main webhook endpoint
router.post('/github', async (req: Request<{}, unknown, GitHubWebhookPayload>, res: Response) => {
  // Verify webhook signature
  const isValidSignature = await verifyWebhookSignature(req);
  if (!isValidSignature) {
    console.warn('Invalid webhook signature received');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid webhook signature' 
    });
  }
  
  const event = req.headers['x-github-event'] as string;
  const payload = req.body as GitHubWebhookPayload;
  
  console.log(`Received GitHub webhook: ${event}`);
  
  let result: unknown = null;
  
  switch (event) {
    case 'push':
      result = handlePushEvent(payload as GitHubPushPayload);
      break;
    case 'pull_request':
      result = handlePullRequestEvent(payload as GitHubPullRequestPayload);
      break;
    case 'issues':
      result = handleIssueEvent(payload as GitHubIssuePayload);
      break;
    case 'ping':
      console.log('GitHub webhook ping received');
      result = { message: 'Pong!' };
      break;
    default:
      console.log(`Unhandled event type: ${event}`);
  }
  
  // Store patterns in memory system
  if (result && event !== 'ping') {
    console.log('Storing patterns from webhook event:', result);
    // TODO: Send to Memory API for pattern storage
  }
  
  res.json({
    success: true,
    event,
    message: `Webhook ${event} processed successfully`,
    data: result
  });
});

// Test webhook endpoint
router.post('/github/test', (req: Request, res: Response) => {
  const testPayload = {
    repository: {
      full_name: 'IntelliPact/Test-Repo'
    },
    ref: 'refs/heads/main',
    commits: [
      {
        message: 'Test commit for webhook integration',
        author: { name: 'Test User' },
        timestamp: new Date().toISOString(),
        modified: ['src/test.ts'],
        added: ['src/new.ts']
      }
    ]
  };
  
  const patterns = handlePushEvent(testPayload as GitHubPushPayload);
  
  res.json({
    success: true,
    message: 'Test webhook processed',
    patterns
  });
});

export default router;