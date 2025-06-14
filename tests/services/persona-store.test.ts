import assert from 'node:assert';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { PersonaStore } from '../../src/services/persona-store.js';

describe('PersonaStore', () => {
  let store: PersonaStore;
  const testProjectPath = path.join(os.tmpdir(), 'test-coding-team-project');
  const personasPath = path.join(testProjectPath, '.coding-team');

  beforeEach(async () => {
    await mkdir(personasPath, { recursive: true });
    store = new PersonaStore(testProjectPath);
  });

  afterEach(async () => {
    try {
      await rm(testProjectPath, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  test('should load built-in personas', async () => {
    await store.initialize();
    const personas = store.getAllPersonas();

    assert.ok(personas.length > 0);
    assert.ok(personas.some((p) => p.id === 'developer-pool'));
    assert.ok(personas.some((p) => p.id === 'manager'));
    assert.ok(personas.some((p) => p.id === 'pr-reviewer'));
  });

  test('should correctly identify singleton personas', async () => {
    await store.initialize();
    const manager = store.getPersona('manager');
    const developer = store.getPersona('developer-pool');
    const backlogManager = store.getPersona('backlog-manager');

    assert.strictEqual(manager?.singleton, true);
    assert.strictEqual(developer?.singleton, false);
    assert.strictEqual(backlogManager?.singleton, true);
  });

  test('should get personas by type', async () => {
    await store.initialize();
    const developers = store.getPersonasByType('developer');
    const managers = store.getPersonasByType('manager');

    assert.ok(developers.length > 0);
    assert.ok(managers.length > 0);
    assert.ok(developers.every((p) => p.type === 'developer'));
    assert.ok(managers.every((p) => p.type === 'manager'));
  });

  test('should load project-specific personas from settings.json', async () => {
    // Create a custom persona in settings.json
    const settings = {
      personas: [
        {
          id: 'custom-tester',
          name: 'Custom Tester',
          type: 'qa-engineer',
          description: 'Custom QA persona',
          systemPrompt: 'You are a custom QA engineer.',
          singleton: false,
          capabilities: [{ name: 'custom-testing', description: 'Custom testing', enabled: true }],
        },
      ],
    };

    await writeFile(path.join(personasPath, 'settings.json'), JSON.stringify(settings, null, 2));

    await store.initialize();
    const customPersona = store.getPersona('custom-tester');

    assert.ok(customPersona);
    assert.strictEqual(customPersona.name, 'Custom Tester');
    assert.strictEqual(customPersona.type, 'qa-engineer');
  });

  test('should load persona guidelines from markdown files', async () => {
    // Create guidelines file
    const guidelinesContent = '# Testing Guidelines\n\nAlways write comprehensive tests.';
    await writeFile(path.join(personasPath, 'qa-guidelines.md'), guidelinesContent);

    // Create settings with guidelines reference
    const settings = {
      personas: [
        {
          id: 'qa-with-guidelines',
          name: 'QA with Guidelines',
          type: 'qa-engineer',
          description: 'QA with project guidelines',
          systemPrompt: 'You are a QA engineer.',
          guidelinesFile: 'qa-guidelines.md',
          singleton: false,
          capabilities: [],
        },
      ],
    };

    await writeFile(path.join(personasPath, 'settings.json'), JSON.stringify(settings, null, 2));

    await store.initialize();
    const guidelines = await store.loadPersonaGuidelines('qa-with-guidelines');

    assert.ok(guidelines);
    assert.ok(guidelines.includes('Always write comprehensive tests'));
  });

  test('should save project persona', async () => {
    await store.initialize();

    const newPersona = {
      id: 'new-persona',
      name: 'New Persona',
      type: 'developer' as const,
      description: 'A new custom persona',
      systemPrompt: 'You are a new persona.',
      singleton: true,
      capabilities: [],
    };

    await store.saveProjectPersona(newPersona);

    const saved = store.getPersona('new-persona');
    assert.ok(saved);
    assert.strictEqual(saved.name, 'New Persona');
    assert.strictEqual(saved.singleton, true);
  });
});
