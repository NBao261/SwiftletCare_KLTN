import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, DEMO_FARM, PASSWORD, demoFarm, signIn, type Account } from './helpers/demoApi';

// Smoke cho các trang đổi bố cục ở todo-ui-layout-1120 §6/§7 mà chưa có E2E chạm tới:
// mở trang + chạy tương tác mới (Modal/tab/nút) + bắt lỗi JS chưa bắt (crash thật). Không kiểm layout bằng mắt.
async function signInUi(page: Page, account: Account): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ACCOUNTS[account]);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

// Khu chuyên gia chưa có bộ chọn farm tới khi C-05 (Bảo) merge: test tự đặt phạm vi vào zoneStore
async function setScope(page: Page, scope: { farmId: string; houseId?: string }): Promise<void> {
  const state = {
    selectedFarmId: scope.farmId, selectedFarmName: DEMO_FARM, selectedZoneId: '', selectedZoneName: '',
    scopeFarmId: '', selectedHouseId: scope.houseId ?? '', scopeZoneId: '',
  };
  await page.evaluate(value => localStorage.setItem('swiftletcare-zone', value), JSON.stringify({ state, version: 2 }));
}

// Chỉ tính lỗi JS chưa bắt (trang crash); cảnh báo mạng/socket không làm hỏng test
function trackCrashes(page: Page): string[] {
  const crashes: string[] = [];
  page.on('pageerror', error => crashes.push(error.message));
  return crashes;
}

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
    await expect(page.getByText('Chỉ số thời tiết')).toBeVisible();
    expect(crashes, crashes.join('\n')).toHaveLength(0);
  });

  test('DE-06 Duyệt & đề xuất: đổi tab sang Đề xuất hệ số mờ', async ({ page }) => {
    const crashes = trackCrashes(page);
    await signInUi(page, 'expert');
    await setScope(page, { farmId });
    await page.goto('/domain-expert/reviews');
    const proposalsTab = page.getByRole('button', { name: 'Đề xuất hệ số mờ' });
    await proposalsTab.click();
    await expect(proposalsTab).toHaveAttribute('aria-current', 'page');
    expect(crashes, crashes.join('\n')).toHaveLength(0);
  });

  test('DE-07 Đếm chim: Lịch đếm hiện mục Hồ sơ theo mùa', async ({ page }) => {
    const crashes = trackCrashes(page);
    await signInUi(page, 'expert');
    await setScope(page, { farmId, houseId: houseB });
    await page.goto('/domain-expert/counting-schedule');
    await expect(page.getByRole('heading', { name: /Hồ sơ theo mùa/ })).toBeVisible();
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
