import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function takeScreenshot() {
  const mainJsPath = path.join(__dirname, '../dist/main.js');

  // Launch Electron app
  const electronApp = await electron.launch({
    args: [mainJsPath],
  });

  // Get the first window
  const window = await electronApp.firstWindow();

  // Navigate to the Claude test page
  const testPagePath = path.join(__dirname, '../public/claude-test.html');
  await window.evaluate((pagePath) => {
    window.location.href = `file://${pagePath}`;
  }, testPagePath);

  // Wait for the test page to load
  await window.waitForTimeout(2000);

  // Take screenshot
  await window.screenshot({
    path: 'screenshot-claude-integration.png',
    fullPage: true,
  });

  console.log('Screenshot saved as screenshot-claude-integration.png');

  // Close the app
  await electronApp.close();
}

takeScreenshot().catch(console.error);
