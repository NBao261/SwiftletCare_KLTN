import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, demoFarm, signIn } from './helpers/demoApi';

// Admin tạo Farm Owner và lưu ngưỡng mặc định. Cần `npm run seed:demo`; CI không có SMTP nên thư không gửi
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
    await page.getByRole('button', { name: 'Tạo chủ nhà yến' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('Họ tên').fill('Chủ nhà yến E2E');
    await dialog.getByRole('button', { name: 'Tạo tài khoản' }).click();
    // Không có SMTP: báo chưa gửi được thư, Farm Owner dùng "Quên mật khẩu" khi đã có
    await expect(dialog.getByText(email, { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click();

    await page.getByPlaceholder('Tìm tên/email...').fill(email);
    // Tìm theo <tr>: dòng có onRowClick mang role="button", thẻ điện thoại (ẩn ở màn rộng) cũng có email này
    await expect(page.locator('tr', { hasText: email })).toBeVisible();
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

  // Admin "completes or rejects"; lý do bắt buộc
  test('từ chối yêu cầu xoá tài khoản kèm lý do, tài khoản rời danh sách', async ({ page, request }) => {
    // Tài khoản riêng của test: Farm Owner mời một thợ, thợ tạo tài khoản từ lời mời rồi gửi yêu cầu xoá
    const email = `delete-e2e-${Date.now()}@swiftletcare.dev`;
    const owner = await signIn(request, 'owner');
    const { farmId } = await demoFarm(owner);
    const invitation = await owner.data<{ token: string }>(await owner.post(`/farms/${farmId}/members`, { email, role: 'FARM_TECHNICIAN' }));
    const created = await request.post(`/api/invitations/${invitation.token}/create-account`, { data: { full_name: 'Thợ xoá E2E', password: PASSWORD } });
    expect(created.ok(), await created.text()).toBe(true);
    const login = await request.post('/api/auth/login', { data: { email, password: PASSWORD } });
    const token = (await login.json()).data.accessToken as string;
    const requested = await request.post('/api/auth/delete-request', { headers: { Authorization: `Bearer ${token}` } });
    expect(requested.ok(), await requested.text()).toBe(true);

    await signInAsAdmin(page);
    await page.goto('/account-requests');
    const row = page.getByRole('row').filter({ hasText: email });
    await row.getByRole('button', { name: 'Từ chối' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Từ chối yêu cầu' }).click();
    await expect(dialog.getByText('Nhập lý do từ chối')).toBeVisible();
    await dialog.getByLabel('Lý do từ chối').fill('Còn nghĩa vụ lưu hồ sơ thu hoạch');
    await dialog.getByRole('button', { name: 'Từ chối yêu cầu' }).click();

    await expect(page.getByText('Đã từ chối yêu cầu xoá tài khoản')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0);
  });
});
