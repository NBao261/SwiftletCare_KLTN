import { describe, expect, it } from 'vitest';
import { countHouses } from '@/components/features/farm-owner/overview/FarmOverviewSummary';
import type { HouseOverview } from '@/types';

const house = (patch: Partial<HouseOverview>): HouseOverview => ({
  house_id: 'h', name: 'Nhà', stage: 'OCCUPIED', status: null, status_reason: 'NOT_COMPUTED',
  open_alerts: 0, open_work_orders: 0, latest_return_rate: null, simulated: false, ...patch,
});

describe('countHouses', () => {
  it('đếm nhà theo trạng thái, giai đoạn và cộng cảnh báo, phiếu đang mở', () => {
    const counts = countHouses([
      house({ status: 'ACTION', open_alerts: 2, open_work_orders: 1 }),
      house({ status: 'WATCH', stage: 'ATTRACTING' }),
      house({ status: 'GOOD', open_alerts: 1, open_work_orders: 3 }),
    ]);
    expect(counts).toEqual({ attracting: 1, action: 1, watch: 1, alerts: 3, housesWithAlerts: 2, workOrders: 4 });
  });
});
