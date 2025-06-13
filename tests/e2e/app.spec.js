'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
const test_1 = require('@playwright/test');
const playwright_1 = require('playwright');
const path = __importStar(require('node:path'));
test_1.test.describe('Coding Team App', () => {
  (0, test_1.test)('should launch electron app and show main window', async () => {
    // Launch Electron app
    const electronApp = await playwright_1._electron.launch({
      args: [path.join(__dirname, '../../dist/main.js')],
    });
    // Get the first window that the app opens
    const window = await electronApp.firstWindow();
    // Verify the window title
    const title = await window.title();
    (0, test_1.expect)(title).toBe('Coding Team');
    // Verify the main heading is present
    const heading = window.locator('h1');
    await (0, test_1.expect)(heading).toHaveText('🤖 Coding Team');
    // Verify status message
    const status = window.locator('.status');
    await (0, test_1.expect)(status).toContainText('Electron app successfully initialized');
    // Verify some key UI elements
    const subtitle = window.locator('.subtitle');
    await (0, test_1.expect)(subtitle).toContainText('AI-powered collaborative development orchestrator');
    // Check that features list is present
    const features = window.locator('.features');
    await (0, test_1.expect)(features).toBeVisible();
    // Close the app
    await electronApp.close();
  });
  (0, test_1.test)('should have working console and electron API', async () => {
    const electronApp = await playwright_1._electron.launch({
      args: [path.join(__dirname, '../../dist/main.js')],
    });
    const window = await electronApp.firstWindow();
    // Test that console.log works (checking renderer process)
    const consoleMessages = [];
    window.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });
    // Wait a bit for console messages to appear
    await window.waitForTimeout(1000);
    // Verify that the renderer process loaded
    (0, test_1.expect)(consoleMessages.some((msg) => msg.includes('Coding Team renderer loaded'))).toBe(true);
    await electronApp.close();
  });
});
//# sourceMappingURL=app.spec.js.map
