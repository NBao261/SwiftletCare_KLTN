import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ACCOUNTS, DEMO_FARM, PASSWORD, signIn, type Account } from './helpers/demoApi';

// W-02 (todo-audit-1118) — trang quyết định của chuyên gia mở cho Farm Owner (Report 4 §5.4): farm chưa có chuyên gia
// thì Farm Owner quyết định thay (BR-22), farm có chuyên gia thì chỉ xem. Cần `npm run seed:demo` (owner2@ không có chuyên gia).
async function signInUi(page: Page, account: Account): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ACCOUNTS[account]);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

interface FarmInfo { _id: string; name: string; has_active_expert?: boolean }

// Khu chuyên gia bỏ thanh phạm vi cũ (DE-01); ScopeFilter trên header là việc C-05 của Bảo, chưa có —
// nên test tự đặt farm vào zoneStore (localStorage) để badge và nút biết đang xem farm nào.
async function selectFarm(page: Page, farm: FarmInfo): Promise<void> {
  const state = {
    selectedFarmId: farm._id, selectedFarmName: farm.name, selectedZoneId: '', selectedZoneName: '',
    scopeFarmId: '', selectedHouseId: '', scopeZoneId: '',
  };
  await page.evaluate(value => localStorage.setItem('swiftletcare-zone', value), JSON.stringify({ state, version: 2 }));
}

async function farmOf(request: APIRequestContext, account: Account, withExpert: boolean): Promise<FarmInfo> {
  const api = await signIn(request, account);
  const farms = await api.data<FarmInfo[]>(await api.get('/farms'));
  const farm = withExpert ? farms.find(item => item.name === DEMO_FARM) : farms.find(item => item.has_active_expert === false);
  expect(farm, withExpert ? 'farm có chuyên gia' : 'farm chưa có chuyên gia').toBeTruthy();
  return farm!;
}

test.describe('Trang quyết định của chuyên gia cho Farm Owner (BR-22)', () => {
  test('farm chưa có chuyên gia: Farm Owner sửa được tham số phát hiện', async ({ page, request }) => {
    const farm = await farmOf(request, 'ownerWithoutExpert', false);
    await signInUi(page, 'ownerWithoutExpert');
    await selectFarm(page, farm);
    await page.goto('/domain-expert/tuning');
    // DE-10: badge nhỏ thay dải thông báo; câu giải thích nằm trong tooltip (title)
    await expect(page.getByText('Quyết định thay', { exact: true })).toBeVisible();
    // DE-04: nút Lưu riêng từng khối đã gộp vào thanh lưu dính đáy, nên kiểm nút +/- của tham số phát hiện
    await expect(page.getByRole('button', { name: 'Tăng Mức ồn vượt nền' })).toBeEnabled();
  });

  test('farm có chuyên gia: Farm Owner chỉ xem tham số phát hiện, vẫn sửa được ngưỡng', async ({ page, request }) => {
    const farm = await farmOf(request, 'owner', true);
    await signInUi(page, 'owner');
    await selectFarm(page, farm);
    await page.goto('/domain-expert/tuning');
    // DE-10: badge "Chỉ xem"; câu giải thích nằm trong tooltip (title)
    await expect(page.getByText('Chỉ xem', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tăng Mức ồn vượt nền' })).toBeDisabled();
    await page.goto('/domain-expert/history');
    await expect(page).toHaveURL(/\/domain-expert\/history$/);
  });

  test('Farm Technician không vào được khu chuyên gia', async ({ page }) => {
    await signInUi(page, 'technician');
    await page.goto('/domain-expert/history');
    await expect(page).toHaveURL(/\/403$/);
  });
});
