import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PersonaDefinition, PersonaType } from '../types/persona.js';

export class PersonaStore {
  private personas: Map<string, PersonaDefinition> = new Map();
  private personasPath: string;

  constructor(projectPath: string) {
    this.personasPath = path.join(projectPath, '.coding-team');
  }

  async initialize(): Promise<void> {
    await this.loadBuiltInPersonas();
    await this.loadProjectPersonas();
  }

  private async loadBuiltInPersonas(): Promise<void> {
    const builtInPersonas: PersonaDefinition[] = [
      {
        id: 'developer-pool',
        name: 'Developer Pool',
        type: 'developer',
        description: 'Works on GitHub issues in isolated git worktrees',
        systemPrompt:
          'You are a developer working on GitHub issues. You work in an isolated git worktree and cannot create or switch branches. Focus on implementing the assigned issue requirements thoroughly and accurately.',
        singleton: false, // Multiple developers can work on different issues
        capabilities: [
          { name: 'code-writing', description: 'Write and modify code', enabled: true },
          { name: 'testing', description: 'Write and run tests', enabled: true },
          { name: 'git-commit', description: 'Commit changes', enabled: true },
        ],
        constraints: {
          maxConcurrentTasks: 1,
          restrictedPaths: ['.git', 'node_modules'],
        },
      },
      {
        id: 'manager',
        name: 'Manager Persona',
        type: 'manager',
        description: 'Spawns developer agents, assigns issues, prevents conflicts',
        systemPrompt:
          'You are the development manager. Your role is to spawn developer agents, assign GitHub issues to them, and ensure no conflicts by adding comments to issues when work begins. Coordinate the development team effectively.',
        singleton: true, // Only one manager coordinates the team
        capabilities: [
          { name: 'spawn-agents', description: 'Create new developer instances', enabled: true },
          { name: 'assign-issues', description: 'Assign GitHub issues to developers', enabled: true },
          { name: 'monitor-progress', description: 'Track developer progress', enabled: true },
        ],
      },
      {
        id: 'pr-reviewer',
        name: 'PR Reviewer',
        type: 'pr-reviewer',
        description: 'Reviews pull requests when triggered by events',
        systemPrompt:
          'You are a code reviewer. Review pull requests for code quality, adherence to project standards, potential bugs, and suggest improvements. Be thorough but constructive in your feedback.',
        singleton: false, // Multiple reviewers can review different PRs
        capabilities: [
          { name: 'review-code', description: 'Review code changes', enabled: true },
          { name: 'suggest-improvements', description: 'Suggest code improvements', enabled: true },
          { name: 'approve-pr', description: 'Approve pull requests', enabled: true },
        ],
      },
      {
        id: 'landing-manager',
        name: 'Landing Manager',
        type: 'landing-manager',
        description: 'Merges approved PRs after CI passes',
        systemPrompt:
          'You are responsible for landing approved pull requests. Only merge PRs that have been approved and have passing CI. Ensure the main branch remains stable.',
        singleton: true, // Only one landing manager to avoid merge conflicts
        capabilities: [
          { name: 'merge-pr', description: 'Merge pull requests', enabled: true },
          { name: 'check-ci', description: 'Verify CI status', enabled: true },
        ],
      },
      {
        id: 'ci-monitor',
        name: 'CI Health Monitor',
        type: 'ci-monitor',
        description: 'Monitors CI status and responds to failures',
        systemPrompt:
          'You monitor the CI/CD pipeline health. When builds fail, analyze the errors and create issues or notify relevant team members. Track code quality metrics and technical debt.',
        singleton: true, // One monitor tracks all CI status
        capabilities: [
          { name: 'monitor-ci', description: 'Monitor CI pipelines', enabled: true },
          { name: 'analyze-failures', description: 'Analyze build failures', enabled: true },
          { name: 'create-issues', description: 'Create issues for problems', enabled: true },
        ],
      },
      {
        id: 'backlog-manager',
        name: 'Backlog Manager & Spec Refiner',
        type: 'backlog-manager',
        description: 'Manages backlog, refines specs, and prioritizes work based on dependencies',
        systemPrompt:
          'You manage the project backlog and refine issue specifications. Prioritize issues based on dependencies, business value, and technical requirements. Ensure issues have clear requirements, acceptance criteria, and are properly scoped. Ask clarifying questions and break down complex issues when needed.',
        singleton: true, // One source of truth for backlog management and spec refinement
        capabilities: [
          { name: 'prioritize-work', description: 'Prioritize backlog items', enabled: true },
          { name: 'manage-dependencies', description: 'Track issue dependencies', enabled: true },
          { name: 'refine-specs', description: 'Refine issue specifications', enabled: true },
          { name: 'ask-questions', description: 'Ask clarifying questions', enabled: true },
        ],
      },
      {
        id: 'qa-engineer',
        name: 'QA Engineer',
        type: 'qa-engineer',
        description: 'Tests features and reports bugs',
        systemPrompt:
          'You are a QA engineer. Test new features thoroughly, write test cases, and report bugs with detailed reproduction steps. Ensure quality standards are met.',
        singleton: false, // Multiple QA engineers can test different features
        capabilities: [
          { name: 'test-features', description: 'Test new features', enabled: true },
          { name: 'report-bugs', description: 'Report bugs with details', enabled: true },
          { name: 'write-test-cases', description: 'Create test cases', enabled: true },
        ],
      },
    ];

    for (const persona of builtInPersonas) {
      this.personas.set(persona.id, persona);
    }
  }

