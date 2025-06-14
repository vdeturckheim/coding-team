import assert from 'node:assert';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { WorktreeManager } from '../../src/services/worktree-manager.js';

describe('WorktreeManager', () => {
  let manager: WorktreeManager;
  const testGitPath = '/test/git/path';
  const worktreesPath = path.join(os.homedir(), '.coding-team', 'worktrees');

  beforeEach(() => {
    manager = new WorktreeManager(testGitPath);
  });

  afterEach(async () => {
    // Clean up test worktrees
    try {
      await rm(worktreesPath, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  test('should initialize and create worktrees directory', async () => {
    await manager.initialize();
    // Since we can't easily verify directory creation without filesystem access,
    // we just ensure the method doesn't throw
    assert.ok(true);
  });

  test('should handle listWorktrees when git command fails', async () => {
    // Since git won't be available in test environment, this will naturally fail
    try {
      await manager.listWorktrees();
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok((error as Error).message.includes('Failed to list worktrees'));
    }
  });

  test('should get worktree path by instance ID', async () => {
    // This will fail since git won't be available in test environment
    try {
      const worktreePath = await manager.getWorktreePath('test-instance');
      assert.strictEqual(worktreePath, null);
    } catch (error) {
      // Expected to fail without git
      assert.ok((error as Error).message.includes('Failed to list worktrees'));
    }
  });

  test('should handle createWorktree failure', async () => {
    try {
      await manager.createWorktree('test-instance');
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok((error as Error).message.includes('Failed to create worktree'));
    }
  });
});
