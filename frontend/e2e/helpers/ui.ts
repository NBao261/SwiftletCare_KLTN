import { expect, type Page } from '@playwright/test';
import { ACCOUNTS, DEMO_FARM, PASSWORD, type Account } from './demoApi';

// Đăng nhập bằng màn hình thật; loginLimiter chỉ đếm lần sai nên đăng nhập lại mỗi test không bị chặn
export async function signInUi(page: Page, account: Account): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ACCOUNTS[account]);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export interface UiScope {
  farmId: string;
  houseId?: string;
  zoneId?: string;
}

// Đặt phạm vi của khung lọc trước khi mở trang, để test không phụ thuộc nhà/Zone mà useScopeFilter tự chọn.
// Chưa chọn Zone thì zoneStore thật để null, không phải chuỗi rỗng: đặt sai kiểu là trang gửi `zoneId=`
// lên máy chủ, bị trả 422 và ô đếm ra 0 trong khi huy hiệu menu vẫn đếm đúng
export async function setScope(page: Page, scope: UiScope): Promise<void> {
  const state = {
    selectedFarmId: scope.farmId,
    selectedFarmName: DEMO_FARM,
    selectedZoneId: scope.zoneId ?? null,
    selectedZoneName: null,
    scopeFarmId: scope.farmId,
    selectedHouseId: scope.houseId ?? '',
    scopeZoneId: scope.zoneId ?? '',
  };
  await page.evaluate(value => localStorage.setItem('swiftletcare-zone', value), JSON.stringify({ state, version: 2 }));
}

// Chỉ tính lỗi JS chưa bắt (trang crash); cảnh báo mạng/socket không làm hỏng test
export function trackCrashes(page: Page): string[] {
  const crashes: string[] = [];
  page.on('pageerror', error => crashes.push(error.message));
  return crashes;
}

// Menu bên trái của desktop; thanh dock trên mobile có cùng nhãn nên phải giới hạn trong aside
export function sidebar(page: Page) {
  return page.locator('aside');
}
