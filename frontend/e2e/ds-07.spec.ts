/**
 * DS-07 — WF-04 Main: Thẩm định cảnh báo tiếng ồn bất thường
 *
 * Chủ: Thái Minh Tuấn (WF-04, MF-04, AD-04)
 * Yêu cầu: EXPERT-FR-003, ALERT-FR-009, EXPERT-FR-021
 *
 * ── Điều kiện đầu (seed — Kiệt/Bảo cung cấp dữ liệu) ──────────────────────────
 * 1. Tài khoản Domain Expert: expert@swiftletcare.dev (DOMAIN_EXPERT, thành viên farm "Nhà Yến Demo")
 * 2. Tài khoản Farm Owner: owner@swiftletcare.dev (FARM_OWNER)
 * 3. Tài khoản Farm Technician: tech@swiftletcare.dev (FARM_TECHNICIAN, gán nhà "Nhà chính")
 * 4. Một cảnh báo loại NOISE_ANOMALY, trạng thái ACTIVE, thuộc nhà "Nhà chính"
 *    — đã có on-site check từ kỹ thuật viên (alerts.onsite_checks[0].answer có giá trị)
 *    — chưa có expert_verdict
 * 5. Dữ liệu đường nền tiếng ồn theo giờ của ít nhất 7 ngày trước (để trang bằng chứng hiển thị)
 *
 * ── Kịch bản chính (DS-07) ────────────────────────────────────────────────────
 * Bước 1: Chuyên gia đăng nhập, vào /domain-expert/alert-verdicts
 * Bước 2: Tìm cảnh báo NOISE_ANOMALY đang chờ kiểm chứng
 * Bước 3: Mở drawer thẩm định — thấy quan sát tại chỗ của kỹ thuật viên trong bằng chứng
 * Bước 4: Chọn "Bác bỏ", điền lý do, xác nhận
 * Bước 5: Cảnh báo chuyển sang DISMISSED — chủ farm nhận thông báo in-app
 * Bước 6: Kiểm tra lịch sử hoạt động (/domain-expert/history) có ghi nhận quyết định này
 *
 * ── Kết quả mong đợi ──────────────────────────────────────────────────────────
 * - Cảnh báo hiển thị nhãn "Đã bác bỏ" (trạng thái DISMISSED)
 * - Lý do bác bỏ hiển thị trong drawer chi tiết
 * - Trang lịch sử liệt kê quyết định vừa thực hiện
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const REJECTION_NOTE = 'Tiếng ồn từ công trình xây dựng lân cận, không phải bất thường nội bộ.'

test.describe('DS-07 — WF-04 Main: Expert bác bỏ NOISE_ANOMALY → DISMISSED', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'expert')
  })

  test('Expert thấy cảnh báo NOISE_ANOMALY đang chờ kiểm chứng', async ({ page }) => {
    await page.goto('/domain-expert/alert-verdicts')
    // Tab "Chờ kiểm chứng" hoặc danh sách mặc định phải có cảnh báo NOISE_ANOMALY
    await expect(page.getByText('Tiếng ồn bất thường', { exact: false })).toBeVisible({ timeout: 15_000 })
  })

  test('Drawer bằng chứng hiển thị quan sát tại chỗ của kỹ thuật viên', async ({ page }) => {
    await page.goto('/domain-expert/alert-verdicts')
    // Click vào cảnh báo đầu tiên loại NOISE_ANOMALY để mở drawer
    const alertRow = page.locator('[data-testid="alert-row"]').filter({ hasText: 'Tiếng ồn bất thường' }).first()
    await alertRow.click()
    // Drawer phải hiển thị bằng chứng và quan sát tại chỗ
    await expect(page.getByText('Quan sát tại chỗ', { exact: false })).toBeVisible({ timeout: 10_000 })
  })

  test('Expert bác bỏ cảnh báo với lý do — alert chuyển sang DISMISSED', async ({ page }) => {
    await page.goto('/domain-expert/alert-verdicts')
    // Mở cảnh báo đầu tiên loại NOISE_ANOMALY
    const alertRow = page.locator('[data-testid="alert-row"]').filter({ hasText: 'Tiếng ồn bất thường' }).first()
    await alertRow.click()

    // Chọn radio "Bác bỏ"
    const rejectRadio = page.getByRole('radio', { name: /bác bỏ/i })
    await expect(rejectRadio).toBeVisible()
    await rejectRadio.click()

    // Điền lý do bác bỏ
    const noteField = page.getByPlaceholder(/lý do/i).or(page.getByLabel(/ghi chú/i)).or(page.locator('textarea'))
    await noteField.fill(REJECTION_NOTE)

    // Xác nhận
    const confirmBtn = page.getByRole('button', { name: /xác nhận|lưu kết luận|ghi nhận/i })
    await confirmBtn.click()

    // Toast hoặc badge DISMISSED phải xuất hiện
    await expect(
      page.getByText('Đã bác bỏ', { exact: false }).or(page.getByText('DISMISSED', { exact: false }))
    ).toBeVisible({ timeout: 15_000 })
  })

  test('Lịch sử hoạt động ghi nhận quyết định bác bỏ', async ({ page }) => {
    await page.goto('/domain-expert/history')
    // Trang lịch sử phải có ít nhất một dòng "Bác bỏ" hoặc "REJECTED/DISMISSED"
    await expect(
      page.getByText('Bác bỏ', { exact: false }).or(page.getByText('Tiếng ồn bất thường', { exact: false }))
    ).toBeVisible({ timeout: 15_000 })
  })

  test('Chủ farm nhận thông báo in-app sau khi chuyên gia bác bỏ', async ({ page, context }) => {
    // Mở trang Farm Owner trong tab mới để kiểm tra thông báo
    const ownerPage = await context.newPage()
    await loginAs(ownerPage, 'owner')
    await ownerPage.goto('/dashboard')
    // Chuông thông báo phải có badge hoặc danh sách thông báo có mục liên quan
    const notifBell = ownerPage.getByRole('button', { name: /thông báo/i }).or(
      ownerPage.locator('[data-testid="notification-bell"]')
    )
    await notifBell.click()
    await expect(
      ownerPage.getByText('Tiếng ồn bất thường', { exact: false }).or(
        ownerPage.getByText('bác bỏ', { exact: false })
      )
    ).toBeVisible({ timeout: 15_000 })
    await ownerPage.close()
  })
})
