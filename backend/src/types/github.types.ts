/**
 * GitHub API Type Definitions
 * Interfaces for GitHub API responses and webhook payloads
 */

// GitHub Repository structure
export interface GitHubRepository {
  owner: string;
  repo: string;
  branch: string;
}

// GitHub File structure from tree API
export interface GitHubFile {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
  sha: string;
  url?: string;
  name: string;
}

// GitHub Webhook Events
export interface GitHubWebhookPayload {
  action?: string;
  repository: GitHubRepositoryPayload;
  sender: GitHubUser;
  installation?: {
    id: number;
  };
}

export interface GitHubPushPayload extends GitHubWebhookPayload {
  ref: string;
  before: string;
  after: string;
  commits: GitHubCommit[];
  head_commit: GitHubCommit | null;
  pusher: {
    name: string;
    email?: string;
  };
}

export interface GitHubPullRequestPayload extends GitHubWebhookPayload {
  action: 'opened' | 'closed' | 'reopened' | 'synchronize' | 'edited';
  number: number;
  pull_request: GitHubPullRequest;
}

export interface GitHubIssuePayload extends GitHubWebhookPayload {
  action: 'opened' | 'closed' | 'reopened' | 'edited' | 'deleted';
  issue: GitHubIssue;
}

// GitHub API Response Objects
export interface GitHubRepositoryPayload {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUser;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  default_branch: string;
  topics?: string[];
}

export interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  type: 'User' | 'Organization';
  site_admin: boolean;
}

export interface GitHubCommit {
  id: string;
  tree_id: string;
  distinct: boolean;
  message: string;
  timestamp: string;
  url: string;
  author: {
    name: string;
    email: string;
    username?: string;
  };
  committer: {
    name: string;
    email: string;
    username?: string;
  };
  added: string[];
  removed: string[];
  modified: string[];
}

export interface GitHubPullRequest {
  id: number;
  node_id: string;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  user: GitHubUser;
  head: {
    ref: string;
    sha: string;
    repo: GitHubRepositoryPayload | null;
  };
  base: {
    ref: string;
    sha: string;
    repo: GitHubRepositoryPayload;
  };
  merged: boolean;
  mergeable: boolean | null;
  draft: boolean;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  state: 'open' | 'closed';
  locked: boolean;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  milestone: GitHubMilestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  body: string | null;
}

export interface GitHubLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  color: string;
  default: boolean;
  description: string | null;
}

export interface GitHubMilestone {
  id: number;
  node_id: string;
  number: number;
  title: string;
  description: string | null;
  creator: GitHubUser;
  open_issues: number;
  closed_issues: number;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  due_on: string | null;
  closed_at: string | null;
}

// GitHub Tree API Response
export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubFile[];
  truncated: boolean;
}

// GitHub Content API Response
export interface GitHubContentResponse {
  type: 'file' | 'dir';
  encoding?: string;
  size: number;
  name: string;
  path: string;
  content?: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  download_url: string | null;
}

// Rate Limit Response
export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

export interface GitHubRateLimitResponse {
  resources: {
    core: GitHubRateLimit;
    search: GitHubRateLimit;
    graphql: GitHubRateLimit;
    integration_manifest: GitHubRateLimit;
  };
  rate: GitHubRateLimit;
}