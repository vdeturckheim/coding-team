import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface AppConfig {
  claudeExecutablePath?: string;
  defaultModel: string;
  maxConcurrentInstances: number;
  instanceTimeout: number;
  autoSaveConfig: boolean;
}

export class ConfigService {
  private configPath: string;
  private config: AppConfig;
  private defaultConfig: AppConfig = {
    defaultModel: 'claude-3-5-sonnet-20241022',
    maxConcurrentInstances: 5,
    instanceTimeout: 300000, // 5 minutes
    autoSaveConfig: true,
  };

  constructor() {
    const homeDir = os.homedir();
    this.configPath = path.join(homeDir, '.coding-team', 'config.json');
    this.config = { ...this.defaultConfig };
  }

  async initialize(): Promise<void> {
    try {
      await this.load();
    } catch (error) {
      // If config doesn't exist, create it with defaults
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.save();
      } else {
        throw error;
      }
    }
  }

  async load(): Promise<void> {
    const data = await fs.readFile(this.configPath, 'utf-8');
    const loadedConfig = JSON.parse(data) as Partial<AppConfig>;
    this.config = { ...this.defaultConfig, ...loadedConfig };

    // Check environment variables for Claude path
    if (!this.config.claudeExecutablePath && process.env.CLAUDE_EXECUTABLE_PATH) {
      this.config.claudeExecutablePath = process.env.CLAUDE_EXECUTABLE_PATH;
    }
  }

  async save(): Promise<void> {
    if (!this.config.autoSaveConfig) {
      return;
    }

    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });

    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    if (this.config.autoSaveConfig) {
      this.save().catch(console.error);
    }
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  setClaudeExecutablePath(path: string): void {
    this.config.claudeExecutablePath = path;
    if (this.config.autoSaveConfig) {
      this.save().catch(console.error);
    }
  }

  getClaudeExecutablePath(): string | undefined {
    return this.config.claudeExecutablePath || process.env.CLAUDE_EXECUTABLE_PATH;
  }

  isConfigured(): boolean {
    // Claude Code SDK will use bundled executable if path not specified
    return true;
  }
}
