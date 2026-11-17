import { expect, test } from '@playwright/test';
import { demoFarm, signIn } from './helpers/demoApi';

interface Alert { _id: string; routing?: { owners_notified: boolean } }
interface WorkOrder { _id: string; status: string }

// WF-02 — DS-03, DS-04 (Design Brief Phụ lục A2): nhà B có cảnh báo phun không tăng ẩm, Work Order đã báo xong (`npm run seed:demo`).
// 15 phút leo thang và 10 phút kiểm phục hồi của DS-03 đo bằng bộ giả lập (NFR-15), không chạy ở đây.
test.describe('DS-03, DS-04 Xử lý sự cố', () => {
  test('DS-03 cảnh báo tới thợ trước, Work Order của nó đang kiểm phục hồi', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const farm = await demoFarm(owner);
    const zone = await farm.zoneOf('B');
    const alerts = await owner.data<Alert[]>(await owner.get(`/alerts?farmId=${farm.farmId}&zoneId=${zone._id}&type=MISTING_INEFFECTIVE`));
    expect(alerts).toHaveLength(1);
    // BR-40: Farm Owner chỉ được báo khi thợ chưa xác nhận sau 15 phút
    expect(alerts[0].routing?.owners_notified).toBe(false);
    const orders = await owner.data<WorkOrder[]>(await owner.get(`/work-orders?farmId=${farm.farmId}&alertId=${alerts[0]._id}`));
    expect(orders.map(order => order.status)).toEqual(['VERIFYING']);
  });

  test('DS-04 thợ của nhà khác không xác nhận được cảnh báo, không làm được Work Order', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const otherTechnician = await signIn(request, 'otherHouseTechnician');
    const farm = await demoFarm(owner);
    const zone = await farm.zoneOf('B');
    const [alert] = await owner.data<Alert[]>(await owner.get(`/alerts?farmId=${farm.farmId}&zoneId=${zone._id}&type=MISTING_INEFFECTIVE`));
    const [order] = await owner.data<WorkOrder[]>(await owner.get(`/work-orders?farmId=${farm.farmId}&alertId=${alert._id}`));

    expect((await otherTechnician.put(`/alerts/${alert._id}/acknowledge`, { note: 'thử từ nhà khác' })).status()).toBe(403);
    expect((await otherTechnician.post(`/work-orders/${order._id}/done`, { cause: 'NOZZLE' })).status()).toBe(403);
  });
});
