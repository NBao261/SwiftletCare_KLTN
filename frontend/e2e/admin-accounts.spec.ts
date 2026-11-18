import { expect, test, type Page } from '@playwright/test';
import { PASSWORD } from './helpers/demoApi';

// Administrator trên web (G-02, G-18): tạo Farm Owner (AUTH-FR-005c) và lưu ngưỡng mặc định kèm nguồn REF-5 (ENV-FR-007).
// Cần `npm run seed:demo` (tài khoản admin@); job CI không có SMTP nên thư mật khẩu tạm không gửi được.
async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@swiftletcare.dev');
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/system\/health$/);
}

test.describe('Administrator', () => {
  test('tạo tài khoản Farm Owner, tài khoản hiện trong danh sách', async ({ page }) => {
    const email = `owner-e2e-${Date.now()}@swiftletcare.dev`;
    await signInAsAdmin(page);
    await page.goto('/users');
    await page.getByRole('tab', { name: 'Người dùng' }).click();
    await page.getByRole('button', { name: 'Tạo Farm Owner' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('Họ tên').fill('Chủ nhà yến E2E');
    await dialog.getByRole('button', { name: 'Tạo tài khoản' }).click();
    // Không có SMTP: báo chưa gửi được thư, Farm Owner dùng "Quên mật khẩu" khi đã có
    await expect(dialog.getByText(email, { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();

    await page.getByPlaceholder('Tìm tên/email...').fill(email);
    await expect(page.getByText(email)).toBeVisible();
  });

  test('lưu ngưỡng mặc định cần nguồn có mã REF-5', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/system/settings');
    await page.getByRole('button', { name: 'Chỉnh sửa ngưỡng môi trường mặc định' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nguồn (mã mục REF-5)').fill('sách nuôi yến');
    await dialog.getByRole('button', { name: 'Lưu' }).click();
    await expect(dialog.getByText('Nguồn phải có mã mục REF-5', { exact: false })).toBeVisible();

    await dialog.getByLabel('Nguồn (mã mục REF-5)').fill('TL-001 kiểm thử E2E');
    await dialog.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã lưu ngưỡng mặc định hệ thống')).toBeVisible();
  });
});
