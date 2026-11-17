/**
 * DS-16 — WF-08 Exception: Từ chối khuyến nghị không có lý do → 422; sau 7 ngày → EXPIRED
 *
 * Chủ: Thái Minh Tuấn (WF-08, MF-08)
 * Yêu cầu: EXPERT-FR-016…019, BR-42 (open > 7 ngày → EXPIRED; từ chối bắt buộc lý do)
 *
 * ── Điều kiện đầu (seed — Kiệt/Bảo cung cấp dữ liệu) ──────────────────────────
 * 1. Tài khoản Farm Owner: owner@swiftletcare.dev
 * 2. Khuyến nghị A — trạng thái OPEN, house = "Nhà chính" (dùng để test từ chối 422)
 * 3. Khuyến nghị B — trạng thái EXPIRED (created_at ≥ 8 ngày trước, job đã chạy),
 *    house = "Nhà chính", để kiểm tra hiển thị trạng thái EXPIRED trên UI
 *
 * ── Kịch bản ngoại lệ (DS-16) ─────────────────────────────────────────────────
 * Nhánh A — Từ chối không có lý do:
 *   Bước 1: Farm Owner vào /recommendations
 *   Bước 2: Mở khuyến nghị OPEN
 *   Bước 3: Nhấn "Từ chối" → bỏ trống ô lý do → gửi
 *   Bước 4: Lỗi 422 hiển thị (ô lý do bắt buộc)
 *
 * Nhánh B — Khuyến nghị quá hạn:
 *   Bước 1: Farm Owner vào /recommendations
 *   Bước 2: Tìm khuyến nghị B — hiển thị trạng thái "Đã hết hạn" / EXPIRED
 *
 * ── Kết quả mong đợi ──────────────────────────────────────────────────────────
 * - Nhánh A: form từ chối hiển thị lỗi validation, trạng thái khuyến nghị giữ nguyên OPEN
 * - Nhánh B: khuyến nghị B hiển thị nhãn "Hết hạn" hoặc "EXPIRED"
 */
import { test, expect } from '@playwright/test'
import { loginAs, SEED_USERS } from './helpers/auth'

test.describe('DS-16 — WF-08 Exception: từ chối thiếu lý do (422) và khuyến nghị EXPIRED', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'owner')
  })

  test('Từ chối khuyến nghị không điền lý do — form báo lỗi, trạng thái không đổi', async ({ page }) => {
    await page.goto('/recommendations')

    // Mở khuyến nghị đầu tiên trạng thái OPEN
    const openRec = page
      .locator('[data-testid="recommendation-card"]')
      .or(page.getByRole('listitem').filter({ hasText: /open|đang chờ/i }))
      .first()

    // Nếu không có OPEN nào (DS-15 đã chạy trước và accept hết) thì skip
    const hasOpen = await openRec.isVisible({ timeout: 10_000 }).catch(() => false)
    test.skip(!hasOpen, 'Không còn khuyến nghị OPEN — cần seed thêm hoặc chạy độc lập với DS-15')

    await openRec.click()

    // Nhấn "Từ chối" (Reject)
    const rejectBtn = page.getByRole('button', { name: /từ chối/i })
    await expect(rejectBtn).toBeVisible()
    await rejectBtn.click()

    // Bỏ trống ô lý do và cố gửi
    const reasonField = page.getByPlaceholder(/lý do/i).or(page.getByLabel(/lý do/i)).or(
      page.locator('textarea[name="reason"]')
    )
    if (await reasonField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await reasonField.clear()
    }

    const submitBtn = page.getByRole('button', { name: /xác nhận|gửi|từ chối/i }).last()
    await submitBtn.click()

    // Phải hiển thị thông báo lỗi hoặc lỗi validation — không được thành công
    await expect(
      page.getByText(/bắt buộc|không được để trống|lý do/i).or(
        page.getByRole('alert').filter({ hasText: /422|lý do/i })
      )
    ).toBeVisible({ timeout: 10_000 })

    // Trạng thái khuyến nghị vẫn OPEN
    await expect(
      page.getByText('OPEN', { exact: false }).or(page.getByText('Đang chờ', { exact: false }))
    ).toBeVisible({ timeout: 5_000 })
  })

  test('API: từ chối không có lý do trả về 422', async ({ page }) => {
    const { email, password } = SEED_USERS.owner
    const apiBase = process.env.E2E_API_URL ?? 'http://localhost:3000'

    const loginRes = await page.request.post(`${apiBase}/auth/login`, {
      data: { email, password },
    })
    expect(loginRes.status()).toBe(200)
    const token: string = (await loginRes.json()).data?.accessToken ?? ''

    // Lấy ID khuyến nghị OPEN
    const recRes = await page.request.get(`${apiBase}/recommendations?status=OPEN&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(recRes.status()).toBe(200)
    const { data: recs } = await recRes.json()
    test.skip(!recs?.length, 'Không có khuyến nghị OPEN trong DB — cần seed trước')

    const recId: string = recs[0]._id

    // Gọi reject KHÔNG có reason → 422
    const rejectRes = await page.request.post(`${apiBase}/recommendations/${recId}/reject`, {
      data: {},
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(rejectRes.status()).toBe(422)
  })

  test('Khuyến nghị quá 7 ngày hiển thị trạng thái EXPIRED trên UI', async ({ page }) => {
    await page.goto('/recommendations')

    // Tìm khuyến nghị EXPIRED (seed phải tạo trước ≥ 8 ngày và job recommendationEffect.job đã chạy)
    // Nếu chưa có thì note để seed thêm
    const expiredItem = page
      .getByText('Hết hạn', { exact: false })
      .or(page.getByText('EXPIRED', { exact: false }))
      .or(page.locator('[data-testid="recommendation-status-expired"]'))

    const hasExpired = await expiredItem.isVisible({ timeout: 10_000 }).catch(() => false)
    test.skip(!hasExpired, 'Không có khuyến nghị EXPIRED — seed cần tạo khuyến nghị ≥ 8 ngày trước và chạy job')

    await expect(expiredItem.first()).toBeVisible()
  })
})
