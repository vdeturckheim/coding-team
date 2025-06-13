import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ConfigService } from '../../src/services/config.js';

describe('ConfigService', () => {
  let configService: ConfigService;
  let testConfigPath: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    // Mock home directory for testing
    originalHome = process.env.HOME;
    const testHome = path.join(os.tmpdir(), `config-test-${Date.now()}`);
    process.env.HOME = testHome;

    testConfigPath = path.join(testHome, '.coding-team', 'config.json');
    configService = new ConfigService();
  });

  afterEach(async () => {
    // Restore original home
    if (originalHome) {
      process.env.HOME = originalHome;
    }

    // Clean up test directory
    try {
      const testHome = path.dirname(path.dirname(testConfigPath));
      await fs.rm(testHome, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration storage', () => {
    it('should store config in ~/.coding-team/config.json', async () => {
      await configService.initialize();

      // Check that config file was created
      const stats = await fs.stat(testConfigPath);
      assert.ok(stats.isFile(), 'Config file should exist');

      // Verify it's in the correct location
      assert.ok(testConfigPath.includes('.coding-team'), 'Config should be in .coding-team directory');
      assert.ok(testConfigPath.endsWith('config.json'), 'Config file should be named config.json');
    });

    it('should not store Claude executable path by default', async () => {
      await configService.initialize();

      const configContent = await fs.readFile(testConfigPath, 'utf-8');
      const config = JSON.parse(configContent);

      assert.strictEqual(config.claudeExecutablePath, undefined, 'Claude path should not be stored by default');
    });

    it('should persist Claude executable path when set', async () => {
      await configService.initialize();

      const testPath = '/usr/local/bin/claude';
      configService.setClaudeExecutablePath(testPath);

      // Wait a bit for auto-save
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Read config file directly
      const configContent = await fs.readFile(testConfigPath, 'utf-8');
      const config = JSON.parse(configContent);

      assert.strictEqual(config.claudeExecutablePath, testPath, 'Claude path should be persisted');
    });

    it('should use environment variable if set', () => {
      const envPath = '/opt/claude/bin/claude';
      process.env.CLAUDE_EXECUTABLE_PATH = envPath;

      const service = new ConfigService();
      assert.strictEqual(service.getClaudeExecutablePath(), envPath, 'Should use env variable');

      process.env.CLAUDE_EXECUTABLE_PATH = undefined;
    });
  });

  describe('Default configuration', () => {
    it('should have correct default values', async () => {
      await configService.initialize();

      assert.strictEqual(configService.get('defaultModel'), 'claude-3-5-sonnet-20241022');
      assert.strictEqual(configService.get('maxConcurrentInstances'), 5);
      assert.strictEqual(configService.get('instanceTimeout'), 300000);
      assert.strictEqual(configService.get('autoSaveConfig'), true);
    });
  });

  describe('Configuration updates', () => {
    it('should update config values', async () => {
      await configService.initialize();

      configService.set('maxConcurrentInstances', 10);
      assert.strictEqual(configService.get('maxConcurrentInstances'), 10);

      configService.set('defaultModel', 'claude-3-opus-20240229');
      assert.strictEqual(configService.get('defaultModel'), 'claude-3-opus-20240229');
    });

    it('should auto-save changes when enabled', async () => {
      await configService.initialize();

      configService.set('maxConcurrentInstances', 3);

      // Wait for auto-save
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create new instance and load
      const newService = new ConfigService();
      await newService.initialize();

      assert.strictEqual(newService.get('maxConcurrentInstances'), 3, 'Changes should persist');
    });

    it('should not auto-save when disabled', async () => {
      await configService.initialize();
      configService.set('autoSaveConfig', false);

      configService.set('maxConcurrentInstances', 7);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create new instance and load
      const newService = new ConfigService();
      await newService.initialize();

      assert.strictEqual(newService.get('maxConcurrentInstances'), 5, 'Changes should not persist');
    });
  });

  describe('Error handling', () => {
    it('should create config file if it does not exist', async () => {
      // Ensure config doesn't exist
      try {
        await fs.unlink(testConfigPath);
      } catch (_error) {
        // Ignore if doesn't exist
      }

      await configService.initialize();

      // Should create the file
      const stats = await fs.stat(testConfigPath);
      assert.ok(stats.isFile(), 'Config file should be created');
    });

    it('should handle corrupted config files', async () => {
      // Create corrupted config
      await fs.mkdir(path.dirname(testConfigPath), { recursive: true });
      await fs.writeFile(testConfigPath, 'invalid json content');

      // Should throw error
      await assert.rejects(async () => configService.initialize(), /JSON/, 'Should throw JSON parse error');
    });
  });
});
