import { expect, test } from '@playwright/test';
import { ACCOUNTS, DEMO_FARM, PASSWORD, demoFarm, signIn } from './helpers/demoApi';

interface Alert { _id: string; status: string; onsite_checks: Array<{ observation: string | null }> }

// WF-04 — DS-07, DS-08 (Design Brief Phụ lục A2): cảnh báo ồn bất thường ở nhà A chờ kết luận (`npm run seed:demo`).
// Phát tiếng ồn thật cạnh cảm biến của DS-07 làm tại chỗ; ở đây đi tiếp từ cảnh báo đã có.
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
    test.skip(alert.status === 'DISMISSED', 'đã bác bỏ ở lần chạy trước: chạy lại `npm run seed:demo`');

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

  // EXPERT-FR-003 — trang kết luận chỉ có 4 loại cảnh báo suy luận của Report 3. Trang xem theo một zone (thanh phạm vi):
  // zone A có cảnh báo ồn chờ kết luận; zone B có MISTING_INEFFECTIVE của DS-04, cảnh báo đo trực tiếp, không được hiện
  // (trước khi sửa nó nằm trong danh sách và gửi kết luận thì backend trả 400)
  test('trang kết luận hiện cảnh báo ồn ở zone A, không hiện cảnh báo phun sương đo trực tiếp ở zone B', async ({ page, request }) => {
    const farm = await demoFarm(await signIn(request, 'owner'));
    const zoneA = await farm.zoneOf('A');
    const zoneB = await farm.zoneOf('B');

    await page.goto('/login');
    await page.getByLabel('Email').fill(ACCOUNTS.expert);
    await page.getByLabel('Mật khẩu').fill(PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/domain-expert\/queue$/);

    // Chọn phạm vi farm → nhà → zone như thanh phạm vi lưu vào zoneStore (localStorage `swiftletcare-zone`)
    const openVerdictsIn = async (house: 'A' | 'B', zone: { _id: string; name: string }) => {
      const state = {
        selectedFarmId: farm.farmId, selectedFarmName: DEMO_FARM, selectedZoneId: zone._id, selectedZoneName: zone.name,
        scopeFarmId: '', selectedHouseId: farm.house(house)._id, scopeZoneId: '',
      };
      await page.evaluate(value => localStorage.setItem('swiftletcare-zone', value), JSON.stringify({ state, version: 2 }));
      await page.goto('/domain-expert/alert-verdicts');
    };

    await openVerdictsIn('A', zoneA);
    await expect(page.getByText('mức ồn cao hơn nền', { exact: false }).first()).toBeVisible();

    await openVerdictsIn('B', zoneB);
    await expect(page.getByText('Không có cảnh báo nào phù hợp bộ lọc.')).toBeVisible();
    await expect(page.getByText('độ ẩm không tăng', { exact: false })).toHaveCount(0);
  });
});
