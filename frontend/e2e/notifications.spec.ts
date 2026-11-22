import { expect, test } from '@playwright/test';
import { ACCOUNTS, PASSWORD, signIn } from './helpers/demoApi';

interface AppNotification { _id: string; title: string }

// hộp thông báo trong ứng dụng trên web. `npm run seed:demo` tạo cảnh báo NOISE_ANOMALY chờ kết luận, nên Domain Expert có sẵn thông báo trong ứng dụng.
test('Domain Expert thấy thông báo trong ứng dụng ở tab "Thông báo" của chuông', async ({ page, request }) => {
  const expert = await signIn(request, 'expert');
  const [latest] = await expert.data<AppNotification[]>(await expert.get('/notifications?limit=1'));
  expect(latest, 'chuyên gia chưa có thông báo nào — chạy `npm run seed:demo`').toBeTruthy();

  await page.goto('/login');
  await page.getByLabel('Email').fill(ACCOUNTS.expert);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/domain-expert\/queue$/);

  // Chuyên gia không vào được /alerts: chuông mở thẳng hộp Thông báo, không có tab Cảnh báo, không gọi GET /alerts
  await page.getByRole('button', { name: /^Thông báo/ }).first().click();
  await expect(page.getByRole('tab', { name: /^Cảnh báo/ })).toHaveCount(0);
  await expect(page.getByRole('menu').getByText(latest.title, { exact: false }).first()).toBeVisible();
});
