import { type IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add API methods here as needed
  openDialog: () => ipcRenderer.invoke('dialog:openFile'),
  onUpdateProgress: (callback: (value: number) => void) =>
    ipcRenderer.on('update-progress', (_event: IpcRendererEvent, value: number) => callback(value)),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
});
