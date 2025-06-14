import { AlertCircle, GitBranch, GitPullRequest, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PersonaDefinition } from '../types/persona';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  labels: { name: string; color: string }[];
  assignees: string[];
  created_at: string;
  url: string;
}

interface ManagerInterfaceProps {
  onAssignTask: (task: { personaType: string; description: string; priority: string }) => void;
  availablePersonas: PersonaDefinition[];
}

export function ManagerInterface({ onAssignTask, availablePersonas }: ManagerInterfaceProps) {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);

  useEffect(() => {
    // Simulate fetching GitHub issues
    const fetchIssues = async () => {
      try {
        // In real implementation, this would call the GitHub API
        const mockIssues: GitHubIssue[] = [
          {
            number: 45,
            title: 'Implement user authentication system',
            state: 'open',
            labels: [
              { name: 'P1', color: 'FF6600' },
              { name: 'feature', color: '0052CC' },
            ],
            assignees: [],
            created_at: new Date().toISOString(),
            url: 'https://github.com/org/repo/issues/45',
          },
          {
            number: 46,
            title: 'Fix CI pipeline failures',
            state: 'open',
            labels: [
              { name: 'P0', color: 'FF0000' },
              { name: 'bug', color: 'd73a49' },
            ],
            assignees: [],
            created_at: new Date().toISOString(),
            url: 'https://github.com/org/repo/issues/46',
          },
          {
            number: 47,
            title: 'Add unit tests for new components',
            state: 'open',
            labels: [
              { name: 'P2', color: '0E8A16' },
              { name: 'testing', color: 'FBCA04' },
            ],
            assignees: [],
            created_at: new Date().toISOString(),
            url: 'https://github.com/org/repo/issues/47',
          },
        ];
        setIssues(mockIssues);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
    // Set up polling
    const interval = setInterval(fetchIssues, 30000);
    return () => clearInterval(interval);
  }, []);

  const assignIssue = (issue: GitHubIssue) => {
    onAssignTask({
      personaType: 'developer',
      description: `Work on issue #${issue.number}: ${issue.title}`,
      priority: getPriorityFromLabels(issue.labels),
    });

    // Update local state to show it's assigned
    setIssues(issues.map((i) => (i.number === issue.number ? { ...i, assignees: ['AI Developer'] } : i)));
  };

  const spawnDeveloper = () => {
    // This would trigger spawning a new developer instance
    const developerPersona = availablePersonas.find((p) => p.type === 'developer');
    if (developerPersona) {
      // In real implementation, this would call the spawn function
      console.log('Spawning developer:', developerPersona.id);
    }
  };

  const getPriorityFromLabels = (labels: { name: string }[]): string => {
    if (labels.some((l) => l.name === 'P0')) {
      return 'high';
    }
    if (labels.some((l) => l.name === 'P1')) {
      return 'medium';
    }
    return 'low';
  };

  return (
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 h-full'>
      <div className='lg:col-span-2 space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>GitHub Issues</h2>
          <Button onClick={spawnDeveloper} variant='outline'>
            <Users className='w-4 h-4 mr-2' />
            Spawn Developer
          </Button>
        </div>

        <div className='space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]'>
          {loading ? (
            <Card>
              <CardContent className='text-center py-8'>
                <p className='text-muted-foreground'>Loading issues...</p>
              </CardContent>
            </Card>
          ) : issues.length === 0 ? (
            <Card>
              <CardContent className='text-center py-8'>
                <p className='text-muted-foreground'>No open issues found.</p>
              </CardContent>
            </Card>
          ) : (
            issues.map((issue) => (
              <Card
                key={issue.number}
                className={`cursor-pointer transition-colors ${
                  selectedIssue?.number === issue.number ? 'border-primary' : ''
                }`}
                onClick={() => setSelectedIssue(issue)}
              >
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <CardTitle className='text-base flex items-center gap-2'>
                        <GitPullRequest className='w-4 h-4' />#{issue.number}: {issue.title}
                      </CardTitle>
                      <div className='flex items-center gap-2 mt-2'>
                        {issue.labels.map((label) => (
                          <Badge key={label.name} style={{ backgroundColor: `#${label.color}` }} className='text-white'>
                            {label.name}
                          </Badge>
                        ))}
                        {issue.assignees.length > 0 && <Badge variant='success'>Assigned</Badge>}
                      </div>
                    </div>
                    {issue.assignees.length === 0 && (
                      <Button
                        size='sm'
                        onClick={(e) => {
                          e.stopPropagation();
                          assignIssue(issue);
                        }}
                      >
                        Assign
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className='space-y-4'>
        <h2 className='text-lg font-semibold'>Quick Actions</h2>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Spawn Team Members</CardTitle>
            <CardDescription>Create new AI team members</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <Button className='w-full' variant='outline' onClick={spawnDeveloper}>
              <Users className='w-4 h-4 mr-2' />
              Spawn Developer
            </Button>
            <Button className='w-full' variant='outline'>
              <GitBranch className='w-4 h-4 mr-2' />
              Spawn PR Reviewer
            </Button>
            <Button className='w-full' variant='outline'>
              <AlertCircle className='w-4 h-4 mr-2' />
              Spawn QA Engineer
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Team Status</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>Active Developers</span>
              <span className='font-medium'>3</span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>Issues In Progress</span>
              <span className='font-medium'>5</span>
            </div>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>PRs Under Review</span>
              <span className='font-medium'>2</span>
            </div>
          </CardContent>
        </Card>

        {selectedIssue && (
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Issue Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm font-medium mb-2'>#{selectedIssue.number}</p>
              <p className='text-sm text-muted-foreground mb-4'>{selectedIssue.title}</p>
              <a
                href={selectedIssue.url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-sm text-primary hover:underline'
              >
                View on GitHub →
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
