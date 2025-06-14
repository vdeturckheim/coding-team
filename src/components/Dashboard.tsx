import { useEffect, useState } from 'react';
import type { ScheduledTask } from '../services/persona-scheduler';
import type { WorkflowDefinition } from '../services/workflow-orchestrator';
import type { PersonaDefinition, PersonaState } from '../types/persona';
import { ManagerInterface } from './ManagerInterface';
import { PersonaManager } from './PersonaManager';
import { SystemHealth } from './SystemHealth';
import { WorkQueue } from './WorkQueue';
import { WorkflowMonitor } from './WorkflowMonitor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface DashboardProps {
  personas: PersonaDefinition[];
  activePersonas: PersonaState[];
  tasks: ScheduledTask[];
  workflows: WorkflowDefinition[];
  onSpawnPersona: (personaId: string) => void;
  onTerminatePersona: (instanceId: string) => void;
  onToggleAutonomous: (instanceId: string, autonomous: boolean) => void;
  onAssignTask: (task: { personaType: string; description: string; priority: string }) => void;
  onManualTrigger: (workflowId: string) => void;
}

export function Dashboard({
  personas,
  activePersonas,
  tasks,
  workflows,
  onSpawnPersona,
  onTerminatePersona,
  onToggleAutonomous,
  onAssignTask,
  onManualTrigger,
}: DashboardProps) {
  const [selectedTab, setSelectedTab] = useState('personas');
  const [systemMetrics, setSystemMetrics] = useState({
    cpuUsage: 0,
    memoryUsage: 0,
    activeInstances: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
  });

  useEffect(() => {
    // Update system metrics
    setSystemMetrics({
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      activeInstances: activePersonas.length,
      tasksCompleted: tasks.filter((t) => t.status === 'completed').length,
      tasksFailed: tasks.filter((t) => t.status === 'failed').length,
    });
  }, [activePersonas, tasks]);

  return (
    <div className='h-screen bg-background'>
      <header className='border-b px-6 py-4'>
        <h1 className='text-2xl font-bold'>Coding Team Dashboard</h1>
        <p className='text-muted-foreground'>Manage your AI development team</p>
      </header>

      <main className='flex-1 p-6'>
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className='h-full'>
          <TabsList className='mb-4'>
            <TabsTrigger value='personas'>Personas</TabsTrigger>
            <TabsTrigger value='manager'>Manager</TabsTrigger>
            <TabsTrigger value='queue'>Work Queue</TabsTrigger>
            <TabsTrigger value='workflows'>Workflows</TabsTrigger>
            <TabsTrigger value='health'>System Health</TabsTrigger>
          </TabsList>

          <TabsContent value='personas' className='h-[calc(100%-3rem)]'>
            <PersonaManager
              personas={personas}
              activePersonas={activePersonas}
              onSpawnPersona={onSpawnPersona}
              onTerminatePersona={onTerminatePersona}
              onToggleAutonomous={onToggleAutonomous}
            />
          </TabsContent>

          <TabsContent value='manager' className='h-[calc(100%-3rem)]'>
            <ManagerInterface onAssignTask={onAssignTask} availablePersonas={personas} />
          </TabsContent>

          <TabsContent value='queue' className='h-[calc(100%-3rem)]'>
            <WorkQueue tasks={tasks} />
          </TabsContent>

          <TabsContent value='workflows' className='h-[calc(100%-3rem)]'>
            <WorkflowMonitor workflows={workflows} onManualTrigger={onManualTrigger} />
          </TabsContent>

          <TabsContent value='health' className='h-[calc(100%-3rem)]'>
            <SystemHealth metrics={systemMetrics} activePersonas={activePersonas} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
