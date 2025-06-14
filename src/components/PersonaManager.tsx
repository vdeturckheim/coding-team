import { Bot, MessageSquare, Play, Square, User } from 'lucide-react';
import { useState } from 'react';
import type { PersonaDefinition, PersonaState } from '../types/persona';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';

interface PersonaManagerProps {
  personas: PersonaDefinition[];
  activePersonas: PersonaState[];
  onSpawnPersona: (personaId: string) => void;
  onTerminatePersona: (instanceId: string) => void;
  onToggleAutonomous: (instanceId: string, autonomous: boolean) => void;
}

export function PersonaManager({
  personas,
  activePersonas,
  onSpawnPersona,
  onTerminatePersona,
  onToggleAutonomous,
}: PersonaManagerProps) {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  const getActiveCount = (personaId: string) => {
    return activePersonas.filter((p) => p.personaId === personaId).length;
  };

  const getStatusBadge = (status: PersonaState['status']) => {
    const variants: Record<PersonaState['status'], 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
      idle: 'default',
      active: 'success',
      busy: 'warning',
      error: 'destructive',
      suspended: 'secondary',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 h-full'>
      <div className='lg:col-span-1 space-y-4 overflow-y-auto'>
        <h2 className='text-lg font-semibold'>Available Personas</h2>
        {personas.map((persona) => {
          const activeCount = getActiveCount(persona.id);
          const canSpawn = !persona.singleton || activeCount === 0;

          return (
            <Card
              key={persona.id}
              className={`cursor-pointer transition-colors ${selectedPersona === persona.id ? 'border-primary' : ''}`}
              onClick={() => setSelectedPersona(persona.id)}
            >
              <CardHeader className='pb-3'>
                <div className='flex items-center justify-between'>
                  <CardTitle className='text-base'>{persona.name}</CardTitle>
                  <div className='flex items-center gap-2'>
                    {persona.singleton && <Badge variant='outline'>Singleton</Badge>}
                    <Badge variant='secondary'>{activeCount} active</Badge>
                  </div>
                </div>
                <CardDescription className='text-xs'>{persona.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation();
                    onSpawnPersona(persona.id);
                  }}
                  disabled={!canSpawn}
                  className='w-full'
                >
                  <Play className='w-4 h-4 mr-2' />
                  Spawn Instance
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className='lg:col-span-2 space-y-4'>
        <h2 className='text-lg font-semibold'>Active Instances</h2>
        <div className='space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]'>
          {activePersonas.length === 0 ? (
            <Card>
              <CardContent className='text-center py-8'>
                <p className='text-muted-foreground'>No active personas. Spawn one to get started.</p>
              </CardContent>
            </Card>
          ) : (
            activePersonas.map((instance) => {
              const persona = personas.find((p) => p.id === instance.personaId);
              if (!persona) {
                return null;
              }

              return (
                <Card key={instance.instanceId}>
                  <CardHeader>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3'>
                        <div className='p-2 bg-primary/10 rounded-lg'>
                          {instance.status === 'active' || instance.status === 'busy' ? (
                            <Bot className='w-5 h-5 text-primary' />
                          ) : (
                            <User className='w-5 h-5 text-primary' />
                          )}
                        </div>
                        <div>
                          <CardTitle className='text-base'>{persona.name}</CardTitle>
                          <CardDescription className='text-xs'>{instance.instanceId}</CardDescription>
                        </div>
                      </div>
                      <div className='flex items-center gap-2'>
                        {getStatusBadge(instance.status)}
                        <Button
                          size='sm'
                          variant='destructive'
                          onClick={() => instance.instanceId && onTerminatePersona(instance.instanceId)}
                        >
                          <Square className='w-4 h-4' />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm font-medium'>Autonomous Mode</span>
                      <Switch
                        checked={instance.status === 'active' || instance.status === 'busy'}
                        onCheckedChange={(checked) => instance.instanceId && onToggleAutonomous(instance.instanceId, checked)}
                      />
                    </div>
                    {instance.currentTask && (
                      <div className='p-3 bg-muted rounded-lg'>
                        <p className='text-sm font-medium mb-1'>Current Task</p>
                        <p className='text-xs text-muted-foreground'>{instance.currentTask}</p>
                      </div>
                    )}
                    <div className='grid grid-cols-2 gap-4 text-sm'>
                      <div>
                        <p className='text-muted-foreground'>Tasks Completed</p>
                        <p className='font-medium'>{instance.statistics.tasksCompleted}</p>
                      </div>
                      <div>
                        <p className='text-muted-foreground'>Tasks Failed</p>
                        <p className='font-medium'>{instance.statistics.tasksFailed}</p>
                      </div>
                    </div>
                    <Button size='sm' variant='outline' className='w-full'>
                      <MessageSquare className='w-4 h-4 mr-2' />
                      Open Chat
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
