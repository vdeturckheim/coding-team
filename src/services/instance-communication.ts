import { EventEmitter } from 'node:events';
import { type IpcMainInvokeEvent, ipcMain } from 'electron';

export interface InstanceMessage {
  type: 'request' | 'response' | 'event' | 'error';
  instanceId: string;
  messageId: string;
  timestamp: Date;
  payload: unknown;
}

export interface InstanceRequest extends InstanceMessage {
  type: 'request';
  action: string;
  params?: unknown;
}

export interface InstanceResponse extends InstanceMessage {
  type: 'response';
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface InstanceEvent extends InstanceMessage {
  type: 'event';
  eventName: string;
  data?: unknown;
}

export class InstanceCommunication extends EventEmitter {
  private messageHandlers: Map<string, (message: InstanceRequest) => Promise<unknown>> = new Map();
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }> =
    new Map();
  private messageCounter = 0;

  constructor() {
    super();
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    // Handle instance messages
    ipcMain.handle('instance:message', async (_event: IpcMainInvokeEvent, message: InstanceMessage) => {
      try {
        switch (message.type) {
          case 'request':
            return await this.handleRequest(message as InstanceRequest);
          case 'response':
            this.handleResponse(message as InstanceResponse);
            return { success: true };
          case 'event':
            this.handleEvent(message as InstanceEvent);
            return { success: true };
          case 'error':
            this.emit('instanceError', message);
            return { success: true };
        }
      } catch (error) {
        return {
          type: 'error',
          instanceId: message.instanceId,
          messageId: message.messageId,
          timestamp: new Date(),
          payload: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Handle instance registration
    ipcMain.handle('instance:register', async (_event: IpcMainInvokeEvent, instanceId: string) => {
      this.emit('instanceRegistered', instanceId);
      return { success: true };
    });

    // Handle instance unregistration
    ipcMain.handle('instance:unregister', async (_event: IpcMainInvokeEvent, instanceId: string) => {
      this.emit('instanceUnregistered', instanceId);
      return { success: true };
    });
  }

  private async handleRequest(request: InstanceRequest): Promise<InstanceResponse> {
    const handler = this.messageHandlers.get(request.action);

    if (!handler) {
      return {
        type: 'response',
        instanceId: request.instanceId,
        messageId: this.generateMessageId(),
        timestamp: new Date(),
        requestId: request.messageId,
        success: false,
        error: `No handler registered for action: ${request.action}`,
        payload: null,
      };
    }

    try {
      const result = await handler(request);
      return {
        type: 'response',
        instanceId: request.instanceId,
        messageId: this.generateMessageId(),
        timestamp: new Date(),
        requestId: request.messageId,
        success: true,
        data: result,
        payload: result,
      };
    } catch (error) {
      return {
        type: 'response',
        instanceId: request.instanceId,
        messageId: this.generateMessageId(),
        timestamp: new Date(),
        requestId: request.messageId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: null,
      };
    }
  }

  private handleResponse(response: InstanceResponse): void {
    const pending = this.pendingRequests.get(response.requestId);
    if (pending) {
      if (response.success) {
        pending.resolve(response.data);
      } else {
        pending.reject(new Error(response.error || 'Unknown error'));
      }
      this.pendingRequests.delete(response.requestId);
    }
  }

  private handleEvent(event: InstanceEvent): void {
    this.emit('instanceEvent', event);
    this.emit(`instance:${event.eventName}`, {
      instanceId: event.instanceId,
      data: event.data,
    });
  }

  registerHandler(action: string, handler: (message: InstanceRequest) => Promise<unknown>): void {
    this.messageHandlers.set(action, handler);
  }

  unregisterHandler(action: string): void {
    this.messageHandlers.delete(action);
  }

  async sendRequest(instanceId: string, action: string, params?: unknown): Promise<unknown> {
    const messageId = this.generateMessageId();
    const request: InstanceRequest = {
      type: 'request',
      instanceId,
      messageId,
      timestamp: new Date(),
      action,
      params,
      payload: params,
    };

    return new Promise((resolve, reject) => {
      // Store pending request
      this.pendingRequests.set(messageId, { resolve, reject });

      // Send via IPC (this would be received by the renderer process)
      this.emit('sendToInstance', request);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(messageId)) {
          this.pendingRequests.delete(messageId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  broadcastEvent(eventName: string, data?: unknown): void {
    const event: InstanceEvent = {
      type: 'event',
      instanceId: 'broadcast',
      messageId: this.generateMessageId(),
      timestamp: new Date(),
      eventName,
      data,
      payload: data,
    };

    this.emit('broadcastToInstances', event);
  }

  private generateMessageId(): string {
    return `msg-${++this.messageCounter}-${Date.now()}`;
  }
}
