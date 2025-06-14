import { AlertTriangle, CheckCircle, Clock, GitPullRequest, Play, TestTube } from 'lucide-react';
import type React from 'react';
import type { WorkflowDefinition } from '../services/workflow-orchestrator';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface WorkflowMonitorProps {
  workflows: WorkflowDefinition[];
  onManualTrigger: (workflowId: string) => void;
}

export function WorkflowMonitor({ workflows, onManualTrigger }: WorkflowMonitorProps) {
  const getWorkflowIcon = (workflowId: string) => {
    const icons: Record<string, React.ReactNode> = {
      'issue-assignment': <GitPullRequest className='w-5 h-5' />,
      'pr-review': <CheckCircle className='w-5 h-5' />,
      'pr-landing': <GitPullRequest className='w-5 h-5' />,
      'post-merge-qa': <TestTube className='w-5 h-5' />,
      'ci-monitoring': <AlertTriangle className='w-5 h-5' />,
      'backlog-grooming': <Clock className='w-5 h-5' />,
    };
    return icons[workflowId] || <Play className='w-5 h-5' />;
  };

  const getTriggerTypeColor = (type: string) => {
    switch (type) {
      case 'github-event':
        return 'default';
      case 'schedule':
        return 'secondary';
      case 'manual':
        return 'outline';
      case 'cascade':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
      {workflows.map((workflow) => (
        <Card key={workflow.id}>
          <CardHeader>
            <div className='flex items-start justify-between'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-primary/10 rounded-lg'>{getWorkflowIcon(workflow.id)}</div>
                <div>
                  <CardTitle className='text-base'>{workflow.name}</CardTitle>
                  <CardDescription className='text-xs mt-1'>{workflow.description}</CardDescription>
                </div>
              </div>
              <Badge variant={workflow.enabled ? 'success' : 'secondary'}>
                {workflow.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <p className='text-sm font-medium mb-2'>Triggers</p>
              <div className='flex flex-wrap gap-2'>
                {workflow.triggers.map((trigger) => (
                  <Badge key={trigger.id} variant={getTriggerTypeColor(trigger.type)}>
                    {trigger.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className='text-sm font-medium mb-2'>Workflow Steps</p>
              <div className='space-y-2'>
                {workflow.steps.map((step, index) => (
                  <div key={step.id} className='flex items-center gap-2 text-sm'>
                    <span className='text-muted-foreground'>{index + 1}.</span>
                    <span className='font-medium'>{step.personaType}</span>
                    <span className='text-muted-foreground'>→</span>
                    <span>{step.action}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className='pt-2'>
              <Button
                size='sm'
                variant='outline'
                className='w-full'
                onClick={() => onManualTrigger(workflow.id)}
                disabled={!workflow.enabled}
              >
                <Play className='w-4 h-4 mr-2' />
                Trigger Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
