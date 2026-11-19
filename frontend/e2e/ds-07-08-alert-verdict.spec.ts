import { expect, test } from '@playwright/test';
import { ACCOUNTS, PASSWORD, demoFarm, signIn } from './helpers/demoApi';

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

  // EXPERT-FR-003 — trang kết luận chỉ có 4 loại cảnh báo suy luận của Report 3; MISTING_INEFFECTIVE của nhà B
  // (DS-04) là cảnh báo đo trực tiếp, không được hiện cho chuyên gia kết luận (backend trả 400 nếu gửi kết luận)
  test('trang kết luận hiện cảnh báo ồn bất thường, không hiện cảnh báo phun sương đo trực tiếp', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ACCOUNTS.expert);
    await page.getByLabel('Mật khẩu').fill(PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/domain-expert\/queue$/);

    await page.goto('/domain-expert/alert-verdicts');
    await expect(page.getByText('mức ồn cao hơn nền', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('độ ẩm không tăng', { exact: false })).toHaveCount(0);
  });
});
