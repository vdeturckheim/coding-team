import { exec } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface Worktree {
  path: string;
  head: string;
  branch?: string;
  detached: boolean;
  prunable: boolean;
}

export class WorktreeManager {
  private worktreesPath: string;
  private gitPath: string;

  constructor(gitPath: string) {
    this.gitPath = gitPath;
    this.worktreesPath = path.join(os.homedir(), '.coding-team', 'worktrees');
  }

  async initialize(): Promise<void> {
    await mkdir(this.worktreesPath, { recursive: true });
  }

  async listWorktrees(): Promise<Worktree[]> {
    try {
      const { stdout } = await execAsync('git worktree list --porcelain', {
        cwd: this.gitPath,
      });

      const worktrees: Worktree[] = [];
      const lines = stdout.trim().split('\n');
      let currentWorktree: Partial<Worktree> = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as Worktree);
          }
          currentWorktree = {
            path: line.substring(9),
            detached: false,
            prunable: false,
          };
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.head = line.substring(5);
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7);
        } else if (line === 'detached') {
          currentWorktree.detached = true;
        } else if (line.startsWith('prunable ')) {
          currentWorktree.prunable = true;
        }
      }

      if (currentWorktree.path) {
        worktrees.push(currentWorktree as Worktree);
      }

      return worktrees;
    } catch (error) {
      throw new Error(`Failed to list worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createWorktree(instanceId: string, branch?: string): Promise<string> {
    const worktreePath = path.join(this.worktreesPath, instanceId);

    try {
      // Create the worktree directory
      await mkdir(worktreePath, { recursive: true });

      // Create the worktree
      const branchArg = branch ? branch : 'HEAD';
      await execAsync(`git worktree add "${worktreePath}" ${branchArg}`, {
        cwd: this.gitPath,
      });

      return worktreePath;
    } catch (error) {
      // Clean up on failure
      await this.removeWorktree(worktreePath).catch(() => {});
      throw new Error(`Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    try {
      // Remove the worktree from git
      await execAsync(`git worktree remove "${worktreePath}" --force`, {
        cwd: this.gitPath,
      });
    } catch (error) {
      // If git removal fails, try to clean up manually
      try {
        await rm(worktreePath, { recursive: true, force: true });
        // Prune worktree references
        await execAsync('git worktree prune', { cwd: this.gitPath });
      } catch (_cleanupError) {
        throw new Error(`Failed to remove worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  async pruneWorktrees(): Promise<void> {
    try {
      await execAsync('git worktree prune', { cwd: this.gitPath });
    } catch (error) {
      throw new Error(`Failed to prune worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getWorktreePath(instanceId: string): Promise<string | null> {
    const worktrees = await this.listWorktrees();
    const expectedPath = path.join(this.worktreesPath, instanceId);
    const worktree = worktrees.find((w) => w.path === expectedPath);
    return worktree ? worktree.path : null;
  }

  async cleanupOrphanedWorktrees(): Promise<void> {
    const worktrees = await this.listWorktrees();
    const orphaned = worktrees.filter((w) => w.prunable);

    for (const worktree of orphaned) {
      await this.removeWorktree(worktree.path);
    }
  }
}
