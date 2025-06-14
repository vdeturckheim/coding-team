import { EventEmitter } from 'node:events';
import type { GitHubEventHandler } from './github-event-handler.js';
import type { PersonaScheduler } from './persona-scheduler.js';

export interface WorkflowTrigger {
  id: string;
  name: string;
  type: 'github-event' | 'schedule' | 'manual' | 'cascade';
  config: GitHubTriggerConfig | ScheduleTriggerConfig | CascadeTriggerConfig;
  enabled: boolean;
}

export interface GitHubTriggerConfig {
  events: string[]; // ['pull_request.opened', 'issue.created', etc.]
  filters?: {
    labels?: string[];
    branches?: string[];
    authors?: string[];
  };
}

export interface ScheduleTriggerConfig {
  cron?: string; // Standard cron expression
  interval?: number; // Milliseconds
}

export interface CascadeTriggerConfig {
  previousTaskTypes: string[]; // Task types that trigger this workflow
  conditions?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  enabled: boolean;
}

export interface WorkflowStep {
  id: string;
  personaType: string;
  action: string;
  params?: Record<string, unknown>;
  conditions?: WorkflowCondition[];
  outputs?: string[]; // Names of outputs for use in subsequent steps
}

export interface WorkflowCondition {
  type: 'task-status' | 'output-check' | 'time-window';
  config: Record<string, unknown>;
}

export class WorkflowOrchestrator extends EventEmitter {
  private scheduler: PersonaScheduler;
  private githubHandler?: GitHubEventHandler;
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private scheduleTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(scheduler: PersonaScheduler, githubHandler?: GitHubEventHandler) {
    super();
    this.scheduler = scheduler;
    this.githubHandler = githubHandler;
    this.loadBuiltInWorkflows();
  }

