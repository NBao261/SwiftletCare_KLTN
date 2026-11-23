import { expect, test, type Page } from '@playwright/test';
import { demoFarm, signIn, type DemoApi } from './helpers/demoApi';
import { setScope, sidebar, signInUi, trackCrashes, type UiScope } from './helpers/ui';

// Luồng của Kỹ thuật viên trên web (seed:demo): cảnh báo, thiết bị và ca trực ở nhà được giao; phần việc còn lại ở điện thoại
test.describe.configure({ mode: 'serial' });

interface Alert {
  _id: string;
  type: string;
  status: string;
  site_cause?: { cause: string };
}

// Cảnh báo thiết bị có ô "nguyên nhân tìm thấy tại chỗ" (constants/siteCause.ts)
const CAUSE_ALERT_TYPES = ['MISTING_INEFFECTIVE', 'ACTUATOR_FAULT', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'SPEAKER_FAILURE'];

let farmId = '';
let houseA = '';
let zoneA = '';

test.beforeAll(async ({ request }) => {
  const farm = await demoFarm(await signIn(request, 'owner'));
  farmId = farm.farmId;
  houseA = farm.house('A')._id;
  zoneA = (await farm.zoneOf('A'))._id;
});

// Đăng nhập kỹ thuật viên, đặt phạm vi rồi mở đúng trang
async function openAsTechnician(page: Page, path: string, scope?: UiScope): Promise<string[]> {
  const crashes = trackCrashes(page);
  await signInUi(page, 'technician');
  if (scope) await setScope(page, scope);
  await page.goto(path);
  return crashes;
}

// Cảnh báo lỗi cảm biến của nhà A, nơi kỹ thuật viên ghi được nguyên nhân tại chỗ
async function sensorFaultAlert(api: DemoApi): Promise<Alert> {
  const alerts = await api.data<Alert[]>(await api.get(`/alerts?farmId=${farmId}&limit=100`));
  const ofHouseA = alerts.filter(alert => alert.type === 'SENSOR_FAULT' && CAUSE_ALERT_TYPES.includes(alert.type));
  const found = ofHouseA.find(alert => alert.status === 'ACTIVE') ?? ofHouseA.find(alert => alert.site_cause);
  expect(found, 'cảnh báo lỗi cảm biến của DS — chạy `npm run seed:demo`').toBeTruthy();
  return found!;
}

// Một hàng của bảng cảnh báo là nút bấm (mở ngăn chi tiết), không phải hàng bảng thường
function sensorFaultRow(page: Page) {
  return page.getByRole('button')
    .filter({ hasText: 'Lỗi cảm biến' })
    .filter({ hasText: 'A · Nhà điều khiển' })
    .first();
}

