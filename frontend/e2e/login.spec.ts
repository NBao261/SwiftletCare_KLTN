import { expect, test } from '@playwright/test';
import { PASSWORD } from './helpers/demoApi';

// FE_Design 13.17 luồng 1 — đăng nhập từng role và về đúng trang chủ (ROLE_HOME); tài khoản của `npm run seed` ở backend
const ROLES = [
  { role: 'Farm Owner', email: 'owner@swiftletcare.dev', home: '/dashboard' },
  { role: 'Domain Expert', email: 'expert@swiftletcare.dev', home: '/domain-expert/queue' },
  { role: 'Farm Technician', email: 'tech@swiftletcare.dev', home: '/alerts' },
];

test.describe('Đăng nhập', () => {
  for (const { role, email, home } of ROLES) {
    test(`${role} đăng nhập thì về trang chủ của role`, async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Mật khẩu').fill(PASSWORD);
      await page.getByRole('button', { name: 'Đăng nhập' }).click();
      await expect(page).toHaveURL(new RegExp(`${home}$`));
    });
  }

  test('sai mật khẩu thì báo lỗi và ở lại trang đăng nhập', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@swiftletcare.dev');
    await page.getByLabel('Mật khẩu').fill('sai-mat-khau');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    // Câu báo lỗi theo nhóm lỗi (FE_Design 13.16), nên chỉ kiểm có báo, không so nguyên văn
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
