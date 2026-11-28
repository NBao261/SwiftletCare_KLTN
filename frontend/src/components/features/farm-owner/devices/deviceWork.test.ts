import { describe, expect, it } from 'vitest';

import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import {
  compareAttention, deviceWork, groupOpenItemsByDevice, needsAttention, NO_OPEN_ITEMS, type DeviceOpenItems,
} from '@/components/features/farm-owner/devices/deviceWork';
import type { Alert, WorkOrder } from '@/types';

const NOW = new Date('2026-11-28T10:00:00Z').getTime();
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function device(patch: Partial<DeviceItem>): DeviceItem {
  return {
    id: 'd1', deviceId: 'ctl-1', type: 'sensor', status: 'ONLINE', houseId: 'h1',
    registeredAt: minutesAgo(60 * 24), lastHeartbeat: minutesAgo(0), version: '2.4.0', ...patch,
  };
}
const alert = (patch: Partial<Alert>) => ({ _id: 'a1', type: 'SENSOR_FAULT', node_id: 'd1', ...patch }) as Alert;
const workOrder = (patch: Partial<WorkOrder>) => ({ _id: 'w1', node_id: 'd1', ...patch }) as WorkOrder;

describe('việc đang mở theo thiết bị', () => {
  it('gom cảnh báo thiết bị và Work Order theo node; bỏ cảnh báo suy luận và cảnh báo không gắn node', () => {
    const grouped = groupOpenItemsByDevice(
      [alert({}), alert({ _id: 'a2', type: 'THRESHOLD_BREACH' }), alert({ _id: 'a3', node_id: undefined }), alert({ _id: 'a4', node_id: 'd2', type: 'NODE_OFFLINE' })],
      [workOrder({}), workOrder({ _id: 'w2', node_id: null })],
    );
    expect(grouped.get('d1')?.alerts.map(item => item._id)).toEqual(['a1']);
    expect(grouped.get('d1')?.workOrders.map(item => item._id)).toEqual(['w1']);
    expect(grouped.get('d2')?.alerts.map(item => item._id)).toEqual(['a4']);
    expect(grouped.size).toBe(2);
  });
});

describe('việc cần làm theo tình trạng thiết bị', () => {
  it('bộ điều khiển mất kết nối: nói đi kiểm nguồn và Wi-Fi, kèm lần cuối kết nối nếu có', () => {
    expect(deviceWork(device({ status: 'OFFLINE' }), NOW)).toMatchObject({ key: 'work.sensorOffline', tone: 'warn', needsLastSeen: true });
    expect(deviceWork(device({ status: 'OFFLINE', lastHeartbeat: undefined }), NOW)?.key).toBe('work.sensorOfflineNoTime');
  });

  it('chờ kết nối: dưới 15 phút chỉ báo chờ, từ 15 phút nói thiết lập lại (BR-27)', () => {
    expect(deviceWork(device({ status: 'PENDING', registeredAt: minutesAgo(14) }), NOW)).toMatchObject({ key: 'work.pendingWait', tone: 'info' });
    expect(deviceWork(device({ status: 'PENDING', registeredAt: minutesAgo(15) }), NOW)).toMatchObject({ key: 'work.pendingLate', tone: 'warn', canSetUpAgain: true });
  });

  it('bộ điều khiển online: sóng yếu hoặc firmware cũ chỉ để biết; khoẻ thì không nói gì', () => {
    expect(deviceWork(device({}), NOW)).toBeNull();
    expect(deviceWork(device({ rssi: -80 }), NOW)).toMatchObject({ key: 'work.weakWifi', tone: 'info' });
    expect(deviceWork(device({ version: '1.3.0' }), NOW)).toMatchObject({ key: 'work.oldFirmware', tone: 'info' });
    expect(deviceWork(device({ version: undefined }), NOW)?.key).toBe('work.oldFirmware');
  });

  it('camera: mất kết nối và mỗi tình trạng camera IP lỗi có câu riêng; đang nhận hình hoặc chưa báo thì không nói gì', () => {
    expect(deviceWork(device({ type: 'camera', status: 'OFFLINE' }), NOW)?.key).toBe('work.cameraNodeOffline');
    for (const status of ['NO_SOURCE', 'AUTH_FAILED', 'UNREACHABLE', 'NO_FRAMES'] as const) {
      expect(deviceWork(device({ type: 'camera', cameraStatus: status }), NOW)).toMatchObject({ key: `work.cam.${status}`, tone: 'warn' });
    }
    expect(deviceWork(device({ type: 'camera', cameraStatus: 'OK' }), NOW)).toBeNull();
    expect(deviceWork(device({ type: 'camera', cameraStatus: null }), NOW)).toBeNull();
  });
});

describe('tab Cần xử lý', () => {
  const withAlert: DeviceOpenItems = { alerts: [alert({})], workOrders: [] };

  it('vào tab khi cần ai đó xử lý hoặc còn cảnh báo thiết bị mở; sóng yếu hay chờ dưới 15 phút thì chưa', () => {
    expect(needsAttention(device({ status: 'OFFLINE' }), NO_OPEN_ITEMS, NOW)).toBe(true);
    expect(needsAttention(device({}), withAlert, NOW)).toBe(true);
    expect(needsAttention(device({ type: 'camera', cameraStatus: 'AUTH_FAILED' }), NO_OPEN_ITEMS, NOW)).toBe(true);
    expect(needsAttention(device({ rssi: -80 }), NO_OPEN_ITEMS, NOW)).toBe(false);
    expect(needsAttention(device({ status: 'PENDING', registeredAt: minutesAgo(3) }), NO_OPEN_ITEMS, NOW)).toBe(false);
    expect(needsAttention(device({}), NO_OPEN_ITEMS, NOW)).toBe(false);
  });

  it('xếp mất kết nối lâu nhất lên đầu, rồi lỗi camera, cuối cùng thiết bị chỉ còn cảnh báo', () => {
    const rows = [
      { device: device({ id: 'alertOnly' }), items: withAlert },
      { device: device({ id: 'camera', type: 'camera', cameraStatus: 'UNREACHABLE' }), items: NO_OPEN_ITEMS },
      { device: device({ id: 'offlineNew', status: 'OFFLINE', lastHeartbeat: minutesAgo(5) }), items: NO_OPEN_ITEMS },
      { device: device({ id: 'offlineOld', status: 'OFFLINE', lastHeartbeat: minutesAgo(90) }), items: NO_OPEN_ITEMS },
      { device: device({ id: 'offlineNever', status: 'OFFLINE', lastHeartbeat: undefined }), items: NO_OPEN_ITEMS },
    ];
    const order = [...rows].sort((first, second) => compareAttention(first, second, NOW)).map(row => row.device.id);
    expect(order).toEqual(['offlineOld', 'offlineNew', 'offlineNever', 'camera', 'alertOnly']);
  });
});
