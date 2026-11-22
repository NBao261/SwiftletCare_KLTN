import { defineConfig, devices } from '@playwright/test';

// E2E chạy trên web thật nối backend đã seed; job CI `e2e` dựng backend trước
export default defineConfig({
  testDir: './e2e',
  // Một backend dùng chung cho mọi test: chạy tuần tự để test không giẫm dữ liệu của nhau
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // JUnit cho (gen_report5.py --playwright e2e-junit.xml)
  reporter: [['list'], ['junit', { outputFile: 'e2e-junit.xml' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Web dev server (proxy /api sang backend :3000); backend phải chạy sẵn
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
