import { AlertCircle, CheckCircle, Clock, Loader2, XCircle } from 'lucide-react';
import type { ScheduledTask } from '../services/persona-scheduler';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface WorkQueueProps {
  tasks: ScheduledTask[];
}

export function WorkQueue({ tasks }: WorkQueueProps) {
  const getStatusIcon = (status: ScheduledTask['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className='w-4 h-4' />;
      case 'assigned':
        return <AlertCircle className='w-4 h-4' />;
      case 'running':
        return <Loader2 className='w-4 h-4 animate-spin' />;
      case 'completed':
        return <CheckCircle className='w-4 h-4' />;
      case 'failed':
        return <XCircle className='w-4 h-4' />;
    }
  };

  const getStatusColor = (status: ScheduledTask['status']) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'assigned':
        return 'warning';
      case 'running':
        return 'warning';
      case 'completed':
        return 'success';
      case 'failed':
        return 'destructive';
    }
  };

  const getPriorityColor = (priority: ScheduledTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'warning';
      case 'low':
        return 'secondary';
    }
  };

  const groupedTasks = {
    pending: tasks.filter((t) => t.status === 'pending'),
    inProgress: tasks.filter((t) => t.status === 'assigned' || t.status === 'running'),
    completed: tasks.filter((t) => t.status === 'completed' || t.status === 'failed'),
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString();
  };

  const calculateDuration = (start: Date, end?: Date) => {
    const endTime = end || new Date();
    const duration = endTime.getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 h-full'>
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-semibold'>Pending</h3>
          <Badge>{groupedTasks.pending.length}</Badge>
        </div>
        <div className='space-y-3 overflow-y-auto max-h-[calc(100vh-250px)]'>
          {groupedTasks.pending.map((task) => (
            <Card key={task.id}>
              <CardHeader className='pb-3'>
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-2'>
                    {getStatusIcon(task.status)}
                    <CardTitle className='text-sm'>{task.personaType}</CardTitle>
                  </div>
                  <Badge variant={getPriorityColor(task.priority)}>{task.priority}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground'>{task.description}</p>
                <p className='text-xs text-muted-foreground mt-2'>Created: {formatTime(task.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-semibold'>In Progress</h3>
          <Badge>{groupedTasks.inProgress.length}</Badge>
        </div>
        <div className='space-y-3 overflow-y-auto max-h-[calc(100vh-250px)]'>
          {groupedTasks.inProgress.map((task) => (
            <Card key={task.id}>
              <CardHeader className='pb-3'>
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-2'>
                    {getStatusIcon(task.status)}
                    <CardTitle className='text-sm'>{task.personaType}</CardTitle>
                  </div>
                  <Badge variant={getStatusColor(task.status)}>{task.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground'>{task.description}</p>
                {task.personaId && <p className='text-xs text-muted-foreground mt-1'>Assigned to: {task.personaId}</p>}
                <p className='text-xs text-muted-foreground mt-2'>
                  Running for: {calculateDuration(task.assignedAt || task.createdAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-semibold'>Completed</h3>
          <Badge>{groupedTasks.completed.length}</Badge>
        </div>
        <div className='space-y-3 overflow-y-auto max-h-[calc(100vh-250px)]'>
          {groupedTasks.completed.map((task) => (
            <Card key={task.id}>
              <CardHeader className='pb-3'>
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-2'>
                    {getStatusIcon(task.status)}
                    <CardTitle className='text-sm'>{task.personaType}</CardTitle>
                  </div>
                  <Badge variant={getStatusColor(task.status)}>{task.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground'>{task.description}</p>
                {task.error && <p className='text-xs text-destructive mt-1'>Error: {task.error}</p>}
                <p className='text-xs text-muted-foreground mt-2'>
                  Duration: {calculateDuration(task.createdAt, task.completedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
