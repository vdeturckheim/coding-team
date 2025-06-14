import { EventEmitter } from 'node:events';
import { type ClaudeInstance, ClaudeManager } from './claude-manager.js';
import { WorktreeManager } from './worktree-manager.js';

export interface InstanceConfig {
  name: string;
  type: 'developer' | 'manager' | 'pr-reviewer' | 'landing-manager' | 'ci-monitor' | 'backlog-manager' | 'qa-engineer';
  branch?: string;
  systemPrompt?: string;
  environment?: Record<string, string>;
}

export interface ManagedInstance extends ClaudeInstance {
  config: InstanceConfig;
  worktreePath: string;
  startedAt: Date;
  lastHealthCheck?: Date;
  restartCount: number;
  pid?: number;
}

export interface InstanceManagerOptions {
  claudeExecutablePath?: string;
  gitPath: string;
  healthCheckInterval?: number;
  maxRestartAttempts?: number;
}

export class InstanceManager extends EventEmitter {
  private claudeManager: ClaudeManager;
  private worktreeManager: WorktreeManager;
  private instances: Map<string, ManagedInstance> = new Map();
  private options: {
    claudeExecutablePath?: string;
    gitPath: string;
    healthCheckInterval: number;
    maxRestartAttempts: number;
  };
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(options: InstanceManagerOptions) {
    super();
    this.options = {
      claudeExecutablePath: options.claudeExecutablePath,
      gitPath: options.gitPath,
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      maxRestartAttempts: options.maxRestartAttempts || 3,
    };

    this.claudeManager = new ClaudeManager({
      claudeExecutablePath: this.options.claudeExecutablePath,
    });

    this.worktreeManager = new WorktreeManager(this.options.gitPath);
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    await this.worktreeManager.initialize();
    this.startHealthChecks();
  }

  private setupEventHandlers(): void {
    this.claudeManager.on('instanceError', async ({ instance, error }) => {
      const managedInstance = this.instances.get(instance.id);
      if (managedInstance) {
        this.emit('instanceError', { instance: managedInstance, error });
        await this.handleInstanceError(managedInstance, error);
      }
    });

    this.claudeManager.on('instanceStopped', ({ id }) => {
      const managedInstance = this.instances.get(id);
      if (managedInstance) {
        this.emit('instanceStopped', managedInstance);
      }
    });
  }

  async spawnInstance(config: InstanceConfig): Promise<ManagedInstance> {
    try {
      // Create worktree for the instance
      const worktreePath = await this.worktreeManager.createWorktree(`${config.type}-${Date.now()}`, config.branch);

      // Create Claude instance
      const claudeInstance = await this.claudeManager.createInstance(config.name, worktreePath);

      // Create managed instance
      const managedInstance: ManagedInstance = {
        ...claudeInstance,
        config,
        worktreePath,
        startedAt: new Date(),
        restartCount: 0,
      };

      this.instances.set(claudeInstance.id, managedInstance);
      this.emit('instanceSpawned', managedInstance);

      // Apply system prompt if provided
      if (config.systemPrompt) {
        await this.configureInstance(managedInstance.id, config.systemPrompt);
      }

      return managedInstance;
    } catch (error) {
      throw new Error(`Failed to spawn instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async terminateInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      // Stop the Claude instance
      await this.claudeManager.stopInstance(instanceId);

      // Remove the worktree
      await this.worktreeManager.removeWorktree(instance.worktreePath);

      // Clean up
      this.instances.delete(instanceId);
      this.emit('instanceTerminated', instance);
    } catch (error) {
      throw new Error(`Failed to terminate instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async restartInstance(instanceId: string): Promise<ManagedInstance> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (instance.restartCount >= this.options.maxRestartAttempts) {
      throw new Error(`Instance ${instanceId} has exceeded max restart attempts`);
    }

    try {
      // Stop the current instance
      await this.claudeManager.stopInstance(instanceId);

      // Create a new Claude instance with the same worktree
      const newClaudeInstance = await this.claudeManager.createInstance(instance.config.name, instance.worktreePath);

      // Update managed instance
      const newManagedInstance: ManagedInstance = {
        ...newClaudeInstance,
        config: instance.config,
        worktreePath: instance.worktreePath,
        startedAt: new Date(),
        restartCount: instance.restartCount + 1,
      };

      // Replace in map
      this.instances.delete(instanceId);
      this.instances.set(newClaudeInstance.id, newManagedInstance);

      this.emit('instanceRestarted', newManagedInstance);

      // Reapply system prompt if provided
      if (instance.config.systemPrompt) {
        await this.configureInstance(newManagedInstance.id, instance.config.systemPrompt);
      }

      return newManagedInstance;
    } catch (error) {
      throw new Error(`Failed to restart instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async configureInstance(instanceId: string, systemPrompt: string): Promise<void> {
    // Send the system prompt as the first message
    await this.claudeManager.sendMessage(instanceId, systemPrompt);
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks().catch((error) => {
        console.error('Health check failed:', error);
      });
    }, this.options.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [instanceId, instance] of this.instances) {
      try {
        // Simple health check - verify instance is responsive
        const claudeInstance = this.claudeManager.getInstance(instanceId);
        if (!claudeInstance || claudeInstance.status === 'error') {
          await this.handleInstanceError(instance, new Error('Instance is in error state'));
        }

        instance.lastHealthCheck = new Date();
      } catch (error) {
        await this.handleInstanceError(instance, error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }

  private async handleInstanceError(instance: ManagedInstance, error: Error): Promise<void> {
    this.emit('instanceHealthCheckFailed', { instance, error });

    if (instance.restartCount < this.options.maxRestartAttempts) {
      try {
        await this.restartInstance(instance.id);
      } catch (restartError) {
        this.emit('instanceRestartFailed', { instance, error: restartError });
      }
    } else {
      this.emit('instanceMaxRestartsExceeded', instance);
    }
  }

  async sendMessage(instanceId: string, message: string): Promise<string> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    return this.claudeManager.sendMessage(instanceId, message);
  }

  getInstance(instanceId: string): ManagedInstance | undefined {
    return this.instances.get(instanceId);
  }

  getAllInstances(): ManagedInstance[] {
    return Array.from(this.instances.values());
  }

  getInstancesByType(type: InstanceConfig['type']): ManagedInstance[] {
    return this.getAllInstances().filter((instance) => instance.config.type === type);
  }

  async cleanup(): Promise<void> {
    // Stop health checks
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Terminate all instances
    const terminatePromises = Array.from(this.instances.keys()).map((id) => this.terminateInstance(id));
    await Promise.all(terminatePromises);

    // Clean up orphaned worktrees
    await this.worktreeManager.cleanupOrphanedWorktrees();
  }
}
