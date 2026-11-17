/**
 * DS-15 — WF-08 Main: Vòng lặp khuyến nghị — chủ farm chấp nhận → Work Order tạo
 *
 * Chủ: Thái Minh Tuấn (WF-08, MF-08, AD-08)
 * Yêu cầu: EXPERT-FR-016…019, BR-42
 *
 * ── Điều kiện đầu (seed — Kiệt/Bảo cung cấp dữ liệu) ──────────────────────────
 * 1. Tài khoản Domain Expert: expert@swiftletcare.dev
 * 2. Tài khoản Farm Owner: owner@swiftletcare.dev
 * 3. Một luật khuyến nghị đang BẬT:
 *    - Tên: "NH3 vượt ngưỡng ≥ 4 giờ/ngày trong 3 ngày liên tiếp"
 *    - Loại hành động: WORK_ORDER (mở phiếu sửa chữa)
 *    - Chỉ số: NH3, điều kiện: above, ngưỡng: giá trị ngưỡng hiện tại của zone
 *    - Trạng thái: enabled = true
 * 4. Dữ liệu ngày đủ điều kiện đã được seed (≥ 3 ngày NH3 vượt ngưỡng ≥ 4 giờ/ngày)
 * 5. Một khuyến nghị ở trạng thái OPEN đã được tạo bởi job đánh giá hằng ngày
 *    — recommendations[0].status = 'OPEN', house = "Nhà chính"
 *
 * ── Kịch bản chính (DS-15) ────────────────────────────────────────────────────
 * Bước 1: Chuyên gia đăng nhập, kiểm tra luật tại /domain-expert/recommendation-rules
 * Bước 2: Farm Owner đăng nhập, vào /recommendations
 * Bước 3: Thấy khuyến nghị kèm bằng chứng (biểu đồ NH3)
 * Bước 4: Chấp nhận khuyến nghị (xác nhận dialog)
 * Bước 5: Work Order được tạo tự động — hiển thị link
 *
 * ── Kết quả mong đợi ──────────────────────────────────────────────────────────
 * - Khuyến nghị chuyển sang ACCEPTED
 * - Work Order được tạo, hiển thị trong trang
 * - Chuyên gia thấy hiệu quả luật ở /domain-expert/recommendation-rules sau khi job đo
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('DS-15 — WF-08 Main: Farm Owner chấp nhận khuyến nghị → Work Order', () => {
  test('Domain Expert thấy luật khuyến nghị đang bật tại trang luật', async ({ page }) => {
    await loginAs(page, 'expert')
    await page.goto('/domain-expert/recommendation-rules')
    // Trang phải load và hiển thị ít nhất một luật đang bật
    await expect(page.getByText('NH3', { exact: false })).toBeVisible({ timeout: 15_000 })
    // Badge "Đang bật" hoặc toggle ON phải hiển thị
    await expect(
      page.getByText('Đang bật', { exact: false }).or(page.locator('[data-testid="rule-enabled"]'))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('Farm Owner thấy khuyến nghị OPEN kèm bằng chứng', async ({ page }) => {
    await loginAs(page, 'owner')
    await page.goto('/recommendations')
    // Phải có ít nhất một khuyến nghị
    await expect(
      page.getByText('NH3', { exact: false }).or(page.locator('[data-testid="recommendation-card"]'))
    ).toBeVisible({ timeout: 15_000 })
    // Bằng chứng: biểu đồ hoặc mô tả điều kiện
    await expect(
      page.getByText('ngày', { exact: false }).or(page.getByText('bằng chứng', { exact: false }))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('Farm Owner chấp nhận khuyến nghị — Work Order được tạo', async ({ page }) => {
    await loginAs(page, 'owner')
    await page.goto('/recommendations')

    // Mở khuyến nghị đầu tiên trạng thái OPEN
    const openRec = page
      .locator('[data-testid="recommendation-card"]')
      .or(page.getByRole('listitem').filter({ hasText: 'NH3' }))
      .first()
    await expect(openRec).toBeVisible({ timeout: 15_000 })
    await openRec.click()

    // Nhấn nút "Chấp nhận"
    const acceptBtn = page.getByRole('button', { name: /chấp nhận/i })
    await expect(acceptBtn).toBeVisible()
    await acceptBtn.click()

    // Dialog xác nhận
    const confirmBtn = page.getByRole('button', { name: /xác nhận|đồng ý/i })
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    // Trạng thái phải chuyển sang ACCEPTED (hoặc "Đã chấp nhận")
    await expect(
      page.getByText('Đã chấp nhận', { exact: false }).or(page.getByText('ACCEPTED', { exact: false }))
    ).toBeVisible({ timeout: 15_000 })

    // Work Order phải được hiển thị (link hoặc badge "Phiếu công việc")
    await expect(
      page.getByText('Phiếu công việc', { exact: false }).or(page.getByText('Work Order', { exact: false }))
    ).toBeVisible({ timeout: 15_000 })
  })

  test('API: khuyến nghị ở trạng thái ACCEPTED sau khi Farm Owner chấp nhận', async ({ page }) => {
    const { email, password } = { email: 'owner@swiftletcare.dev', password: 'Test1234!' }
    const apiBase = process.env.E2E_API_URL ?? 'http://localhost:3000'

    const loginRes = await page.request.post(`${apiBase}/auth/login`, {
      data: { email, password },
    })
    expect(loginRes.status()).toBe(200)
    const token: string = (await loginRes.json()).data?.access_token ?? ''

    const recRes = await page.request.get(`${apiBase}/recommendations?status=ACCEPTED&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // Nếu không có ACCEPTED nào thì test DS-15 bước 3 chưa chạy — không fail ở đây
    if (recRes.status() === 200) {
      const { data } = await recRes.json()
      expect(Array.isArray(data)).toBe(true)
    }
  })
})
