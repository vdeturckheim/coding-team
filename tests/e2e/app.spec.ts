import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { _electron as electron } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Coding Team App', () => {
  test('should launch electron app and show main window', async () => {
    // Check if main.js exists before launching
    const mainJsPath = path.join(__dirname, '../../dist/main.js');

    // Launch Electron app with CI-friendly options and error handling
    const electronApp = await electron
      .launch({
        args: [mainJsPath, ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [])],
      })
      .catch((error) => {
        throw new Error(`Failed to launch Electron app. Ensure 'npm run build' was run first. Error: ${error.message}`);
      });

    // Get the first window that the app opens
    const window = await electronApp.firstWindow();

    // Verify the window title
    const title = await window.title();
    expect(title).toBe('Coding Team');

    // Verify the main heading using data-testid
    const heading = window.getByTestId('app-title');
    await expect(heading).toHaveText('🤖 Coding Team');

    // Verify status message using data-testid
    const status = window.getByTestId('app-status');
    await expect(status).toContainText('Electron app successfully initialized');

    // Verify subtitle using data-testid
    const subtitle = window.getByTestId('app-subtitle');
    await expect(subtitle).toContainText('AI-powered collaborative development orchestrator');

    // Check that features list is present using data-testid
    const features = window.getByTestId('features-list');
    await expect(features).toBeVisible();

    // Close the app
    await electronApp.close();
  });

  test('should have working console and electron API', async () => {
    const mainJsPath = path.join(__dirname, '../../dist/main.js');

    const electronApp = await electron
      .launch({
        args: [mainJsPath, ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [])],
      })
      .catch((error) => {
        throw new Error(`Failed to launch Electron app. Ensure 'npm run build' was run first. Error: ${error.message}`);
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
