import assert from 'node:assert';
import { beforeEach, describe, test } from 'node:test';
import { InstanceManager } from '../../src/services/instance-manager.js';

describe('InstanceManager', () => {
  let manager: InstanceManager;
  const testGitPath = '/test/git/path';

  beforeEach(() => {
    manager = new InstanceManager({
      gitPath: testGitPath,
      healthCheckInterval: 1000, // 1 second for tests
      maxRestartAttempts: 2,
    });
  });

  test('should create instance manager with correct options', () => {
    assert.ok(manager);
  });

  test('should get empty instances initially', () => {
    const instances = manager.getAllInstances();
    assert.strictEqual(instances.length, 0);
  });

  test('should get instances by type when empty', () => {
    const developers = manager.getInstancesByType('developer');
    assert.strictEqual(developers.length, 0);
  });

  test('should throw error when getting non-existent instance', () => {
    const instance = manager.getInstance('non-existent');
    assert.strictEqual(instance, undefined);
  });

  test('should throw error when sending message to non-existent instance', async () => {
    try {
      await manager.sendMessage('non-existent', 'Hello');
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok((error as Error).message.includes('not found'));
    }
  });

  test('should throw error when terminating non-existent instance', async () => {
    try {
      await manager.terminateInstance('non-existent');
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok((error as Error).message.includes('not found'));
    }
  });

  test('should throw error when restarting non-existent instance', async () => {
    try {
      await manager.restartInstance('non-existent');
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok((error as Error).message.includes('not found'));
    }
  });
});
