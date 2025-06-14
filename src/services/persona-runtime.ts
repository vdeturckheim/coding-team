import { EventEmitter } from 'node:events';
import type {
  PersonaCommunication,
  PersonaDefinition,
  PersonaMemory,
  PersonaState,
  PersonaStatistics,
} from '../types/persona.js';
import type { InstanceConfig, InstanceManager, ManagedInstance } from './instance-manager.js';
import type { PersonaStore } from './persona-store.js';

export interface PersonaRuntime {
  personaId: string;
  instanceId: string;
  definition: PersonaDefinition;
  state: PersonaState;
  instance: ManagedInstance;
}

export class PersonaEnvironment extends EventEmitter {
  private instanceManager: InstanceManager;
  private personaStore: PersonaStore;
  private activePersonas: Map<string, PersonaRuntime> = new Map();
  private messageQueue: Map<string, PersonaCommunication[]> = new Map();
  private stateStorePath: string;

  constructor(instanceManager: InstanceManager, personaStore: PersonaStore, projectPath: string) {
    super();
    this.instanceManager = instanceManager;
    this.personaStore = personaStore;
    this.stateStorePath = projectPath;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.instanceManager.on('instanceError', ({ instance, error }) => {
      const runtime = this.findRuntimeByInstanceId(instance.id);
      if (runtime) {
        runtime.state.status = 'error';
        runtime.state.statistics.lastError = error.message;
        this.emit('personaError', { personaId: runtime.personaId, error });
      }
    });

    this.instanceManager.on('instanceRestarted', (instance) => {
      const runtime = this.findRuntimeByInstanceId(instance.id);
      if (runtime) {
        runtime.instance = instance;
        runtime.instanceId = instance.id;
        this.emit('personaRestarted', runtime.personaId);
      }
    });
  }

  async spawnPersona(personaId: string, taskDescription?: string): Promise<PersonaRuntime> {
    const definition = this.personaStore.getPersona(personaId);
    if (!definition) {
      throw new Error(`Persona ${personaId} not found`);
    }

    // Check singleton constraint
    if (definition.singleton) {
      const existing = Array.from(this.activePersonas.values()).find((r) => r.definition.id === personaId);
      if (existing) {
        throw new Error(`Singleton persona ${personaId} is already running`);
      }
    }

    // Generate unique instance ID for non-singleton personas
    const runtimeId = definition.singleton ? personaId : `${personaId}-${Date.now()}`;

    // Create instance configuration
    const instanceConfig: InstanceConfig = {
      name: `${definition.name} (${runtimeId})`,
      type: definition.type,
      systemPrompt: await this.buildSystemPrompt(definition),
      environment: {
        PERSONA_ID: personaId,
        PERSONA_TYPE: definition.type,
        RUNTIME_ID: runtimeId,
      },
    };

    // Spawn the instance
    const instance = await this.instanceManager.spawnInstance(instanceConfig);

    // Create persona state
    const state: PersonaState = {
      personaId,
      instanceId: instance.id,
      status: 'idle',
      currentTask: taskDescription,
      memory: {
        shortTerm: {},
        workingMemory: {},
        persistentFacts: [],
      },
      statistics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalActiveTime: 0,
        createdAt: new Date(),
      },
      lastActivity: new Date(),
    };

    // Create runtime
    const runtime: PersonaRuntime = {
      personaId: runtimeId,
      instanceId: instance.id,
      definition,
      state,
      instance,
    };

    this.activePersonas.set(runtimeId, runtime);
    this.emit('personaSpawned', runtime);

    // Initialize the persona with its role
    await this.initializePersona(runtime);

