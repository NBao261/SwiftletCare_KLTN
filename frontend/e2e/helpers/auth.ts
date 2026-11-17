/**
 * e2e/helpers/auth.ts — Tiện ích đăng nhập dùng chung cho các test E2E
 *
 * Thông tin tài khoản lấy từ backend/src/scripts/seed.script.ts (npm run seed).
 * Tất cả tài khoản này chỉ tồn tại trên staging/dev, không dùng production.
 */
import { type Page, expect } from '@playwright/test'

export const SEED_USERS = {
  owner:      { email: 'owner@swiftletcare.dev',  password: 'Test1234!' },
  expert:     { email: 'expert@swiftletcare.dev', password: 'Test1234!' },
  technician: { email: 'tech@swiftletcare.dev',   password: 'Test1234!' },
} as const

export type SeedRole = keyof typeof SEED_USERS

/**
 * Đăng nhập bằng tài khoản seed và chờ điều hướng thành công.
 * Sau khi gọi hàm này, page đang ở trang chủ của role đó.
 */
export async function loginAs(page: Page, role: SeedRole): Promise<void> {
  const { email, password } = SEED_USERS[role]
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  // Chờ điều hướng ra khỏi /login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 })
}

/**
 * Đăng nhập qua API để bỏ qua UI (nhanh hơn khi test không liên quan tới luồng đăng nhập).
 * Lưu cookie vào context của Playwright để các request tiếp theo được xác thực.
 */
export async function loginViaApi(page: Page, role: SeedRole): Promise<string> {
  const { email, password } = SEED_USERS[role]
  const apiBase = process.env.E2E_API_URL ?? 'http://localhost:3000'

  const res = await page.request.post(`${apiBase}/auth/login`, {
    data: { email, password },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  const token: string = body.data?.accessToken ?? ''
  return token
}
