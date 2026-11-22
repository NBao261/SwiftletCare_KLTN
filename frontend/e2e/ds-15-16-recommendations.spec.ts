import { expect, test } from '@playwright/test';
import { demoFarm, signIn } from './helpers/demoApi';

interface Recommendation { _id: string; status: string; work_order_id?: string }

// Cần `npm run seed:demo`. Xét luật và đo hiệu quả chạy bằng `npm run job:run` ở buổi tổng duyệt
test.describe('DS-15, DS-16 Vòng khuyến nghị', () => {
  test('DS-16 từ chối không lý do 422, khuyến nghị vẫn mở', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const farm = await demoFarm(owner);
    const [open] = await owner.data<Recommendation[]>(await owner.get(`/recommendations?houseId=${farm.house('C')._id}&status=OPEN`));
    test.skip(!open, 'đã quyết định ở lần chạy trước: chạy lại `npm run seed:demo`');
    expect((await owner.post(`/recommendations/${open._id}/reject`, { reason: '' })).status()).toBe(422);
    expect((await owner.data<Recommendation>(await owner.get(`/recommendations/${open._id}`))).status).toBe('OPEN');
  });

  test('DS-15 Farm Owner chấp nhận thì có Work Order', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const farm = await demoFarm(owner);
    const [open] = await owner.data<Recommendation[]>(await owner.get(`/recommendations?houseId=${farm.house('C')._id}&status=OPEN`));
    test.skip(!open, 'đã quyết định ở lần chạy trước: chạy lại `npm run seed:demo`');
    const accepted = await owner.data<Recommendation>(await owner.post(`/recommendations/${open._id}/accept`));
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.work_order_id).toBeTruthy();
  });
});