    return runtime;
  }

  private async buildSystemPrompt(definition: PersonaDefinition): Promise<string> {
    let prompt = definition.systemPrompt;

    // Add project-specific guidelines if available
    const guidelines = await this.personaStore.loadPersonaGuidelines(definition.id);
    if (guidelines) {
      prompt += `\n\nProject-specific guidelines:\n${guidelines}`;
    }

    // Add capability constraints
    if (definition.capabilities) {
      const enabledCapabilities = definition.capabilities
        .filter((c) => c.enabled)
        .map((c) => c.name)
        .join(', ');
      prompt += `\n\nYour enabled capabilities: ${enabledCapabilities}`;
    }

    // Add constraints
    if (definition.constraints) {
      if (definition.constraints.allowedBranches) {
        prompt += `\n\nYou can only work on branches: ${definition.constraints.allowedBranches.join(', ')}`;
      }
      if (definition.constraints.restrictedPaths) {
        prompt += `\n\nYou cannot modify files in: ${definition.constraints.restrictedPaths.join(', ')}`;
      }
    }

    return prompt;
  }

  private async initializePersona(runtime: PersonaRuntime): Promise<void> {
    // Send initialization message
    const initMessage = `You are now active as ${runtime.definition.name}. ${
      runtime.state.currentTask ? `Your current task is: ${runtime.state.currentTask}` : 'Awaiting task assignment.'
    }`;

    await this.sendMessageToPersona(runtime.personaId, initMessage);
    runtime.state.status = 'active';
  }

  async sendMessageToPersona(personaId: string, message: string): Promise<string> {
    const runtime = this.activePersonas.get(personaId);
    if (!runtime) {
      throw new Error(`Persona ${personaId} is not active`);
    }

    runtime.state.status = 'busy';
    runtime.state.lastActivity = new Date();

    try {
      const response = await this.instanceManager.sendMessage(runtime.instanceId, message);
      runtime.state.status = 'active';
      return response;
    } catch (error) {
      runtime.state.status = 'error';
      runtime.state.statistics.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  async sendInterPersonaMessage(
    fromPersonaId: string,
    toPersonaId: string,
    subject: string,
    content: unknown,
  ): Promise<void> {
    const message: PersonaCommunication = {
      fromPersonaId,
      toPersonaId,
      messageType: 'request',
      subject,
      content,
      timestamp: new Date(),
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Queue message for recipient
    if (!this.messageQueue.has(toPersonaId)) {
      this.messageQueue.set(toPersonaId, []);
    }
    this.messageQueue.get(toPersonaId)?.push(message);

    this.emit('interPersonaMessage', message);

    // If recipient is active, deliver immediately
    const recipient = this.activePersonas.get(toPersonaId);
    if (recipient && recipient.state.status === 'active') {
      await this.deliverQueuedMessages(toPersonaId);
    }
  }

  private async deliverQueuedMessages(personaId: string): Promise<void> {
    const messages = this.messageQueue.get(personaId) || [];
    if (messages.length === 0) {
      return;
    }

    const runtime = this.activePersonas.get(personaId);
    if (!runtime || runtime.state.status !== 'active') {
      return;
    }

    // Clear queue
    this.messageQueue.set(personaId, []);

    // Format and deliver messages
    for (const msg of messages) {
      const formattedMessage = `[Message from ${msg.fromPersonaId}] Subject: ${msg.subject}\n${JSON.stringify(msg.content)}`;
      await this.sendMessageToPersona(personaId, formattedMessage);
    }
  }

  async suspendPersona(personaId: string): Promise<void> {
    const runtime = this.activePersonas.get(personaId);
    if (!runtime) {
      throw new Error(`Persona ${personaId} is not active`);
    }

    runtime.state.status = 'suspended';
    await this.savePersonaState(runtime);
    this.emit('personaSuspended', personaId);
  }

  async resumePersona(personaId: string): Promise<void> {
    const runtime = this.activePersonas.get(personaId);
    if (!runtime) {
      throw new Error(`Persona ${personaId} is not active`);
    }

    if (runtime.state.status !== 'suspended') {
      throw new Error(`Persona ${personaId} is not suspended`);
    }

    runtime.state.status = 'active';
    await this.deliverQueuedMessages(personaId);
    this.emit('personaResumed', personaId);
  }

  async terminatePersona(personaId: string): Promise<void> {
    const runtime = this.activePersonas.get(personaId);
    if (!runtime) {
      throw new Error(`Persona ${personaId} is not active`);
    }

    // Save final state
    await this.savePersonaState(runtime);

    // Terminate instance
    await this.instanceManager.terminateInstance(runtime.instanceId);

    // Clean up
    this.activePersonas.delete(personaId);
    this.messageQueue.delete(personaId);

    this.emit('personaTerminated', personaId);
  }

  private async savePersonaState(runtime: PersonaRuntime): Promise<void> {
    // TODO: Implement state persistence to disk
    this.emit('personaStateSaved', runtime.personaId);
  }

  private findRuntimeByInstanceId(instanceId: string): PersonaRuntime | undefined {
    return Array.from(this.activePersonas.values()).find((r) => r.instanceId === instanceId);
  }

  getActivePersona(personaId: string): PersonaRuntime | undefined {
    return this.activePersonas.get(personaId);
  }

  getActivePersonas(): PersonaRuntime[] {
    return Array.from(this.activePersonas.values());
  }

  getActivePersonasByType(type: string): PersonaRuntime[] {
    return this.getActivePersonas().filter((r) => r.definition.type === type);
  }

  async updatePersonaMemory(personaId: string, memoryUpdate: Partial<PersonaMemory>): Promise<void> {
    const runtime = this.activePersonas.get(personaId);
    if (!runtime) {
      throw new Error(`Persona ${personaId} is not active`);
    }

    if (memoryUpdate.shortTerm) {
      Object.assign(runtime.state.memory.shortTerm, memoryUpdate.shortTerm);
    }
    if (memoryUpdate.workingMemory) {
      Object.assign(runtime.state.memory.workingMemory, memoryUpdate.workingMemory);
    }
    if (memoryUpdate.persistentFacts) {
      runtime.state.memory.persistentFacts.push(...memoryUpdate.persistentFacts);
    }

    this.emit('personaMemoryUpdated', { personaId, memory: runtime.state.memory });
  }

  getPersonaStatistics(personaId: string): PersonaStatistics | undefined {
    const runtime = this.activePersonas.get(personaId);
    return runtime?.state.statistics;
  }
}
