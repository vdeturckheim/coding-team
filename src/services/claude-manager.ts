import { EventEmitter } from 'node:events';
import path from 'node:path';
import { app } from 'electron';

// Since the SDK exports a query function that returns an async generator,
// we'll wrap it in a more traditional instance-based API

export interface ClaudeInstance {
  id: string;
  name: string;
  status: 'ready' | 'busy' | 'error' | 'stopped';
  workingDirectory: string;
  createdAt: Date;
  abortController?: AbortController;
}

export interface ClaudeManagerOptions {
  claudeExecutablePath?: string;
  defaultModel?: string;
}

export class ClaudeManager extends EventEmitter {
  private instances: Map<string, ClaudeInstance> = new Map();
  private options: ClaudeManagerOptions;
  private instanceCounter = 0;

  constructor(options: ClaudeManagerOptions = {}) {
    super();
    this.options = {
      claudeExecutablePath: options.claudeExecutablePath,
      defaultModel: options.defaultModel || 'claude-3-5-sonnet-20241022',
    };

    if (!this.options.claudeExecutablePath) {
      // This will be validated when creating an instance
      console.warn('Claude executable path not specified. Will use the bundled executable or the one in PATH.');
    }
  }

  async createInstance(name: string, workingDirectory?: string): Promise<ClaudeInstance> {
    const id = `claude-${++this.instanceCounter}`;
    const workDir = workingDirectory || path.join(app.getPath('userData'), 'claude-instances', id);

    const instance: ClaudeInstance = {
      id,
      name,
      status: 'ready',
      workingDirectory: workDir,
      createdAt: new Date(),
      abortController: new AbortController(),
    };

    this.instances.set(id, instance);
    this.emit('instanceCreated', instance);

    return instance;
  }

  async sendMessage(instanceId: string, message: string): Promise<string> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (instance.status !== 'ready') {
      throw new Error(`Instance ${instanceId} is not ready. Current status: ${instance.status}`);
    }

    instance.status = 'busy';
    this.emit('instanceBusy', instance);

    try {
      // Import dynamically to avoid ES module issues during testing
      const { query } = await import('@anthropic-ai/claude-code');

      const options = {
        cwd: instance.workingDirectory,
        pathToClaudeCodeExecutable: this.options.claudeExecutablePath,
        model: this.options.defaultModel,
        abortController: instance.abortController,
      };

      const messages: unknown[] = [];
      const response = query({ prompt: message, options });

      for await (const msg of response) {
        messages.push(msg);
        if (msg.type === 'result') {
          instance.status = 'ready';
          this.emit('instanceReady', instance);
          return msg.result || 'No response';
        }
      }

      instance.status = 'ready';
      this.emit('instanceReady', instance);
      return 'Query completed without result';
    } catch (error) {
      instance.status = 'error';
      this.emit('instanceError', { instance, error });
      throw error;
    }
  }

  async stopInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      // Abort any ongoing operations
      if (instance.abortController) {
        instance.abortController.abort();
      }

      instance.status = 'stopped';
      this.emit('instanceStopped', instance);
      this.instances.delete(instanceId);
    } catch (error) {
      this.emit('instanceError', { instance, error });
      throw error;
    }
  }

  async stopAllInstances(): Promise<void> {
    const stopPromises = Array.from(this.instances.keys()).map((id) => this.stopInstance(id));
    await Promise.all(stopPromises);
  }

  getInstance(instanceId: string): ClaudeInstance | undefined {
    return this.instances.get(instanceId);
  }

  getAllInstances(): ClaudeInstance[] {
    return Array.from(this.instances.values());
  }

  getActiveInstances(): ClaudeInstance[] {
    return this.getAllInstances().filter((instance) => instance.status !== 'stopped');
  }
}
