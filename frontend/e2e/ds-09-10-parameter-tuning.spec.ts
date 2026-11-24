import { expect, test } from '@playwright/test';
import { demoFarm, signIn } from './helpers/demoApi';

interface Proposal { _id: string; status: string }

// tầng A có 14 ngày dữ liệu nên có gợi ý hệ số (`npm run seed:demo`)
test.describe('DS-09, DS-10 Chỉnh tham số điều khiển', () => {
  test('DS-10 Farm Owner của farm có chuyên gia không tự áp gợi ý, hệ số giữ nguyên', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const farm = await demoFarm(owner);
    const zone = await farm.zoneOf('A');
    const before = await owner.data<{ fuzzy_tuning: object }>(await owner.get(`/farms/zones/${zone._id}`));
    expect((await owner.post(`/farms/zones/${zone._id}/fuzzy-tuning/apply-suggestion`)).status()).toBe(403);
    const after = await owner.data<{ fuzzy_tuning: object }>(await owner.get(`/farms/zones/${zone._id}`));
    expect(after.fuzzy_tuning).toEqual(before.fuzzy_tuning);
  });

  test('DS-09 Farm Owner gửi gợi ý, chuyên gia duyệt thì đề xuất APPROVED', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const expert = await signIn(request, 'expert');
    const farm = await demoFarm(owner);
    const zone = await farm.zoneOf('A');
    const proposal = await owner.data<Proposal>(await owner.post('/expert-activity/proposals', { zoneId: zone._id }));
    expect(proposal.status).toBe('PROPOSED');
    const approved = await expert.data<Proposal>(await expert.put(`/expert-activity/proposals/${proposal._id}/approve`));
    expect(approved.status).toBe('APPROVED');
  });
});
