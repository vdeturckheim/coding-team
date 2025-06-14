import { EventEmitter } from 'node:events';
import type { PersonaEnvironment, PersonaRuntime } from './persona-runtime.js';

export interface ScheduledTask {
  id: string;
  personaType: string;
  personaId?: string; // Specific persona ID if assigned
  priority: 'high' | 'medium' | 'low';
  description: string;
  dependencies?: string[]; // Task IDs that must complete first
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  assignedAt?: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
}

export interface ResourceConstraints {
  maxConcurrentPersonas: number;
  maxPersonasPerType: Map<string, number>;
  memoryLimitMB: number;
  cpuLimit: number;
}

export class PersonaScheduler extends EventEmitter {
  private environment: PersonaEnvironment;
  private taskQueue: Map<string, ScheduledTask> = new Map();
  private resourceConstraints: ResourceConstraints;
  private taskCounter = 0;

  constructor(environment: PersonaEnvironment, constraints?: Partial<ResourceConstraints>) {
    super();
    this.environment = environment;
    this.resourceConstraints = {
      maxConcurrentPersonas: constraints?.maxConcurrentPersonas || 10,
      maxPersonasPerType:
        constraints?.maxPersonasPerType ||
        new Map([
          ['developer', 5],
          ['pr-reviewer', 3],
          ['qa-engineer', 2],
        ]),
      memoryLimitMB: constraints?.memoryLimitMB || 4096,
      cpuLimit: constraints?.cpuLimit || 80,
    };

    // Setup periodic scheduling
    this.startSchedulingLoop();
  }

  private schedulingInterval?: NodeJS.Timeout;

  private startSchedulingLoop(): void {
    this.schedulingInterval = setInterval(() => {
      this.scheduleNextTasks().catch((error) => {
        console.error('Scheduling error:', error);
      });
    }, 5000); // Check every 5 seconds
  }

