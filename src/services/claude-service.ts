import { ipcMain } from 'electron';
import { ClaudeManager } from './claude-manager.js';
import { ConfigService } from './config.js';

export class ClaudeService {
  private claudeManager: ClaudeManager;
  private configService: ConfigService;

  constructor() {
    this.configService = new ConfigService();
    this.claudeManager = new ClaudeManager({
      claudeExecutablePath: this.configService.getClaudeExecutablePath(),
      defaultModel: this.configService.get('defaultModel'),
    });

    this.setupIpcHandlers();
  }

  async initialize(): Promise<void> {
    await this.configService.initialize();

    // Update manager with loaded config
    this.claudeManager = new ClaudeManager({
      claudeExecutablePath: this.configService.getClaudeExecutablePath(),
      defaultModel: this.configService.get('defaultModel'),
    });
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
  }

  async cleanup(): Promise<void> {
    await this.claudeManager.stopAllInstances();
  }
}
