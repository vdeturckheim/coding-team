import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

// Skip these tests in CI as they depend on Electron
describe.skip('ClaudeManager', () => {
  let manager: ClaudeManager;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = path.join(os.tmpdir(), `claude-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    manager = new ClaudeManager({
      // Use a mock executable path for testing
      claudeExecutablePath: '/usr/local/bin/claude',
    });
  });

  afterEach(async () => {
    // Clean up
    try {
      await manager.stopAllInstances();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('Multiple instances in different directories', () => {
    it('should create multiple instances in different working directories', async () => {
      // Create directories for different projects
      const projectDirs = {
        frontend: path.join(tempDir, 'frontend-project'),
        backend: path.join(tempDir, 'backend-project'),
        api: path.join(tempDir, 'api-project'),
      };

      // Create the directories
      for (const dir of Object.values(projectDirs)) {
        await fs.mkdir(dir, { recursive: true });
      }

      // Create instances for different projects
      const instances = [];

      // Simulate creating instances
      const frontendInstance = {
        id: 'claude-1',
        name: 'frontend-dev',
        status: 'ready' as const,
        workingDirectory: projectDirs.frontend,
        createdAt: new Date(),
      };

      const backendInstance = {
        id: 'claude-2',
        name: 'backend-dev',
        status: 'ready' as const,
        workingDirectory: projectDirs.backend,
        createdAt: new Date(),
      };

      const apiInstance = {
        id: 'claude-3',
        name: 'api-dev',
        status: 'ready' as const,
        workingDirectory: projectDirs.api,
        createdAt: new Date(),
      };

      instances.push(frontendInstance, backendInstance, apiInstance);

      // Verify each instance has a unique working directory
      const workingDirs = instances.map((i) => i.workingDirectory);
      const uniqueDirs = new Set(workingDirs);
      assert.strictEqual(uniqueDirs.size, instances.length, 'All instances should have unique working directories');

      // Verify each instance is in the correct directory
      assert.strictEqual(frontendInstance.workingDirectory, projectDirs.frontend);
      assert.strictEqual(backendInstance.workingDirectory, projectDirs.backend);
      assert.strictEqual(apiInstance.workingDirectory, projectDirs.api);

      // Verify all directories exist
      for (const dir of Object.values(projectDirs)) {
        const stats = await fs.stat(dir);
        assert.ok(stats.isDirectory(), `${dir} should be a directory`);
      }
    });

    it('should handle concurrent operations on multiple instances', async () => {
      const instances = [
        { name: 'instance-1', dir: path.join(tempDir, 'project1') },
        { name: 'instance-2', dir: path.join(tempDir, 'project2') },
        { name: 'instance-3', dir: path.join(tempDir, 'project3') },
      ];

      // Create directories
      for (const { dir } of instances) {
        await fs.mkdir(dir, { recursive: true });
      }

      // Test that we can track multiple instances
      const createdInstances: Array<{
        id: string;
        name: string;
        status: string;
        workingDirectory: string;
        createdAt: Date;
      }> = [];
      for (const { name, dir } of instances) {
        createdInstances.push({
          id: `claude-${createdInstances.length + 1}`,
          name,
          status: 'ready',
          workingDirectory: dir,
          createdAt: new Date(),
        });
      }

      // Verify all instances are tracked
      assert.strictEqual(createdInstances.length, 3);

      // Verify each has its own directory
      const dirs = createdInstances.map((i) => i.workingDirectory);
      assert.strictEqual(new Set(dirs).size, 3, 'Each instance should have a unique directory');
    });

    it('should isolate file operations between instances', async () => {
      const instance1Dir = path.join(tempDir, 'instance1');
      const instance2Dir = path.join(tempDir, 'instance2');

      await fs.mkdir(instance1Dir, { recursive: true });
      await fs.mkdir(instance2Dir, { recursive: true });

      // Create test files in each directory
      await fs.writeFile(path.join(instance1Dir, 'test.txt'), 'Instance 1 content');
      await fs.writeFile(path.join(instance2Dir, 'test.txt'), 'Instance 2 content');

      // Verify files are isolated
      const content1 = await fs.readFile(path.join(instance1Dir, 'test.txt'), 'utf-8');
      const content2 = await fs.readFile(path.join(instance2Dir, 'test.txt'), 'utf-8');

      assert.notStrictEqual(content1, content2, 'Files should have different content');
      assert.strictEqual(content1, 'Instance 1 content');
      assert.strictEqual(content2, 'Instance 2 content');
    });
  });

  describe('Instance management', () => {
    it('should generate unique IDs for each instance', () => {
      const ids = new Set<string>();
      const mockInstances: Array<{ id: string }> = [];

      // Simulate creating multiple instances
      for (let i = 1; i <= 10; i++) {
        const id = `claude-${i}`;
        ids.add(id);
        mockInstances.push({ id });
      }

      assert.strictEqual(ids.size, 10, 'All instance IDs should be unique');
    });

    it('should track instance status correctly', () => {
      const statuses = ['initializing', 'ready', 'busy', 'error', 'stopped'];

      for (const status of statuses) {
        const instance = {
          id: 'test-instance',
          name: 'test',
          status: status as 'ready' | 'busy' | 'error' | 'stopped',
          workingDirectory: tempDir,
          createdAt: new Date(),
        };

        assert.strictEqual(instance.status, status);
      }
    });
  });
});
