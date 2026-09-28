import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

import { API_URL, APP_URL, BACKEND_PORT, FRONTEND_PORT } from './e2e/support/env.ts'

const frontendDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(frontendDir, '../backend')
const python =
  process.env.E2E_PYTHON ??
  path.join(backendDir, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')

export default defineConfig({
  testDir: './e2e',
  // One worker keeps activity-log assertions deterministic (they read the newest entries).
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: `"${python}" scripts/e2e_server.py ${BACKEND_PORT}`,
      cwd: backendDir,
      url: `${API_URL}/health/`,
      reuseExistingServer: false,
      timeout: 120_000,
      // Django logs every request to stderr; set E2E_DEBUG=1 to see them.
      stderr: process.env.E2E_DEBUG ? 'pipe' : 'ignore',
      env: {
        CORS_ALLOWED_ORIGINS: APP_URL,
        AUTH_THROTTLE_RATE: '1000/minute',
        JWT_ACCESS_TOKEN_MINUTES: '60',
        USE_S3: 'False',
      },
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      url: APP_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_BASE_URL: API_URL },
    },
  ],
})
