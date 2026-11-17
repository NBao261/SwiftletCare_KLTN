import { expect, test } from '@playwright/test';

// FE_Design 13.17 luồng 1 — đăng nhập từng role và về đúng trang chủ (ROLE_HOME); tài khoản của `npm run seed` ở backend
const PASSWORD = 'Test1234!';
const ROLES = [
  { role: 'Farm Owner', email: 'owner@swiftletcare.dev', home: '/dashboard' },
  { role: 'Domain Expert', email: 'expert@swiftletcare.dev', home: '/domain-expert/queue' },
  { role: 'Farm Technician', email: 'tech@swiftletcare.dev', home: '/devices' },
];

// Ô nhập chọn theo type: trang đăng nhập không truyền id/name nên nhãn chưa gắn với ô (getByLabel không tìm được)
test.describe('Đăng nhập', () => {
  for (const { role, email, home } of ROLES) {
    test(`${role} đăng nhập thì về trang chủ của role`, async ({ page }) => {
      await page.goto('/login');
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(PASSWORD);
      await page.getByRole('button', { name: 'Đăng nhập' }).click();
      await expect(page).toHaveURL(new RegExp(`${home}$`));
    });
  }

  test('sai mật khẩu thì báo lỗi và ở lại trang đăng nhập', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('owner@swiftletcare.dev');
    await page.locator('input[type="password"]').fill('sai-mat-khau');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    // Đoạn chữ duy nhất trong form là câu báo lỗi (câu theo nhóm lỗi, FE_Design 13.16 — không so nguyên văn)
    await expect(page.locator('form p')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
