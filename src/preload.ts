import { type IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add API methods here as needed
  openDialog: () => ipcRenderer.invoke('dialog:openFile'),
  onUpdateProgress: (callback: (value: number) => void) =>
    ipcRenderer.on('update-progress', (_event: IpcRendererEvent, value: number) => callback(value)),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),

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
});
