import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, PASSWORD, type Account } from './helpers/demoApi';

// W-02 (todo-audit-1118) — trang quyết định của chuyên gia mở cho Farm Owner (Report 4 §5.4): farm chưa có chuyên gia
// thì Farm Owner quyết định thay; farm có chuyên gia thì Farm Owner vẫn sửa tham số và chuyên gia xem lại (BR-22,
// Report 3 4.2.15). Cần `npm run seed:demo` (owner2@ không có chuyên gia).
async function signInUi(page: Page, account: Account): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ACCOUNTS[account]);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test.describe('Trang quyết định của chuyên gia cho Farm Owner (BR-22)', () => {
  test('farm chưa có chuyên gia: Farm Owner sửa được tham số phát hiện', async ({ page }) => {
    await signInUi(page, 'ownerWithoutExpert');
    await page.goto('/domain-expert/tuning');
    await expect(page.getByText('Trang trại chưa có chuyên gia', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu tham số phát hiện' })).toBeEnabled();
  });

  test('farm có chuyên gia: Farm Owner sửa được tham số phát hiện, chuyên gia xem lại', async ({ page }) => {
    await signInUi(page, 'owner');
    await page.goto('/domain-expert/tuning');
    await expect(page.getByText('Trang trại đã có chuyên gia', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu tham số phát hiện' })).toBeEnabled();
    await page.goto('/domain-expert/history');
    await expect(page).toHaveURL(/\/domain-expert\/history$/);
  });

  test('Farm Technician không vào được khu chuyên gia', async ({ page }) => {
    await signInUi(page, 'technician');
    await page.goto('/domain-expert/history');
    await expect(page).toHaveURL(/\/403$/);
  });
});