  private async loadProjectPersonas(): Promise<void> {
    try {
      const settingsPath = path.join(this.personasPath, 'settings.json');
      const settingsContent = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsContent);

      if (settings.personas) {
        for (const personaConfig of settings.personas) {
          // Load guidelines if specified
          if (personaConfig.guidelinesFile) {
            const guidelinesPath = path.join(this.personasPath, personaConfig.guidelinesFile);
            try {
              const guidelines = await readFile(guidelinesPath, 'utf-8');
              personaConfig.systemPrompt = `${personaConfig.systemPrompt}\n\nProject-specific guidelines:\n${guidelines}`;
              personaConfig.guidelinesPath = guidelinesPath;
            } catch (error) {
              console.warn(`Failed to load guidelines for ${personaConfig.id}:`, error);
            }
          }

          // Override or add persona
          this.personas.set(personaConfig.id, personaConfig);
        }
      }
    } catch (_error) {
      // No project personas defined, use defaults
    }
  }

  async saveProjectPersona(persona: PersonaDefinition): Promise<void> {
    const settingsPath = path.join(this.personasPath, 'settings.json');
    let settings: { personas: PersonaDefinition[] } = { personas: [] };

    try {
      const content = await readFile(settingsPath, 'utf-8');
      settings = JSON.parse(content);
    } catch (_error) {
      // Settings file doesn't exist yet
    }

    // Update or add persona
    const index = settings.personas.findIndex((p) => p.id === persona.id);
    if (index >= 0) {
      settings.personas[index] = persona;
    } else {
      settings.personas.push(persona);
    }

    await writeFile(settingsPath, JSON.stringify(settings, null, 2));
    this.personas.set(persona.id, persona);
  }

  getPersona(id: string): PersonaDefinition | undefined {
    return this.personas.get(id);
  }

  getPersonasByType(type: PersonaType): PersonaDefinition[] {
    return Array.from(this.personas.values()).filter((p) => p.type === type);
  }

  getAllPersonas(): PersonaDefinition[] {
    return Array.from(this.personas.values());
  }

  async loadPersonaGuidelines(personaId: string): Promise<string | null> {
    const persona = this.personas.get(personaId);
    if (!persona?.guidelinesPath) {
      return null;
    }

    try {
      return await readFile(persona.guidelinesPath, 'utf-8');
    } catch (error) {
      console.error(`Failed to load guidelines for ${personaId}:`, error);
      return null;
    }
  }
}