test('T1 — đăng nhập vào trang cảnh báo, menu chỉ có phần việc của kỹ thuật viên', async ({ page }) => {
  const crashes = trackCrashes(page);
  await signInUi(page, 'technician');
  await expect(page).toHaveURL(/\/alerts$/);

  // 3 mục: cảnh báo, thiết bị, nhà được giao; không còn nhóm "Khác"
  for (const label of ['Cảnh báo', 'Thiết bị & Cảm biến', 'Nhà được giao']) {
    await expect(sidebar(page).getByRole('link', { name: label })).toBeVisible();
  }
  for (const label of ['Tổng quan', 'Hàng đợi việc', 'Thu hoạch', 'Phân tích', 'Cài đặt']) {
    await expect(sidebar(page).getByRole('link', { name: label })).toHaveCount(0);
  }
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('T2 — cảnh báo của nhà được giao mở được ngăn chi tiết (ALERT-FR-007)', async ({ page, request }) => {
  const tech = await signIn(request, 'technician');
  const alert = await sensorFaultAlert(tech);

  const crashes = await openAsTechnician(page, '/alerts');
  const row = sensorFaultRow(page);
  await expect(row).toBeVisible();

  // Bấm cả hàng là mở ngăn chi tiết (cột thao tác chỉ lặp lại việc này)
  await row.click();
  await expect(page.getByRole('heading', { name: 'Lỗi cảm biến' })).toBeVisible();

  // Ngăn chi tiết đọc đúng cảnh báo đang mở: trạng thái của nó khớp dữ liệu máy chủ
  const statusLabel = alert.status === 'ACTIVE' ? 'Mới' : 'Tiếp nhận';
  await expect(page.getByText(statusLabel, { exact: true }).first()).toBeVisible();
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('T3 — xác nhận cảnh báo kèm nguyên nhân tìm thấy tại chỗ (ALERT-FR-009, 018)', async ({ page, request }) => {
  const tech = await signIn(request, 'technician');
  const alert = await sensorFaultAlert(tech);

  const crashes = await openAsTechnician(page, '/alerts');
  const row = sensorFaultRow(page);
  await expect(row).toBeVisible();
  await row.click();
  const acknowledgeInDrawer = page.getByRole('dialog', { name: 'Lỗi cảm biến' }).getByRole('button', { name: 'Xác nhận' });

  // Xác nhận chỉ làm được một lần: lần chạy sau ngăn chi tiết chỉ còn ghi lại nguyên nhân đã nhập
  if (alert.status !== 'ACTIVE') {
    await expect(acknowledgeInDrawer).toHaveCount(0);
    await expect(page.getByText('Nguyên nhân tại chỗ')).toBeVisible();
    expect(alert.site_cause?.cause, 'nguyên nhân đã ghi ở lần chạy trước').toBeTruthy();
    expect(crashes, crashes.join('\n')).toHaveLength(0);
    return;
  }

  await acknowledgeInDrawer.click();
  const form = page.getByRole('dialog');
  await expect(page.getByRole('heading', { name: 'Xác nhận cảnh báo' })).toBeVisible();
  await form.getByRole('button', { name: 'Cảm biến', exact: true }).click();
  await page.locator('#acknowledge-note').fill('E2E: đã kiểm tra tại nhà, dây cảm biến lỏng');
  const saving = page.waitForResponse(
    response => response.url().includes(`/alerts/${alert._id}/acknowledge`) && response.request().method() === 'PUT',
  );
  await form.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  expect((await saving).ok()).toBe(true);
  await expect(page.getByText('Đã xác nhận cảnh báo')).toBeVisible();

  const saved = await tech.data<Alert>(await tech.get(`/alerts/${alert._id}`));
  expect(saved.status).toBe('ACKNOWLEDGED');
  expect(saved.site_cause?.cause).toBe('SENSOR');
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('T4 — thiết bị của nhà được giao: hàng ghi "Nhà · Zone", gửi được lệnh khởi động lại (FARM-FR-013)', async ({ page }) => {
  const crashes = await openAsTechnician(page, '/devices', { farmId, houseId: houseA, zoneId: zoneA });

  // Vị trí chỉ ghi "Nhà · Zone", trang trại đã có ở thanh phạm vi
  await expect(page.getByText('A · Nhà điều khiển · A · Tầng 1').first()).toBeVisible();

  // Kỹ thuật viên được khởi động lại bộ điều khiển của nhà được giao; hộp xác nhận ghi rõ mã thiết bị
  const reboot = page.getByRole('button', { name: 'Khởi động lại thiết bị' }).first();
  await expect(reboot).toBeEnabled();
  await reboot.click();
  await expect(page.getByText(/Thiết bị demo-ctl-a1 sẽ mất kết nối/)).toBeVisible();
  await page.getByRole('button', { name: 'Khởi động lại', exact: true }).click();

  // Bộ điều khiển demo chưa từng kết nối nên máy chủ từ chối lệnh; chỉ kiểm màn hình luôn trả lời sau khi bấm
  await expect(page.getByText(/Đã gửi lệnh khởi động lại|chỉ gửi được khi thiết bị ONLINE/)).toBeVisible();
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('T5 — nhà được giao: ca trực của chính mình, nút Xem thiết bị mở trang thiết bị (AUTH-FR-013, 014)', async ({ page }) => {
  const crashes = await openAsTechnician(page, '/farms');
  await expect(page.getByRole('heading', { name: 'A · Nhà điều khiển' })).toBeVisible();

  // Mỗi nhà ghi ca trực của chính kỹ thuật viên này, hoặc ghi rõ là chưa có ca
  await expect(page.getByText(/Ca trực của bạn|Chưa có ca trực ở nhà này/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Xem thiết bị' }).first().click();
  await expect(page).toHaveURL(/\/devices/);
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});

test('T6 — trang của vai trò khác bị chặn (Report 3 §2.4)', async ({ page }) => {
  const crashes = await openAsTechnician(page, '/dashboard');
  await expect(page).toHaveURL(/\/403$/);

  for (const path of ['/domain-expert/queue', '/harvests', '/analytics']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/403$/);
  }
  expect(crashes, crashes.join('\n')).toHaveLength(0);
});
