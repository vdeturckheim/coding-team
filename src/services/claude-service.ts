import { app, ipcMain } from 'electron';
import { ClaudeManager } from './claude-manager.js';
import { ConfigService } from './config.js';
import { InstanceCommunication } from './instance-communication.js';
import { type InstanceConfig, InstanceManager } from './instance-manager.js';
import { PersonaEnvironment } from './persona-runtime.js';
import { PersonaScheduler } from './persona-scheduler.js';
import { PersonaStore } from './persona-store.js';

export class ClaudeService {
  private claudeManager: ClaudeManager;
  private configService: ConfigService;
  private instanceManager: InstanceManager;
  private instanceCommunication: InstanceCommunication;
  private personaStore: PersonaStore;
  private personaEnvironment: PersonaEnvironment;
  private personaScheduler: PersonaScheduler;

  constructor() {
    this.configService = new ConfigService();
    this.claudeManager = new ClaudeManager({
      claudeExecutablePath: this.configService.getClaudeExecutablePath(),
      defaultModel: this.configService.get('defaultModel'),
    });

    const gitPath = app.isPackaged
      ? process.cwd() // In production, use current working directory
      : app.getAppPath(); // In development, use app path

    this.instanceManager = new InstanceManager({
      claudeExecutablePath: this.configService.getClaudeExecutablePath(),
      gitPath,
    });

    this.instanceCommunication = new InstanceCommunication();

    // Initialize persona system
    this.personaStore = new PersonaStore(gitPath);
    this.personaEnvironment = new PersonaEnvironment(this.instanceManager, this.personaStore, gitPath);
    this.personaScheduler = new PersonaScheduler(this.personaEnvironment);

    this.setupIpcHandlers();
    this.setupInstanceHandlers();
    this.setupPersonaHandlers();
  }

  private setupInstanceHandlers(): void {
    // Handle instance events
    this.instanceManager.on('instanceSpawned', (instance) => {
      console.log(`Instance spawned: ${instance.id} (${instance.config.type})`);
    });

    this.instanceManager.on('instanceTerminated', (instance) => {
      console.log(`Instance terminated: ${instance.id} (${instance.config.type})`);
    });

    this.instanceManager.on('instanceError', ({ instance, error }) => {
      console.error(`Instance error: ${instance.id}`, error);
    });

    this.instanceManager.on('instanceRestarted', (instance) => {
      console.log(`Instance restarted: ${instance.id} (${instance.config.type})`);
    });

    // Setup communication handlers
    this.instanceCommunication.registerHandler('getInstance', async (request) => {
      const instance = this.instanceManager.getInstance(request.params as string);
      return instance || null;
    });

    this.instanceCommunication.registerHandler('getAllInstances', async () => {
      return this.instanceManager.getAllInstances();
    });
  }

  private setupPersonaHandlers(): void {
    // Handle persona events
    this.personaEnvironment.on('personaSpawned', (runtime) => {
      console.log(`Persona spawned: ${runtime.personaId} (${runtime.definition.type})`);
    });

    this.personaEnvironment.on('personaTerminated', (personaId) => {
      console.log(`Persona terminated: ${personaId}`);
    });

    this.personaEnvironment.on('personaError', ({ personaId, error }) => {
      console.error(`Persona error: ${personaId}`, error);
    });

    // Handle scheduler events
    this.personaScheduler.on('taskScheduled', (task) => {
      console.log(`Task scheduled: ${task.id} - ${task.description}`);
    });

    this.personaScheduler.on('taskCompleted', (task) => {
      console.log(`Task completed: ${task.id}`);
    });
  }

  async initialize(): Promise<void> {
    await this.configService.initialize();
    await this.instanceManager.initialize();
    await this.personaStore.initialize();

    // Update managers with loaded config
    this.claudeManager = new ClaudeManager({
      claudeExecutablePath: this.configService.getClaudeExecutablePath(),
      defaultModel: this.configService.get('defaultModel'),
    });

    const gitPath = app.isPackaged ? process.cwd() : app.getAppPath();

    this.instanceManager = new InstanceManager({
      claudeExecutablePath: this.configService.getClaudeExecutablePath(),
      gitPath,
    });
    await this.instanceManager.initialize();
  }

