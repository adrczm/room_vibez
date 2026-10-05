import { defineConfig } from '@playwright/test';

// Uses the locally installed Google Chrome (channel: 'chrome') so no browser download is required.
// SwiftShader flags make WebGL work in headless mode.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:18777',
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:18777',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  reporter: [['list']],
  outputDir: 'tests/e2e/screenshots',
});
