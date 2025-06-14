import { Activity, CheckCircle, Cpu, HardDrive, Users, XCircle } from 'lucide-react';
import type { PersonaState } from '../types/persona';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface SystemHealthProps {
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    activeInstances: number;
    tasksCompleted: number;
    tasksFailed: number;
  };
  activePersonas: PersonaState[];
}

export function SystemHealth({ metrics, activePersonas }: SystemHealthProps) {
  const getHealthStatus = () => {
    if (metrics.cpuUsage > 80 || metrics.memoryUsage > 80) {
      return 'critical';
    }
    if (metrics.cpuUsage > 60 || metrics.memoryUsage > 60) {
      return 'warning';
    }
    return 'healthy';
  };

  const healthStatus = getHealthStatus();
  const healthColors = {
    healthy: 'success',
    warning: 'warning',
    critical: 'destructive',
  };

  const formatPercentage = (value: number) => `${Math.round(value)}%`;

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm font-medium'>System Status</CardTitle>
              <Activity className='w-4 h-4 text-muted-foreground' />
            </div>
          </CardHeader>
          <CardContent>
            <Badge
              variant={healthColors[healthStatus] as 'success' | 'warning' | 'destructive'}
              className='w-full justify-center'
            >
              {healthStatus.toUpperCase()}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm font-medium'>CPU Usage</CardTitle>
              <Cpu className='w-4 h-4 text-muted-foreground' />
            </div>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div className='text-2xl font-bold'>{formatPercentage(metrics.cpuUsage)}</div>
              <div className='w-full bg-secondary rounded-full h-2'>
                <div
                  className={`h-2 rounded-full ${
                    metrics.cpuUsage > 80 ? 'bg-destructive' : metrics.cpuUsage > 60 ? 'bg-warning' : 'bg-success'
                  }`}
                  style={{ width: `${metrics.cpuUsage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm font-medium'>Memory Usage</CardTitle>
              <HardDrive className='w-4 h-4 text-muted-foreground' />
            </div>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div className='text-2xl font-bold'>{formatPercentage(metrics.memoryUsage)}</div>
              <div className='w-full bg-secondary rounded-full h-2'>
                <div
                  className={`h-2 rounded-full ${
                    metrics.memoryUsage > 80 ? 'bg-destructive' : metrics.memoryUsage > 60 ? 'bg-warning' : 'bg-success'
                  }`}
                  style={{ width: `${metrics.memoryUsage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm font-medium'>Active Instances</CardTitle>
              <Users className='w-4 h-4 text-muted-foreground' />
            </div>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{metrics.activeInstances}</div>
            <p className='text-xs text-muted-foreground'>Claude instances running</p>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Card>
          <CardHeader>
            <CardTitle>Task Statistics</CardTitle>
            <CardDescription>Overall task completion metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='w-4 h-4 text-green-500' />
                  <span className='text-sm'>Tasks Completed</span>
                </div>
                <span className='text-2xl font-bold'>{metrics.tasksCompleted}</span>
              </div>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <XCircle className='w-4 h-4 text-red-500' />
                  <span className='text-sm'>Tasks Failed</span>
                </div>
                <span className='text-2xl font-bold'>{metrics.tasksFailed}</span>
              </div>
              <div className='pt-4 border-t'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Success Rate</span>
                  <span className='font-medium'>
                    {metrics.tasksCompleted + metrics.tasksFailed > 0
                      ? formatPercentage(
                          (metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed)) * 100,
                        )
                      : '0%'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Personas</CardTitle>
            <CardDescription>Current persona distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {Object.entries(
                activePersonas.reduce(
                  (acc, persona) => {
                    const type = persona.personaId.split('-')[0];
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>,
                ),
              ).map(([type, count]) => (
                <div key={type} className='flex items-center justify-between'>
                  <span className='text-sm capitalize'>{type}</span>
                  <Badge variant='secondary'>{count}</Badge>
                </div>
              ))}
              {activePersonas.length === 0 && (
                <p className='text-sm text-muted-foreground text-center py-4'>No active personas</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
