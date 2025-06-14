export type PersonaType =
  | 'developer'
  | 'manager'
  | 'pr-reviewer'
  | 'landing-manager'
  | 'ci-monitor'
  | 'spec-refiner'
  | 'backlog-manager'
  | 'qa-engineer';

export interface PersonaDefinition {
  id: string;
  name: string;
  type: PersonaType;
  description: string;
  systemPrompt: string;
  guidelinesPath?: string; // Path to .coding-team/persona-name.md
  capabilities: PersonaCapability[];
  constraints?: PersonaConstraints;
  singleton?: boolean; // If true, only one instance can exist at a time
  metadata?: Record<string, unknown>;
}

export interface PersonaCapability {
  name: string;
  description: string;
  enabled: boolean;
}

export interface PersonaConstraints {
  maxMemoryMB?: number;
  maxConcurrentTasks?: number;
  allowedBranches?: string[];
  restrictedPaths?: string[];
  timeoutMs?: number;
}

export interface PersonaState {
  personaId: string;
  instanceId?: string;
  status: 'idle' | 'active' | 'busy' | 'error' | 'suspended';
  currentTask?: string;
  memory: PersonaMemory;
  statistics: PersonaStatistics;
  lastActivity: Date;
}

export interface PersonaMemory {
  shortTerm: Record<string, unknown>;
  workingMemory: Record<string, unknown>;
  persistentFacts: string[];
}

export interface PersonaStatistics {
  tasksCompleted: number;
  tasksFailed: number;
  totalActiveTime: number;
  lastError?: string;
  createdAt: Date;
}

export interface PersonaCommunication {
  fromPersonaId: string;
  toPersonaId: string;
  messageType: 'request' | 'response' | 'notification' | 'broadcast';
  subject: string;
  content: unknown;
  timestamp: Date;
  messageId: string;
  inReplyTo?: string;
}
