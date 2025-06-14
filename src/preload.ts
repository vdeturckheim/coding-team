import { type IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add API methods here as needed
  openDialog: () => ipcRenderer.invoke('dialog:openFile'),
  onUpdateProgress: (callback: (value: number) => void) =>
    ipcRenderer.on('update-progress', (_event: IpcRendererEvent, value: number) => callback(value)),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
  getProjectPath: () => ipcRenderer.invoke('get-project-path'),

  // Claude Code API
  claude: {
    createInstance: (name: string, workingDirectory?: string) =>
      ipcRenderer.invoke('claude:create-instance', name, workingDirectory),

    sendMessage: (instanceId: string, message: string) =>
      ipcRenderer.invoke('claude:send-message', instanceId, message),

    stopInstance: (instanceId: string) => ipcRenderer.invoke('claude:stop-instance', instanceId),

    getInstances: () => ipcRenderer.invoke('claude:get-instances'),

    setClaudePath: (path: string) => ipcRenderer.invoke('config:set-claude-path', path),

    getConfig: () => ipcRenderer.invoke('config:get'),
  },

  // Instance management API
  instance: {
    spawn: (config: unknown) => ipcRenderer.invoke('instance:spawn', config),

    terminate: (instanceId: string) => ipcRenderer.invoke('instance:terminate', instanceId),

    restart: (instanceId: string) => ipcRenderer.invoke('instance:restart', instanceId),

    sendMessage: (instanceId: string, message: string) =>
      ipcRenderer.invoke('instance:send-message', instanceId, message),

    getAll: () => ipcRenderer.invoke('instance:get-all'),

    getByType: (type: string) => ipcRenderer.invoke('instance:get-by-type', type),

    // Instance communication
    onMessage: (callback: (message: unknown) => void) =>
      ipcRenderer.on('instance:message', (_event: IpcRendererEvent, message: unknown) => callback(message)),

    registerInstance: (instanceId: string) => ipcRenderer.invoke('instance:register', instanceId),

    unregisterInstance: (instanceId: string) => ipcRenderer.invoke('instance:unregister', instanceId),
  },
});
