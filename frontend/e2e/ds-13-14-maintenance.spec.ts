import { expect, test } from '@playwright/test';
import { demoFarm, signIn } from './helpers/demoApi';

interface Plan { _id: string; equipment: string; basis: string; interval: number; state: string }
interface WorkOrder { _id: string; status: string; kind: string; origin?: string; plan_id?: string; checklist: Array<{ item: string }> }

// kế hoạch bơm 500 giờ (bộ đếm 499 giờ) và kế hoạch béc phun đến hạn 7 ngày (`npm run seed:demo`). Chạy bơm thêm 1 giờ của cần controller thật hoặc bộ giả lập.
test.describe('DS-13, DS-14 Bảo trì phòng ngừa', () => {
  test('DS-13 kế hoạch bơm theo giờ chạy chưa đến hạn ở 499 giờ', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const farm = await demoFarm(owner);
    const plans = await owner.data<Plan[]>(await owner.get(`/maintenance/plans?houseId=${farm.house('A')._id}`));
    expect(plans.find(plan => plan.equipment === 'PUMP')).toMatchObject({ basis: 'RUN_HOURS', interval: 500, state: 'SCHEDULED' });
  });

  test('DS-14 Work Order phòng ngừa: mục checklist "hỏng" mở Work Order sửa chữa', async ({ request }) => {
    const owner = await signIn(request, 'owner');
    const technician = await signIn(request, 'technician');
    const farm = await demoFarm(owner);
    const houseId = farm.house('A')._id;
    const plans = await owner.data<Plan[]>(await owner.get(`/maintenance/plans?houseId=${houseId}`));
    const nozzle = plans.find(plan => plan.equipment === 'NOZZLE');
    // Job bảo trì mỗi giờ có thể đã chuyển kế hoạch sang quá hạn
    expect(['DUE', 'OVERDUE']).toContain(nozzle?.state);

    const orders = await owner.data<WorkOrder[]>(await owner.get(`/work-orders?farmId=${farm.farmId}&houseId=${houseId}`));
    const preventive = orders.find(order => order.plan_id === nozzle?._id && order.kind === 'PREVENTIVE');
    expect(preventive?.checklist.length).toBeGreaterThan(0);
    if (preventive?.status === 'OPEN') expect((await technician.post(`/work-orders/${preventive._id}/start`)).ok()).toBe(true);
    const defect = await technician.put(`/work-orders/${preventive?._id}/checklist`, { item_index: 0, result: 'DEFECT', note: 'Béc số 3 bị nứt' });
    expect(defect.ok()).toBe(true);

    const after = await owner.data<WorkOrder[]>(await owner.get(`/work-orders?farmId=${farm.farmId}&houseId=${houseId}`));
    expect(after.some(order => order.origin === 'CHECKLIST' && order.kind === 'REPAIR')).toBe(true);
  });
});
