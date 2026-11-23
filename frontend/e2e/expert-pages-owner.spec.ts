import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { DEMO_FARM, signIn, type Account } from './helpers/demoApi';
import { setScope, signInUi } from './helpers/ui';

// Trang quyết định của chuyên gia cho Farm Owner; cần `npm run seed:demo` (owner2@ không có chuyên gia)

interface FarmInfo { _id: string; name: string; has_active_expert?: boolean }

async function farmOf(request: APIRequestContext, account: Account, withExpert: boolean): Promise<FarmInfo> {
  const api = await signIn(request, account);
  const farms = await api.data<FarmInfo[]>(await api.get('/farms'));
  const farm = withExpert ? farms.find(item => item.name === DEMO_FARM) : farms.find(item => item.has_active_expert === false);
  expect(farm, withExpert ? 'farm có chuyên gia' : 'farm chưa có chuyên gia').toBeTruthy();
  return farm!;
}

// Badge quyền ở đầu trang, câu đầy đủ nằm trong nút (i) của chính badge đó
async function openBadgeExplanation(page: Page, label: string): Promise<void> {
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  await page.locator('span').filter({ has: page.getByText(label, { exact: true }) }).getByRole('button', { name: 'Giải thích' }).click();
}

test.describe('Trang quyết định của chuyên gia cho Farm Owner (BR-22)', () => {
  test('farm chưa có chuyên gia: Farm Owner sửa được tham số phát hiện', async ({ page, request }) => {
    const farm = await farmOf(request, 'ownerWithoutExpert', false);
    await signInUi(page, 'ownerWithoutExpert');
    await setScope(page, { farmId: farm._id });
    await page.goto('/domain-expert/tuning');
    await openBadgeExplanation(page, 'Quyết định thay');
    await expect(page.getByText('Trang trại chưa có chuyên gia', { exact: false })).toBeVisible();
    // Nút Lưu riêng từng khối đã gộp vào thanh lưu dính đáy, nên kiểm nút +/- của tham số phát hiện
    await expect(page.getByRole('button', { name: 'Tăng Mức ồn vượt nền' })).toBeEnabled();
  });

  test('farm có chuyên gia: Farm Owner sửa được tham số phát hiện, chuyên gia xem lại', async ({ page, request }) => {
    const farm = await farmOf(request, 'owner', true);
    await signInUi(page, 'owner');
    await setScope(page, { farmId: farm._id });
    await page.goto('/domain-expert/tuning');
    await openBadgeExplanation(page, 'Chuyên gia duyệt lại');
    await expect(page.getByText('Trang trại đã có chuyên gia', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tăng Mức ồn vượt nền' })).toBeEnabled();
    await page.goto('/domain-expert/history');
    await expect(page).toHaveURL(/\/domain-expert\/history$/);
  });

  test('Farm Technician không vào được khu chuyên gia', async ({ page }) => {
    await signInUi(page, 'technician');
    await page.goto('/domain-expert/history');
    await expect(page).toHaveURL(/\/403$/);
  });
});
