export interface ElectronAPI {
  getVersion: () => string;
  getProjectPath: () => Promise<string>;
  openDialog: () => Promise<unknown>;
  onUpdateProgress: (callback: (value: number) => void) => void;
  removeAllListeners: (channel: string) => void;
  
  claude: {
    createInstance: (name: string, workingDirectory?: string) => Promise<unknown>;
    sendMessage: (instanceId: string, message: string) => Promise<string>;
    stopInstance: (instanceId: string) => Promise<void>;
    getInstances: () => Promise<unknown[]>;
    setClaudePath: (path: string) => Promise<void>;
    getConfig: () => Promise<unknown>;
  };
  
  instance: {
    spawn: (config: unknown) => Promise<unknown>;
    terminate: (instanceId: string) => Promise<void>;
    restart: (instanceId: string) => Promise<unknown>;
    sendMessage: (instanceId: string, message: string) => Promise<string>;
    getAll: () => Promise<unknown[]>;
    getByType: (type: string) => Promise<unknown[]>;
    onMessage: (callback: (message: unknown) => void) => void;
    registerInstance: (instanceId: string) => Promise<void>;
    unregisterInstance: (instanceId: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}