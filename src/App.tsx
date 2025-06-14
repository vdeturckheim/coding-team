import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { GitHubEventHandler } from './services/github-event-handler';
import { InstanceManager } from './services/instance-manager';
import { PersonaEnvironment } from './services/persona-runtime';
import { PersonaScheduler } from './services/persona-scheduler';
import type { ScheduledTask } from './services/persona-scheduler';
import { PersonaStore } from './services/persona-store';
import { WorkflowOrchestrator } from './services/workflow-orchestrator';
import type { WorkflowDefinition } from './services/workflow-orchestrator';
import type { PersonaDefinition, PersonaState } from './types/persona';

export function App() {
  const [personas, setPersonas] = useState<PersonaDefinition[]>([]);
  const [activePersonas, setActivePersonas] = useState<PersonaState[]>([]);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [services, setServices] = useState<{
    personaStore?: PersonaStore;
    instanceManager?: InstanceManager;
    personaRuntime?: PersonaEnvironment;
    scheduler?: PersonaScheduler;
    orchestrator?: WorkflowOrchestrator;
    githubHandler?: GitHubEventHandler;
  }>({});

  useEffect(() => {
    // Initialize services
    const initializeServices = async () => {
      try {
        // Get project path from Electron
        const projectPath = (await window.electronAPI?.getProjectPath()) || process.cwd();

        // Initialize persona store
        const personaStore = new PersonaStore(projectPath);
        await personaStore.initialize();
        setPersonas(personaStore.getAllPersonas());

        // Initialize instance manager
        const instanceManager = new InstanceManager({
          gitPath: projectPath,
          healthCheckInterval: 30000,
        });
        await instanceManager.initialize();

        // Initialize persona runtime
        const personaRuntime = new PersonaEnvironment(instanceManager, personaStore, projectPath);

        // Initialize scheduler
        const scheduler = new PersonaScheduler(personaRuntime, {
          maxConcurrentPersonas: 10,
        });

        // Initialize GitHub handler
        const githubHandler = new GitHubEventHandler('vdeturckheim/coding-team');
        await githubHandler.start();

        // Initialize workflow orchestrator
        const orchestrator = new WorkflowOrchestrator(scheduler, githubHandler);
        await orchestrator.start();
        setWorkflows(orchestrator.getAllWorkflows());

        // Store services
        setServices({
          personaStore,
          instanceManager,
          personaRuntime,
          scheduler,
          orchestrator,
          githubHandler,
        });

        // Set up event listeners
        personaRuntime.on('personaSpawned', () => {
          setActivePersonas(personaRuntime.getActivePersonas().map((p) => p.state));
        });

        personaRuntime.on('personaTerminated', () => {
          setActivePersonas(personaRuntime.getActivePersonas().map((p) => p.state));
        });

        scheduler.on('taskScheduled', () => {
          setTasks(scheduler.getAllTasks());
        });

        scheduler.on('taskCompleted', () => {
          setTasks(scheduler.getAllTasks());
        });

        scheduler.on('taskFailed', () => {
          setTasks(scheduler.getAllTasks());
        });
      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };

    initializeServices();

    // Cleanup
    return () => {
      services.scheduler?.stopSchedulingLoop();
      services.orchestrator?.stop();
      services.githubHandler?.stop();
      services.instanceManager?.cleanup();
    };
  }, []);

  const handleSpawnPersona = async (personaId: string) => {
    if (!services.personaRuntime) {
      return;
    }

    try {
      await services.personaRuntime.spawnPersona(personaId);
      setActivePersonas(services.personaRuntime.getActivePersonas().map((p) => p.state));
    } catch (error) {
      console.error('Failed to spawn persona:', error);
    }
  };

  const handleTerminatePersona = async (instanceId: string) => {
    if (!services.personaRuntime) {
      return;
    }

    try {
      await services.personaRuntime.terminatePersona(instanceId);
      setActivePersonas(services.personaRuntime.getActivePersonas().map((p) => p.state));
    } catch (error) {
      console.error('Failed to terminate persona:', error);
    }
  };

  const handleToggleAutonomous = async (instanceId: string, autonomous: boolean) => {
    if (!services.personaRuntime) {
      return;
    }

    const runtime = services.personaRuntime.getActivePersonas().find((p) => p.state.instanceId === instanceId);
    if (runtime) {
      runtime.state.status = autonomous ? 'active' : 'suspended';
      setActivePersonas(services.personaRuntime.getActivePersonas().map((p) => p.state));
    }
  };

  const handleAssignTask = async (task: { personaType: string; description: string; priority: string }) => {
    if (!services.scheduler) {
      return;
    }

    try {
      await services.scheduler.scheduleTask({
        personaType: task.personaType,
        priority: task.priority as 'high' | 'medium' | 'low',
        description: task.description,
      });
      setTasks(services.scheduler.getAllTasks());
    } catch (error) {
      console.error('Failed to assign task:', error);
    }
  };

  const handleManualTrigger = async (workflowId: string) => {
    if (!services.orchestrator) {
      return;
    }

    try {
      const workflow = services.orchestrator.getWorkflow(workflowId);
      if (workflow) {
        await services.orchestrator.executeWorkflow(workflow, { trigger: 'manual' });
      }
    } catch (error) {
      console.error('Failed to trigger workflow:', error);
    }
  };

  return (
    <Dashboard
      personas={personas}
      activePersonas={activePersonas}
      tasks={tasks}
      workflows={workflows}
      onSpawnPersona={handleSpawnPersona}
      onTerminatePersona={handleTerminatePersona}
      onToggleAutonomous={handleToggleAutonomous}
      onAssignTask={handleAssignTask}
      onManualTrigger={handleManualTrigger}
    />
  );
}
