import { expect, test } from '@playwright/test';
import { demoFarm, signIn } from './helpers/demoApi';

// tầng A có controller và cảnh báo SENSOR_FAULT đang mở (`npm run seed:demo`). cần controller thật hoặc bộ giả lập và rút mạng router: chạy tay ở buổi tổng duyệt.
test.describe('DS-02 Can thiệp tay bị chặn', () => {
  test('bơm quá 30 phút 422, bơm khi có cảnh báo chưa xác nhận 409, chuyên gia 403, relay vẫn AUTO', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const expert = await signIn(request, 'expert');
    const farm = await demoFarm(owner);
    const zone = await farm.zoneOf('A');
    const [node] = await owner.data<Array<{ _id: string }>>(await owner.get(`/devices/sensor-nodes?zoneId=${zone._id}`));
    const pumpOn = { relayName: 'misting', state: true };

    expect((await owner.post(`/devices/sensor-nodes/${node._id}/relay`, { ...pumpOn, durationMs: 31 * 60_000 })).status()).toBe(422);
    const unconfirmed = await owner.post(`/devices/sensor-nodes/${node._id}/relay`, { ...pumpOn, durationMs: 60_000 });
    expect(unconfirmed.status()).toBe(409);
    expect((await unconfirmed.json()).error.code).toBe('CONFIRMATION_REQUIRED');
    expect((await expert.post(`/devices/sensor-nodes/${node._id}/relay`, { ...pumpOn, durationMs: 60_000 })).status()).toBe(403);

    const after = await owner.data<{ relays: { misting: { mode: string } } }>(await owner.get(`/devices/sensor-nodes/${node._id}`));
    expect(after.relays.misting.mode).toBe('AUTO');
  });
});
