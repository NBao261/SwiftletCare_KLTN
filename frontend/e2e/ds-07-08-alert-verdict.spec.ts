import { expect, test } from '@playwright/test';
import { ACCOUNTS, DEMO_FARM, PASSWORD, demoFarm, signIn } from './helpers/demoApi';

interface Alert {
  _id: string;
  status: string;
  expert_verdict?: { result: string };
  onsite_checks: Array<{ observation: string | null }>;
}

// Cần `npm run seed:demo`: có sẵn cảnh báo ồn chờ kết luận ở nhà A
test.describe('DS-07, DS-08 Kiểm chứng cảnh báo suy luận', () => {
  test('DS-08 Farm Owner của farm có chuyên gia không ghi được kết luận', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const farm = await demoFarm(owner);
    const [alert] = await owner.data<Alert[]>(await owner.get(`/alerts?farmId=${farm.farmId}&type=NOISE_ANOMALY`));
    expect((await owner.put(`/alerts/${alert._id}/verdict`, { result: 'CONFIRMED' })).status()).toBe(403);
  });

  test('DS-07 thợ ghi kiểm tra tại chỗ, chuyên gia bác bỏ có lý do, cảnh báo thành DISMISSED', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const technician = await signIn(request, 'technician');
    const expert = await signIn(request, 'expert');
    const farm = await demoFarm(owner);
    const [alert] = await owner.data<Alert[]>(await owner.get(`/alerts?farmId=${farm.farmId}&type=NOISE_ANOMALY`));
    // Dữ liệu demo chỉ có một cảnh báo suy luận, và B2 của expert-flow cũng ghi kết luận lên nó: đã có
    // kết luận thì bước này không còn gì để bác bỏ, phải seed lại mới chạy được
    test.skip(Boolean(alert.expert_verdict), 'cảnh báo đã có kết luận ở lần chạy trước: chạy lại `npm run seed:demo`');

    if (alert.onsite_checks[0]?.observation === null) {
      const check = await technician.post(`/alerts/${alert._id}/onsite-check`, {
        observation: 'WORK_OR_PEOPLE_NEARBY', note: 'Có người sửa mái nhà bên cạnh',
      });
      expect(check.ok()).toBe(true);
    }
    // Bác bỏ phải ghi lý do
    expect((await expert.put(`/alerts/${alert._id}/verdict`, { result: 'REJECTED' })).status()).toBe(422);
    const verdict = await expert.put(`/alerts/${alert._id}/verdict`, {
      result: 'REJECTED', note: 'Tiếng ồn do sửa nhà bên cạnh, không phải chim',
    });
    expect((await expert.data<Alert>(verdict)).status).toBe('DISMISSED');

    const detail = await owner.data<Alert>(await owner.get(`/alerts/${alert._id}`));
    expect(detail.status).toBe('DISMISSED');
    expect(detail.onsite_checks[0].observation).toBe('WORK_OR_PEOPLE_NEARBY');
  });

  // EXPERT-FR-003 — trang kết luận chỉ có 4 loại cảnh báo suy luận của Report 3. DE-03: mặc định cả trang trại,
  // Zone là bộ lọc trong card. Zone A có cảnh báo ồn chờ kết luận; zone B có MISTING_INEFFECTIVE của DS-04,
  // cảnh báo đo trực tiếp, không được hiện (trước khi sửa nó nằm trong danh sách và gửi kết luận thì backend trả 400)
  test('trang kết luận hiện cảnh báo ồn ở zone A, không hiện cảnh báo phun sương đo trực tiếp ở zone B', async ({ page, request }) => {
    const farm = await demoFarm(await signIn(request, 'owner'));
    const zoneB = await farm.zoneOf('B');

    await page.goto('/login');
    await page.getByLabel('Email').fill(ACCOUNTS.expert);
    await page.getByLabel('Mật khẩu').fill(PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/domain-expert\/queue$/);

    // Đặt phạm vi farm vào zoneStore để trang mặc định lấy cả trang trại
    const setFarmScope = async () => {
      const state = {
        selectedFarmId: farm.farmId, selectedFarmName: DEMO_FARM, selectedZoneId: '',  selectedZoneName: '',
        scopeFarmId: '', selectedHouseId: farm.house('A')._id, scopeZoneId: '',
      };
      await page.evaluate(value => localStorage.setItem('swiftletcare-zone', value), JSON.stringify({ state, version: 2 }));
      await page.goto('/domain-expert/alert-verdicts');
    };

    // Mặc định cả trang trại: cảnh báo ồn ở zone A phải hiện
    await setFarmScope();
    await expect(page.getByText('mức ồn cao hơn nền', { exact: false }).first()).toBeVisible();

    // Lọc zone B trong card: không hiện cảnh báo phun sương đo trực tiếp
    const zoneFilter = page.getByLabel('Lọc theo Zone');
    await expect(zoneFilter).toBeVisible();
    await zoneFilter.click();
    await page.getByRole('option', { name: zoneB.name }).click();
    await expect(page.getByText('Không có cảnh báo nào phù hợp bộ lọc.')).toBeVisible();
    await expect(page.getByText('độ ẩm không tăng', { exact: false })).toHaveCount(0);
  });
});
