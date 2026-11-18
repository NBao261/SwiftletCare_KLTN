import { expect, test } from '@playwright/test';
import { demoFarm, signIn } from './helpers/demoApi';

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
});
