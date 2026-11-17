/**
 * playwright.config.ts — Cấu hình E2E Playwright cho SwiftletCare web
 *
 * Chủ file: Nguyễn Thị Yến Nhi (§0.2 rule 3, todo-review2.md G-17)
 * File này được tạo lần đầu bởi Thái Minh Tuấn (PR G-17) như một base skeleton
 * để các test DS-07/08/15/16 có thể chạy; Nhi sẽ bổ sung CI job, retries và
 * các project/device khác trong PR E2E tiếp theo.
 *
 * Biến môi trường:
 *   E2E_BASE_URL   — URL staging, ví dụ https://app.swiftletcare.vn (mặc định: http://localhost:5173)
 *
 * Chạy:
 *   npm run test:e2e               — toàn bộ bộ test
 *   npm run test:e2e -- e2e/ds-07  — chỉ DS-07
 *   npm run test:e2e:report        — xem báo cáo HTML
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [
    ['list'],
    ['junit', { outputFile: 'e2e-results.xml' }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