  stopSchedulingLoop(): void {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = undefined;
    }
  }

  async scheduleTask(task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const taskId = `task-${++this.taskCounter}`;
    const scheduledTask: ScheduledTask = {
      ...task,
      id: taskId,
      status: 'pending',
      createdAt: new Date(),
    };

    this.taskQueue.set(taskId, scheduledTask);
    this.emit('taskScheduled', scheduledTask);

    // Try to schedule immediately
    await this.scheduleNextTasks();

    return taskId;
  }

  private async scheduleNextTasks(): Promise<void> {
    const activePersonas = this.environment.getActivePersonas();
    const pendingTasks = this.getPendingTasks();

    if (pendingTasks.length === 0) {
      return;
    }

    // Check resource constraints
    if (activePersonas.length >= this.resourceConstraints.maxConcurrentPersonas) {
      return;
    }

    // Schedule tasks by priority
    const sortedTasks = pendingTasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (const task of sortedTasks) {
      if (await this.canScheduleTask(task)) {
        await this.assignTaskToPersona(task);
      }
    }
  }

  private async canScheduleTask(task: ScheduledTask): Promise<boolean> {
    // Check dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      const allDependenciesCompleted = task.dependencies.every((depId) => {
        const dep = this.taskQueue.get(depId);
        return dep && dep.status === 'completed';
      });
      if (!allDependenciesCompleted) {
        return false;
      }
    }

    // Check resource constraints for persona type
    const activePersonasOfType = this.environment.getActivePersonasByType(task.personaType);
    const maxForType = this.resourceConstraints.maxPersonasPerType.get(task.personaType) || 1;

    if (activePersonasOfType.length >= maxForType) {
      // Check if any existing persona is idle
      const idlePersona = activePersonasOfType.find((p) => p.state.status === 'idle');
      return !!idlePersona;
    }

    return true;
  }

  private async assignTaskToPersona(task: ScheduledTask): Promise<void> {
    try {
      // Find or create persona for the task
      let runtime: PersonaRuntime | undefined;

      if (task.personaId) {
        // Specific persona requested
        runtime = this.environment.getActivePersona(task.personaId);
      } else {
        // Find idle persona of the right type
        const activePersonasOfType = this.environment.getActivePersonasByType(task.personaType);
        runtime = activePersonasOfType.find((p) => p.state.status === 'idle');
      }

      // If no suitable persona found, spawn a new one
      if (!runtime) {
        const personaId = this.getPersonaIdForType(task.personaType);
        runtime = await this.environment.spawnPersona(personaId, task.description);
      }

      // Assign task
      task.status = 'assigned';
      task.assignedAt = new Date();
      task.personaId = runtime.personaId;

      this.emit('taskAssigned', { task, personaId: runtime.personaId });

      // Send task to persona
      runtime.state.currentTask = task.description;
      await this.environment.sendMessageToPersona(runtime.personaId, `New task assigned: ${task.description}`);

      // Mark as running
      task.status = 'running';
      this.emit('taskStarted', task);

      // Handle task completion (simplified - in practice would need proper task tracking)
      this.monitorTaskCompletion(task, runtime);
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('taskFailed', task);
    }
  }

  private getPersonaIdForType(type: string): string {
    // Map persona types to their default persona IDs
    const typeToPersonaId: Record<string, string> = {
      developer: 'developer-pool',
      manager: 'manager',
      'pr-reviewer': 'pr-reviewer',
      'landing-manager': 'landing-manager',
      'ci-monitor': 'ci-monitor',
      'backlog-manager': 'backlog-manager',
      'qa-engineer': 'qa-engineer',
    };

    return typeToPersonaId[type] || type;
  }

  private monitorTaskCompletion(task: ScheduledTask, runtime: PersonaRuntime): void {
    // In a real implementation, we would monitor the persona's output
    // and determine when the task is complete
    // For now, we'll use a simple timeout simulation
    const checkInterval = setInterval(() => {
      if (runtime.state.status === 'error') {
        clearInterval(checkInterval);
        task.status = 'failed';
        task.error = runtime.state.statistics.lastError;
        this.emit('taskFailed', task);
      } else if (runtime.state.status === 'idle') {
        clearInterval(checkInterval);
        task.status = 'completed';
        task.completedAt = new Date();
        runtime.state.statistics.tasksCompleted++;
        this.emit('taskCompleted', task);
      }
    }, 1000);
  }

  private getPendingTasks(): ScheduledTask[] {
    return Array.from(this.taskQueue.values()).filter((task) => task.status === 'pending');
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.taskQueue.get(taskId);
  }

  getAllTasks(): ScheduledTask[] {
    return Array.from(this.taskQueue.values());
  }

  getTasksByStatus(status: ScheduledTask['status']): ScheduledTask[] {
    return this.getAllTasks().filter((task) => task.status === status);
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.taskQueue.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status === 'completed' || task.status === 'failed') {
      throw new Error(`Cannot cancel ${task.status} task`);
    }

    // If task is running, we might need to interrupt the persona
    if (task.status === 'running' && task.personaId) {
      const runtime = this.environment.getActivePersona(task.personaId);
      if (runtime) {
        runtime.state.currentTask = undefined;
        runtime.state.status = 'idle';
      }
    }

    task.status = 'failed';
    task.error = 'Task cancelled';
    this.emit('taskCancelled', task);
  }

  getResourceUsage(): {
    activePersonas: number;
    personasByType: Record<string, number>;
    pendingTasks: number;
    runningTasks: number;
  } {
    const activePersonas = this.environment.getActivePersonas();
    const personasByType: Record<string, number> = {};

    for (const runtime of activePersonas) {
      const type = runtime.definition.type;
      personasByType[type] = (personasByType[type] || 0) + 1;
    }

    return {
      activePersonas: activePersonas.length,
      personasByType,
      pendingTasks: this.getTasksByStatus('pending').length,
      runningTasks: this.getTasksByStatus('running').length,
    };
  }
}
