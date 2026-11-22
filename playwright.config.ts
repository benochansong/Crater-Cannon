import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', timeout: 180000, workers: 1, use: { browserName: 'firefox', baseURL: 'http://127.0.0.1:4187', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' }, webServer: { command: 'npm run dev -- --mode test --port 4187 --strictPort', url: 'http://127.0.0.1:4187', reuseExistingServer: false }, reporter: [['list'], ['html', { open: 'never' }]] });

