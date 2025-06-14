import { exec } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface GitHubEvent {
  type: string;
  payload: Record<string, unknown>;
  repository?: string;
  timestamp: Date;
}

interface GitHubPR {
  number: number;
  title: string;
  state: string;
  created_at: string;
  author: { login: string };
  labels: { name: string }[];
  head: { ref: string };
  base: { ref: string };
  mergeable: boolean;
  url: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  created_at: string;
  author: { login: string };
  labels: { name: string }[];
  url: string;
  pull_request?: unknown;
}

interface GitHubReview {
  id: string;
  state: string;
  submitted_at: string;
  author: string;
  pr_number: number;
}

export class GitHubEventHandler extends EventEmitter {
  private pollingInterval?: NodeJS.Timeout;
  private lastChecked: Date = new Date();
  private repository: string;

  constructor(repository: string) {
    super();
    this.repository = repository;
  }

  async start(pollingIntervalMs = 30000): Promise<void> {
    // Initial check
    await this.checkForEvents();

    // Set up polling
    this.pollingInterval = setInterval(() => {
      this.checkForEvents().catch((error) => {
        console.error('Error checking GitHub events:', error);
      });
    }, pollingIntervalMs);
  }

  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  private async checkForEvents(): Promise<void> {
    try {
      // Check for new PRs
      const prs = await this.getRecentPRs();
      for (const pr of prs) {
        if (new Date(pr.created_at) > this.lastChecked) {
          this.emit('event', {
            type: 'pull_request.opened',
            payload: pr,
            repository: this.repository,
            timestamp: new Date(pr.created_at),
          });
        }
      }

      // Check for new issues
      const issues = await this.getRecentIssues();
      for (const issue of issues) {
        if (new Date(issue.created_at) > this.lastChecked && !issue.pull_request) {
          this.emit('event', {
            type: 'issues.opened',
            payload: issue,
            repository: this.repository,
            timestamp: new Date(issue.created_at),
          });
        }
      }

      // Check for PR reviews
      const reviews = await this.getRecentReviews();
      for (const review of reviews) {
        if (new Date(review.submitted_at) > this.lastChecked) {
          this.emit('event', {
            type: 'pull_request_review.submitted',
            payload: review,
            repository: this.repository,
            timestamp: new Date(review.submitted_at),
          });
        }
      }

      // Update last checked time
      this.lastChecked = new Date();
    } catch (error) {
      console.error('Error fetching GitHub events:', error);
    }
  }

  private async getRecentPRs(): Promise<GitHubPR[]> {
    try {
      const { stdout } = await execAsync(
        `gh pr list --repo ${this.repository} --state all --limit 10 --json number,title,state,created_at,author,labels,head,base,mergeable,url`,
      );
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Error fetching PRs:', error);
      return [];
    }
  }

  private async getRecentIssues(): Promise<GitHubIssue[]> {
    try {
      const { stdout } = await execAsync(
        `gh issue list --repo ${this.repository} --state all --limit 10 --json number,title,state,created_at,author,labels,url,pull_request`,
      );
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Error fetching issues:', error);
      return [];
    }
  }

  private async getRecentReviews(): Promise<GitHubReview[]> {
    // For now, we'll check recent PRs and get their reviews
    const prs = await this.getRecentPRs();
    const reviews: GitHubReview[] = [];

    for (const pr of prs.slice(0, 5)) {
      // Check top 5 PRs
      try {
        const { stdout } = await execAsync(
          `gh api repos/${this.repository}/pulls/${pr.number}/reviews --jq '.[] | {id, state, submitted_at, author: .user.login, pr_number: ${pr.number}}'`,
        );
        if (stdout.trim()) {
          const prReviews = stdout
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
          reviews.push(...prReviews);
        }
      } catch (_error) {
        // Ignore individual PR review fetch errors
      }
    }

    return reviews;
  }

  async checkPRStatus(prNumber: number): Promise<{
    mergeable: boolean;
    checksPass: boolean;
    approved: boolean;
  }> {
    try {
      // Get PR details
      const { stdout: prData } = await execAsync(
        `gh pr view ${prNumber} --repo ${this.repository} --json mergeable,reviews,statusCheckRollup`,
      );
      const pr = JSON.parse(prData);

      // Check if approved
      const approved = pr.reviews?.some((review: { state: string }) => review.state === 'APPROVED') || false;

      // Check if checks pass
      const checksPass =
        pr.statusCheckRollup?.every((check: { status: string }) => check.status === 'COMPLETED') || false;

      return {
        mergeable: pr.mergeable === 'MERGEABLE',
        checksPass,
        approved,
      };
    } catch (error) {
      console.error('Error checking PR status:', error);
      return { mergeable: false, checksPass: false, approved: false };
    }
  }

  async triggerEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    this.emit('event', {
      type: eventType,
      payload,
      repository: this.repository,
      timestamp: new Date(),
    });
  }
}