  private setupIpcHandlers(): void {
    // Create a new Claude instance
    ipcMain.handle('claude:create-instance', async (_, name: string, workingDirectory?: string) => {
      try {
        const instance = await this.claudeManager.createInstance(name, workingDirectory);
        return {
          success: true,
          data: {
            id: instance.id,
            name: instance.name,
            status: instance.status,
            workingDirectory: instance.workingDirectory,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Send message to Claude instance
    ipcMain.handle('claude:send-message', async (_, instanceId: string, message: string) => {
      try {
        const response = await this.claudeManager.sendMessage(instanceId, message);
        return { success: true, data: response };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Stop Claude instance
    ipcMain.handle('claude:stop-instance', async (_, instanceId: string) => {
      try {
        await this.claudeManager.stopInstance(instanceId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Get all instances
    ipcMain.handle('claude:get-instances', async () => {
      const instances = this.claudeManager.getAllInstances();
      return instances.map((instance) => ({
        id: instance.id,
        name: instance.name,
        status: instance.status,
        workingDirectory: instance.workingDirectory,
        createdAt: instance.createdAt,
      }));
    });

    // Update config
    ipcMain.handle('config:set-claude-path', async (_, path: string) => {
      this.configService.setClaudeExecutablePath(path);
      return { success: true };
    });

    // Get config
    ipcMain.handle('config:get', async () => {
      return this.configService.getAll();
    });

    // Instance management handlers
    ipcMain.handle('instance:spawn', async (_, config: InstanceConfig) => {
      try {
        const instance = await this.instanceManager.spawnInstance(config);
        return {
          success: true,
          data: instance,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('instance:terminate', async (_, instanceId: string) => {
      try {
        await this.instanceManager.terminateInstance(instanceId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('instance:restart', async (_, instanceId: string) => {
      try {
        const instance = await this.instanceManager.restartInstance(instanceId);
        return {
          success: true,
          data: instance,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('instance:send-message', async (_, instanceId: string, message: string) => {
      try {
        const response = await this.instanceManager.sendMessage(instanceId, message);
        return { success: true, data: response };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('instance:get-all', async () => {
      return this.instanceManager.getAllInstances();
    });

    ipcMain.handle('instance:get-by-type', async (_, type: string) => {
      return this.instanceManager.getInstancesByType(type as InstanceConfig['type']);
    });

    // Persona management handlers
    ipcMain.handle('persona:spawn', async (_, personaId: string, taskDescription?: string) => {
      try {
        const runtime = await this.personaEnvironment.spawnPersona(personaId, taskDescription);
        return {
          success: true,
          data: {
            personaId: runtime.personaId,
            instanceId: runtime.instanceId,
            type: runtime.definition.type,
            status: runtime.state.status,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('persona:terminate', async (_, personaId: string) => {
      try {
        await this.personaEnvironment.terminatePersona(personaId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('persona:send-message', async (_, personaId: string, message: string) => {
      try {
        const response = await this.personaEnvironment.sendMessageToPersona(personaId, message);
        return { success: true, data: response };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('persona:get-active', async () => {
      return this.personaEnvironment.getActivePersonas().map((runtime) => ({
        personaId: runtime.personaId,
        instanceId: runtime.instanceId,
        type: runtime.definition.type,
        status: runtime.state.status,
        currentTask: runtime.state.currentTask,
      }));
    });

    ipcMain.handle('persona:get-all-definitions', async () => {
      return this.personaStore.getAllPersonas();
    });

    // Task scheduling handlers
    ipcMain.handle('scheduler:schedule-task', async (_, task: unknown) => {
      try {
        const taskId = await this.personaScheduler.scheduleTask(
          task as Parameters<typeof this.personaScheduler.scheduleTask>[0],
        );
        return { success: true, data: taskId };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle('scheduler:get-tasks', async () => {
      return this.personaScheduler.getAllTasks();
    });

    ipcMain.handle('scheduler:get-resource-usage', async () => {
      return this.personaScheduler.getResourceUsage();
    });
  }

  async cleanup(): Promise<void> {
    await this.claudeManager.stopAllInstances();
    await this.instanceManager.cleanup();
  }
}
