import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function takeScreenshots() {
  const mainJsPath = path.join(__dirname, '../dist/main.js');
  
  // Launch Electron app
  const electronApp = await electron.launch({
    args: [mainJsPath],
  });

  // Get the first window
  const window = await electronApp.firstWindow();
  
  // Wait for the app to fully load
  await window.waitForTimeout(1000);
  
  // Take screenshot
  await window.screenshot({ 
    path: 'screenshot-app.png',
    fullPage: true 
  });
  
  console.log('Screenshot saved as screenshot-app.png');
  
  // Close the app
  await electronApp.close();
}

takeScreenshots().catch(console.error);