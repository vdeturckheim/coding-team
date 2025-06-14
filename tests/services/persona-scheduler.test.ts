import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { PersonaScheduler } from '../../src/services/persona-scheduler.js';

// Mock PersonaEnvironment
class MockPersonaEnvironment extends EventEmitter {
  private activePersonas: Array<{
    personaId: string;
    instanceId: string;
    definition: { id: string; type: string };
    state: { status: string; currentTask?: string; statistics: { tasksCompleted: number } };
  }> = [];

  getActivePersonas() {
    return this.activePersonas;
  }

  getActivePersonasByType(type: string) {
    return this.activePersonas.filter((p) => p.definition.type === type);
  }

  async spawnPersona(personaId: string, taskDescription?: string) {
    const runtime = {
      personaId: `${personaId}-${Date.now()}`,
      instanceId: `instance-${Date.now()}`,
      definition: {
        id: personaId,
        type: personaId.includes('developer') ? 'developer' : 'manager',
      },
      state: {
        status: 'idle',
        currentTask: taskDescription,
        statistics: { tasksCompleted: 0 },
      },
    };
    this.activePersonas.push(runtime);
    return runtime;
  }

  async sendMessageToPersona(personaId: string, message: string) {
    const persona = this.activePersonas.find((p) => p.personaId === personaId);
    if (persona) {
      persona.state.status = 'busy';
      // Simulate work
      setTimeout(() => {
        persona.state.status = 'idle';
      }, 100);
    }
    return `Response to: ${message}`;
  }

  getActivePersona(personaId: string) {
    return this.activePersonas.find((p) => p.personaId === personaId);
  }
}

describe('PersonaScheduler', () => {
  let scheduler: PersonaScheduler;
  let mockEnvironment: MockPersonaEnvironment;

  beforeEach(() => {
    mockEnvironment = new MockPersonaEnvironment();
    scheduler = new PersonaScheduler(mockEnvironment as unknown as ConstructorParameters<typeof PersonaScheduler>[0], {
      maxConcurrentPersonas: 3,
      maxPersonasPerType: new Map([
        ['developer', 2],
        ['manager', 1],
      ]),
    });
  });

  afterEach(() => {
    // Stop the scheduling loop to prevent test hangs
    scheduler.stopSchedulingLoop();
  });

  test('should schedule a task', async () => {
    const taskId = await scheduler.scheduleTask({
      personaType: 'developer',
      priority: 'high',
      description: 'Fix bug #123',
    });

    assert.ok(taskId);
    assert.ok(taskId.startsWith('task-'));

    const task = scheduler.getTask(taskId);
    assert.ok(task);
    assert.strictEqual(task.description, 'Fix bug #123');
    assert.strictEqual(task.priority, 'high');
  });

  test('should get tasks by status', async () => {
    await scheduler.scheduleTask({
      personaType: 'developer',
      priority: 'medium',
      description: 'Task 1',
    });

    await scheduler.scheduleTask({
      personaType: 'developer',
      priority: 'low',
      description: 'Task 2',
    });

    const pendingTasks = scheduler.getTasksByStatus('pending');
    assert.ok(pendingTasks.length >= 2);
  });

  test('should respect task dependencies', async () => {
    const task1Id = await scheduler.scheduleTask({
      personaType: 'developer',
      priority: 'high',
      description: 'Task 1',
    });

    const task2Id = await scheduler.scheduleTask({
      personaType: 'developer',
      priority: 'high',
      description: 'Task 2',
      dependencies: [task1Id],
    });

    const task2 = scheduler.getTask(task2Id);
    assert.ok(task2);
    assert.ok(task2.dependencies?.includes(task1Id));
  });

  test('should cancel a task', async () => {
    const taskId = await scheduler.scheduleTask({
      personaType: 'developer',
      priority: 'low',
      description: 'Cancellable task',
    });

    await scheduler.cancelTask(taskId);

    const task = scheduler.getTask(taskId);
    assert.strictEqual(task?.status, 'failed');
    assert.strictEqual(task?.error, 'Task cancelled');
  });

  test('should get resource usage', () => {
    const usage = scheduler.getResourceUsage();

    assert.ok(usage);
    assert.strictEqual(typeof usage.activePersonas, 'number');
    assert.ok(usage.personasByType);
    assert.strictEqual(typeof usage.pendingTasks, 'number');
    assert.strictEqual(typeof usage.runningTasks, 'number');
  });

  test('should not exceed max personas per type', async () => {
    // Schedule tasks that would exceed the limit
    const tasks = [];
    for (let i = 0; i < 5; i++) {
      tasks.push(
        scheduler.scheduleTask({
          personaType: 'developer',
          priority: 'medium',
          description: `Developer task ${i}`,
        }),
      );
    }

    await Promise.all(tasks);

    // Check that we don't exceed the limit
    const usage = scheduler.getResourceUsage();
    assert.ok(usage.personasByType.developer === undefined || usage.personasByType.developer <= 2);
  });

  test('should prioritize high priority tasks', async () => {
    const assignedTasks: string[] = [];

    scheduler.on('taskAssigned', ({ task }) => {
      assignedTasks.push(task.description);
    });

    await scheduler.scheduleTask({
      personaType: 'developer',
      priority: 'low',
      description: 'Low priority task',
    });

    await scheduler.scheduleTask({
      personaType: 'developer',
      priority: 'high',
      description: 'High priority task',
    });

    await scheduler.scheduleTask({
      personaType: 'developer',
      priority: 'medium',
      description: 'Medium priority task',
    });

    // Wait for scheduling to occur
    await new Promise((resolve) => setTimeout(resolve, 200));

    // High priority should be assigned first if there were any assignments
    if (assignedTasks.length > 0) {
      assert.ok(assignedTasks.indexOf('High priority task') < assignedTasks.indexOf('Low priority task'));
    }
  });
});
