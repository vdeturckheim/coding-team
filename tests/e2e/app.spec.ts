import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('Coding Team App', () => {
  test('should launch electron app and show main window', async () => {
    // Launch Electron app with CI-friendly options
    const electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../dist/main.js'),
        ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
      ],
    });

    // Get the first window that the app opens
    const window = await electronApp.firstWindow();

    // Verify the window title
    const title = await window.title();
    expect(title).toBe('Coding Team');

    // Verify the main heading is present
    const heading = window.locator('h1');
    await expect(heading).toHaveText('🤖 Coding Team');

    // Verify status message
    const status = window.locator('.status');
    await expect(status).toContainText('Electron app successfully initialized');

    // Verify some key UI elements
    const subtitle = window.locator('.subtitle');
    await expect(subtitle).toContainText('AI-powered collaborative development orchestrator');

    // Check that features list is present
    const features = window.locator('.features');
    await expect(features).toBeVisible();

    // Close the app
    await electronApp.close();
  });

  test('should have working console and electron API', async () => {
    const electronApp = await electron.launch({
      args: [
        path.join(__dirname, '../../dist/main.js'),
        ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
      ],
    });

    const window = await electronApp.firstWindow();

    // Test that console.log works (checking renderer process)
    const consoleMessages: string[] = [];
    window.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    // Wait a bit for console messages to appear
    await window.waitForTimeout(1000);

    // Verify that the renderer process loaded
    expect(consoleMessages.some((msg) => msg.includes('Coding Team renderer loaded'))).toBe(true);

    await electronApp.close();
  });
});
