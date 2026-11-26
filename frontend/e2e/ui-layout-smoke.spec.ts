import { expect, test } from '@playwright/test';
import { demoFarm, signIn } from './helpers/demoApi';
import { setScope, signInUi, trackCrashes } from './helpers/ui';

// Smoke cho các trang đổi bố cục chưa có E2E: mở trang, chạy tương tác mới, bắt lỗi JS chưa bắt; không kiểm layout bằng mắt

// Lấy ID một lần cho cả nhóm, tránh đăng nhập lặp (backend giới hạn số lần đăng nhập)
let farmId = '';
let houseA = '';
let houseB = '';

test.beforeAll(async ({ request }) => {
  const farm = await demoFarm(await signIn(request, 'owner'));
  farmId = farm.farmId;
  houseA = farm.house('A')._id;
  houseB = farm.house('B')._id;
});

test.describe('Bố cục trang chuyên gia & kỹ thuật viên (todo-ui-layout §6/§7)', () => {
  test('DE-05 Bù thời tiết: nút Thêm luật mở form trong Modal', async ({ page }) => {
    const crashes = trackCrashes(page);
    await signInUi(page, 'expert');
    await setScope(page, { farmId, houseId: houseA });
    await page.goto('/domain-expert/weather-rules');
    await page.getByRole('button', { name: 'Thêm luật' }).click();
    await expect(page.getByText('Chỉ số thời tiết', { exact: true })).toBeVisible();
    expect(crashes, crashes.join('\n')).toHaveLength(0);
  });

  test('DE-06 Duyệt & đề xuất: đổi tab sang Đề xuất hệ số mờ', async ({ page }) => {
    const crashes = trackCrashes(page);
    await signInUi(page, 'expert');
    await setScope(page, { farmId });
    await page.goto('/domain-expert/reviews');
    // Hai tab của trang là role tab (StatusTabs): tab đang chọn có aria-selected
    const proposalsTab = page.getByRole('tab', { name: /Đề xuất hệ số mờ/ });
    await proposalsTab.click();
    await expect(proposalsTab).toHaveAttribute('aria-selected', 'true');
    expect(crashes, crashes.join('\n')).toHaveLength(0);
  });

  test('DE-07 Đếm chim: Lịch đếm hiện mục Hồ sơ theo mùa', async ({ page }) => {
    const crashes = trackCrashes(page);
    await signInUi(page, 'expert');
    await setScope(page, { farmId, houseId: houseB });
    await page.goto('/domain-expert/counting-schedule');
    await expect(page.getByRole('tab', { name: /Hồ sơ theo mùa/ })).toBeVisible();
    expect(crashes, crashes.join('\n')).toHaveLength(0);
  });

  test('DE-09 Luật khuyến nghị: render và đổi tab Hiệu quả theo luật', async ({ page }) => {
    const crashes = trackCrashes(page);
    await signInUi(page, 'expert');
    await setScope(page, { farmId });
    await page.goto('/domain-expert/recommendation-rules');
    await expect(page.getByRole('heading', { name: 'Luật khuyến nghị' })).toBeVisible();
    await page.getByRole('tab', { name: /Hiệu quả/ }).click();
    expect(crashes, crashes.join('\n')).toHaveLength(0);
  });

  test('FT-02 Nhà được giao: nút Xem thiết bị mở trang Thiết bị', async ({ page }) => {
    const crashes = trackCrashes(page);
    await signInUi(page, 'technician');
    await page.goto('/farms');
    const openDevices = page.getByRole('button', { name: 'Xem thiết bị' }).first();
    await expect(openDevices).toBeVisible();
    await openDevices.click();
    await expect(page).toHaveURL(/\/devices/);
    expect(crashes, crashes.join('\n')).toHaveLength(0);
  });
});