  private loadBuiltInWorkflows(): void {
    // Developer assignment workflow
    this.workflows.set('issue-assignment', {
      id: 'issue-assignment',
      name: 'Issue Assignment Workflow',
      description: 'Manager assigns issues to developers when new issues are created',
      enabled: true,
      triggers: [
        {
          id: 'new-issue',
          name: 'New Issue Created',
          type: 'github-event',
          config: {
            events: ['issues.opened', 'issues.reopened'],
            filters: {
              labels: ['ready-for-dev'],
            },
          } as GitHubTriggerConfig,
          enabled: true,
        },
      ],
      steps: [
        {
          id: 'assign-to-dev',
          personaType: 'manager',
          action: 'assign-issue',
          params: { strategy: 'load-balanced' },
        },
      ],
    });

    // PR review workflow
    this.workflows.set('pr-review', {
      id: 'pr-review',
      name: 'Pull Request Review Workflow',
      description: 'Automatically spawn reviewer when PR is opened and facilitate back-and-forth',
      enabled: true,
      triggers: [
        {
          id: 'pr-opened',
          name: 'PR Opened',
          type: 'github-event',
          config: {
            events: ['pull_request.opened', 'pull_request.ready_for_review'],
          } as GitHubTriggerConfig,
          enabled: true,
        },
      ],
      steps: [
        {
          id: 'spawn-reviewer',
          personaType: 'pr-reviewer',
          action: 'review-pr',
          outputs: ['review-status', 'review-comments'],
        },
        {
          id: 'notify-developer',
          personaType: 'manager',
          action: 'route-feedback',
          params: { target: 'pr-author' },
          conditions: [
            {
              type: 'output-check',
              config: { output: 'review-status', value: 'changes-requested' },
            },
          ],
        },
      ],
    });

    // Landing workflow
    this.workflows.set('pr-landing', {
      id: 'pr-landing',
      name: 'PR Landing Workflow',
      description: 'Land approved PRs after CI passes',
      enabled: true,
      triggers: [
        {
          id: 'pr-approved',
          name: 'PR Approved and CI Passed',
          type: 'github-event',
          config: {
            events: ['pull_request_review.submitted', 'check_suite.completed'],
          } as GitHubTriggerConfig,
          enabled: true,
        },
      ],
      steps: [
        {
          id: 'check-landing-criteria',
          personaType: 'landing-manager',
          action: 'verify-landing-criteria',
          outputs: ['can-land'],
        },
        {
          id: 'land-pr',
          personaType: 'landing-manager',
          action: 'merge-pr',
          conditions: [
            {
              type: 'output-check',
              config: { output: 'can-land', value: true },
            },
          ],
        },
      ],
    });

    // Post-merge QA workflow
    this.workflows.set('post-merge-qa', {
      id: 'post-merge-qa',
      name: 'Post-Merge QA Testing',
      description: 'QA tests features after they are merged',
      enabled: true,
      triggers: [
        {
          id: 'pr-merged',
          name: 'PR Merged',
          type: 'github-event',
          config: {
            events: ['pull_request.closed'],
          } as GitHubTriggerConfig,
          enabled: true,
        },
      ],
      steps: [
        {
          id: 'run-qa-tests',
          personaType: 'qa-engineer',
          action: 'test-merged-feature',
          outputs: ['test-results', 'bugs-found'],
        },
        {
          id: 'create-bug-issues',
          personaType: 'qa-engineer',
          action: 'create-bug-reports',
          conditions: [
            {
              type: 'output-check',
              config: { output: 'bugs-found', operator: '>', value: 0 },
            },
          ],
        },
      ],
    });

    // CI monitoring workflow
    this.workflows.set('ci-monitoring', {
      id: 'ci-monitoring',
      name: 'CI Health Monitoring',
      description: 'Monitor CI health and respond to failures',
      enabled: true,
      triggers: [
        {
          id: 'ci-failure',
          name: 'CI Build Failed',
          type: 'github-event',
          config: {
            events: ['check_suite.completed', 'workflow_run.completed'],
          } as GitHubTriggerConfig,
          enabled: true,
        },
        {
          id: 'scheduled-health-check',
          name: 'Scheduled Health Check',
          type: 'schedule',
          config: {
            cron: '0 */6 * * *', // Every 6 hours
          } as ScheduleTriggerConfig,
          enabled: true,
        },
      ],
      steps: [
        {
          id: 'analyze-failure',
          personaType: 'ci-monitor',
          action: 'analyze-ci-failure',
          outputs: ['failure-type', 'recommended-action'],
        },
        {
          id: 'create-issue',
          personaType: 'ci-monitor',
          action: 'create-ci-issue',
          conditions: [
            {
              type: 'output-check',
              config: { output: 'failure-type', value: 'infrastructure' },
            },
          ],
        },
      ],
    });

    // Backlog grooming workflow
    this.workflows.set('backlog-grooming', {
      id: 'backlog-grooming',
      name: 'Backlog Grooming',
      description: 'Regular backlog refinement and prioritization',
      enabled: true,
      triggers: [
        {
          id: 'daily-grooming',
          name: 'Daily Backlog Review',
          type: 'schedule',
          config: {
            cron: '0 9 * * 1-5', // 9 AM on weekdays
          } as ScheduleTriggerConfig,
          enabled: true,
        },
      ],
      steps: [
        {
          id: 'refine-backlog',
          personaType: 'backlog-manager',
          action: 'refine-and-prioritize',
          outputs: ['refined-issues', 'priority-changes'],
        },
      ],
    });
  }

  async start(): Promise<void> {
    // Set up GitHub event listeners
    if (this.githubHandler) {
      this.githubHandler.on('event', (event) => {
        this.handleGitHubEvent(event).catch((error) => {
          console.error('Error handling GitHub event:', error);
        });
      });
    }

    // Set up scheduled workflows
    for (const workflow of this.workflows.values()) {
      if (workflow.enabled) {
        this.setupWorkflowTriggers(workflow);
      }
    }

    this.emit('started');
  }

