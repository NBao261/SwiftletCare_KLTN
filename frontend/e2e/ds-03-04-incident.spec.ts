import { expect, test } from '@playwright/test';
import { demoFarm, signIn } from './helpers/demoApi';

interface Alert { _id: string; routing?: { technician_id?: string; owners_notified: boolean } }
interface WorkOrder { _id: string; status: string }

// nhà B có cảnh báo phun không tăng ẩm, Work Order đã báo xong (`npm run seed:demo`). 15 phút leo thang và 10 phút kiểm phục hồi của đo bằng bộ giả lập, không chạy ở đây.
test.describe('DS-03, DS-04 Xử lý sự cố', () => {
  // Chỉ kiểm điều không đổi theo thời gian: sau 15 phút cảnh báo leo thang tới Farm Owner, sau khoảng 70 phút Work Order sang chờ duyệt (job nền chạy trên staging), nên không assert `owners_notified` hay đúng một trạng thái
  test('DS-03 cảnh báo tới thợ của nhà trước, Work Order của nó đã báo xong', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const farm = await demoFarm(owner);
    const zone = await farm.zoneOf('B');
    const alerts = await owner.data<Alert[]>(await owner.get(`/alerts?farmId=${farm.farmId}&zoneId=${zone._id}&type=MISTING_INEFFECTIVE`));
    expect(alerts).toHaveLength(1);
    // định tuyến tới thợ của nhà, Farm Owner được báo sau
    expect(alerts[0].routing?.technician_id).toBeTruthy();
    const orders = await owner.data<WorkOrder[]>(await owner.get(`/work-orders?farmId=${farm.farmId}&alertId=${alerts[0]._id}`));
    expect(orders).toHaveLength(1);
    expect(['VERIFYING', 'AWAITING_APPROVAL']).toContain(orders[0].status);
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
