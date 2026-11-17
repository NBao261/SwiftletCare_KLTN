/**
 * DS-08 — WF-04 Exception: Farm Owner không thể ghi kết luận khi farm có chuyên gia
 *
 * Chủ: Thái Minh Tuấn (WF-04, MF-04)
 * Yêu cầu: EXPERT-FR-003, BR-22 (Farm Owner chỉ thay thế khi farm KHÔNG có chuyên gia)
 *
 * ── Điều kiện đầu (seed — Kiệt/Bảo cung cấp dữ liệu) ──────────────────────────
 * 1. Tài khoản Farm Owner: owner@swiftletcare.dev (FARM_OWNER)
 * 2. Farm "Nhà Yến Demo" ĐÃ CÓ Domain Expert là expert@swiftletcare.dev
 * 3. Một cảnh báo loại NOISE_ANOMALY, trạng thái ACTIVE, chưa có verdict
 *    (dùng lại cùng record với DS-07, nhưng DS-08 chạy ĐỘC LẬP hoặc trước DS-07)
 *
 * ── Kịch bản ngoại lệ (DS-08) ─────────────────────────────────────────────────
 * Bước 1: Farm Owner đăng nhập
 * Bước 2: Truy cập /domain-expert/alert-verdicts → bị chặn, điều hướng ra khỏi khu vực chuyên gia
 * Bước 3: Gọi trực tiếp API PUT /alerts/:id/verdict với tài khoản Farm Owner → 403
 *
 * ── Kết quả mong đợi ──────────────────────────────────────────────────────────
 * - UI: Farm Owner không thấy route /domain-expert/* (RequireRole chuyển hướng)
 * - API: 403 Forbidden khi cố ghi verdict
 */
import { test, expect } from '@playwright/test'
import { loginAs, SEED_USERS } from './helpers/auth'

test.describe('DS-08 — WF-04 Exception: Farm Owner bị chặn ghi verdict (403)', () => {
  test('Farm Owner không thể truy cập trang thẩm định của Domain Expert', async ({ page }) => {
    await loginAs(page, 'owner')
    // Cố truy cập khu vực Domain Expert
    await page.goto('/domain-expert/alert-verdicts')
    // RequireRole phải chuyển hướng ra ngoài — không ở URL /domain-expert/*
    await page.waitForURL(url => !url.pathname.startsWith('/domain-expert'), { timeout: 10_000 })
    await expect(page).not.toHaveURL(/\/domain-expert/)
  })

  test('API PUT /alerts/:id/verdict trả 403 với tài khoản Farm Owner', async ({ page }) => {
    // Đăng nhập để lấy access token của Farm Owner
    const { email, password } = SEED_USERS.owner
    const apiBase = process.env.E2E_API_URL ?? 'http://localhost:3000'

    // 1. Lấy token
    const loginRes = await page.request.post(`${apiBase}/auth/login`, {
      data: { email, password },
    })
    expect(loginRes.status()).toBe(200)
    const { data: loginData } = await loginRes.json()
    const token: string = loginData?.access_token ?? ''
    expect(token).toBeTruthy()

    // 2. Lấy ID của một cảnh báo NOISE_ANOMALY đang ACTIVE
    const alertsRes = await page.request.get(`${apiBase}/alerts?type=NOISE_ANOMALY&status=ACTIVE&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(alertsRes.status()).toBe(200)
    const { data: alerts } = await alertsRes.json()
    // Nếu không có alert nào thì seed chưa đủ — test này sẽ được skip
    test.skip(!alerts?.length, 'Không có NOISE_ANOMALY ACTIVE trong DB — cần chạy seed trước')
    const alertId: string = alerts[0]._id

    // 3. Cố ghi verdict với tài khoản Farm Owner → phải nhận 403
    const verdictRes = await page.request.put(`${apiBase}/alerts/${alertId}/verdict`, {
      data: { verdict: 'REJECTED', note: 'test from owner' },
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(verdictRes.status()).toBe(403)
  })
})