  private setupWorkflowTriggers(workflow: WorkflowDefinition): void {
    for (const trigger of workflow.triggers) {
      if (!trigger.enabled) {
        continue;
      }

      if (trigger.type === 'schedule') {
        const config = trigger.config as ScheduleTriggerConfig;
        if (config.interval) {
          const timer = setInterval(() => {
            this.executeWorkflow(workflow, { trigger: trigger.id }).catch((error) => {
              console.error(`Error executing scheduled workflow ${workflow.id}:`, error);
            });
          }, config.interval);
          this.scheduleTimers.set(`${workflow.id}-${trigger.id}`, timer);
        }
        // TODO: Add cron support
      }
    }
  }

  private async handleGitHubEvent(event: { type: string; payload: unknown }): Promise<void> {
    for (const workflow of this.workflows.values()) {
      if (!workflow.enabled) {
        continue;
      }

      for (const trigger of workflow.triggers) {
        if (trigger.type !== 'github-event' || !trigger.enabled) {
          continue;
        }

        const config = trigger.config as GitHubTriggerConfig;
        if (config.events.includes(event.type)) {
          // TODO: Apply filters
          await this.executeWorkflow(workflow, { trigger: trigger.id, event });
        }
      }
    }
  }

  async executeWorkflow(workflow: WorkflowDefinition, context: { trigger: string; event?: unknown }): Promise<void> {
    this.emit('workflowStarted', { workflow, context });

    const workflowContext: Record<string, unknown> & { outputs: Record<string, unknown> } = {
      workflowId: workflow.id,
      trigger: context.trigger,
      event: context.event,
      outputs: {},
    };

    for (const step of workflow.steps) {
      try {
        // Check conditions
        if (step.conditions && !this.evaluateConditions(step.conditions, workflowContext)) {
          continue;
        }

        // Schedule the task
        const taskId = await this.scheduler.scheduleTask({
          personaType: step.personaType,
          priority: 'high',
          description: `${workflow.name} - ${step.action}`,
          dependencies: [],
        });

        // Wait for completion (simplified - in practice would be async)
        await this.waitForTaskCompletion(taskId);

        // Store outputs
        if (step.outputs) {
          const task = this.scheduler.getTask(taskId);
          if (task?.result) {
            const result = task.result as Record<string, unknown>;
            for (const output of step.outputs) {
              workflowContext.outputs[output] = result[output];
            }
          }
        }
      } catch (error) {
        this.emit('stepFailed', { workflow, step, error });
        throw error;
      }
    }

    this.emit('workflowCompleted', { workflow, context: workflowContext });
  }

  private evaluateConditions(conditions: WorkflowCondition[], _context: Record<string, unknown>): boolean {
    return conditions.every((condition) => {
      switch (condition.type) {
        case 'output-check':
          // Simplified evaluation
          return true;
        case 'task-status':
          return true;
        case 'time-window':
          return true;
        default:
          return false;
      }
    });
  }

  private async waitForTaskCompletion(taskId: string, timeout = 300000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const task = this.scheduler.getTask(taskId);
      if (task?.status === 'completed' || task?.status === 'failed') {
        if (task.status === 'failed') {
          throw new Error(`Task ${taskId} failed: ${task.error}`);
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Task ${taskId} timed out`);
  }

  addWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
    if (workflow.enabled) {
      this.setupWorkflowTriggers(workflow);
    }
  }

  removeWorkflow(workflowId: string): void {
    this.workflows.delete(workflowId);
    // Clean up timers
    for (const [key, timer] of this.scheduleTimers) {
      if (key.startsWith(`${workflowId}-`)) {
        clearInterval(timer);
        this.scheduleTimers.delete(key);
      }
    }
  }

  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  stop(): void {
    // Clear all timers
    for (const timer of this.scheduleTimers.values()) {
      clearInterval(timer);
    }
    this.scheduleTimers.clear();
    this.emit('stopped');
  }
}
