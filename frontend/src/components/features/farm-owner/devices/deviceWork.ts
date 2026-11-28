import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import { DEVICE_ALERT_TYPES } from '@/constants/deviceAlertTypes';
import type { DevicesKey } from '@/constants/devices.i18n';
import { restartBlockCode } from '@/lib/deviceCommand';
import { wifiQuality } from '@/lib/helpers';
import type { Alert, WorkOrder } from '@/types';

// Thiết bị còn PENDING quá ngần này sau khi đăng ký thì coi là chưa kết nối được (Report 3, BR-27)
const PENDING_LIMIT_MS = 15 * 60_000;

// Việc còn mở của 1 thiết bị: cảnh báo thiết bị và Work Order gắn với nó
export interface DeviceOpenItems {
  alerts: Alert[];
  workOrders: WorkOrder[];
}

export const NO_OPEN_ITEMS: DeviceOpenItems = { alerts: [], workOrders: [] };

// Gom 1 lượt cảnh báo và Work Order còn mở của các nhà theo thiết bị; cảnh báo suy luận của nhà không thuộc thiết bị nào
export function groupOpenItemsByDevice(alerts: Alert[], workOrders: WorkOrder[]): Map<string, DeviceOpenItems> {
  const byDevice = new Map<string, DeviceOpenItems>();
  const entryOf = (deviceId: string) => {
    const entry = byDevice.get(deviceId) ?? { alerts: [], workOrders: [] };
    byDevice.set(deviceId, entry);
    return entry;
  };
  for (const alert of alerts) {
    if (alert.node_id && DEVICE_ALERT_TYPES.includes(alert.type)) entryOf(alert.node_id).alerts.push(alert);
  }
  for (const workOrder of workOrders) {
    if (workOrder.node_id) entryOf(workOrder.node_id).workOrders.push(workOrder);
  }
  return byDevice;
}

// Việc cần làm cho tình trạng của thiết bị; warn = cần ai đó xử lý, info = chỉ để biết
export interface DeviceWork {
  key: DevicesKey;
  tone: 'warn' | 'info';
  // Câu cần giờ lần cuối kết nối
  needsLastSeen?: boolean;
  // Có nút thiết lập lại (thiết bị chưa kết nối được sau khi đăng ký)
  canSetUpAgain?: boolean;
}

// Tình trạng thiết bị → một câu việc cần làm; null = không có gì cần nói
export function deviceWork(device: DeviceItem, now = Date.now()): DeviceWork | null {
  if (device.status === 'PENDING') {
    const waited = now - new Date(device.registeredAt).getTime();
    return waited >= PENDING_LIMIT_MS
      ? { key: 'work.pendingLate', tone: 'warn', canSetUpAgain: true }
      : { key: 'work.pendingWait', tone: 'info' };
  }
  if (device.status === 'OFFLINE') {
    if (device.type === 'camera') return { key: 'work.cameraNodeOffline', tone: 'warn' };
    return device.lastHeartbeat
      ? { key: 'work.sensorOffline', tone: 'warn', needsLastSeen: true }
      : { key: 'work.sensorOfflineNoTime', tone: 'warn' };
  }
  if (device.type === 'camera') {
    switch (device.cameraStatus) {
      case 'NO_SOURCE': return { key: 'work.cam.NO_SOURCE', tone: 'warn' };
      case 'AUTH_FAILED': return { key: 'work.cam.AUTH_FAILED', tone: 'warn' };
      case 'UNREACHABLE': return { key: 'work.cam.UNREACHABLE', tone: 'warn' };
      case 'NO_FRAMES': return { key: 'work.cam.NO_FRAMES', tone: 'warn' };
      default: return null;
    }
  }
  if (wifiQuality(device.rssi) === 'weak') return { key: 'work.weakWifi', tone: 'info' };
  const block = restartBlockCode({ status: device.status, firmware_version: device.version });
  if (block === 'noVersion' || block === 'oldFirmware') return { key: 'work.oldFirmware', tone: 'info' };
  return null;
}

// Thiết bị đáng xem trước: cần ai đó xử lý, hoặc còn cảnh báo thiết bị mở
export function needsAttention(device: DeviceItem, items: DeviceOpenItems, now = Date.now()): boolean {
  return deviceWork(device, now)?.tone === 'warn' || items.alerts.length > 0;
}

// Mất kết nối lâu nhất lên đầu, rồi các lỗi khác, cuối cùng thiết bị chỉ còn cảnh báo mở
function attentionRank(device: DeviceItem, now: number): number {
  if (device.status === 'OFFLINE') return 0;
  return deviceWork(device, now)?.tone === 'warn' ? 1 : 2;
}

export function compareAttention(
  first: { device: DeviceItem; items: DeviceOpenItems },
  second: { device: DeviceItem; items: DeviceOpenItems },
  now = Date.now(),
): number {
  const byRank = attentionRank(first.device, now) - attentionRank(second.device, now);
  if (byRank !== 0) return byRank;
  // Chưa từng có heartbeat thì xếp sau những máy đã có mốc mất kết nối
  const lastSeen = (device: DeviceItem) => (device.lastHeartbeat ? new Date(device.lastHeartbeat).getTime() : Number.POSITIVE_INFINITY);
  return lastSeen(first.device) - lastSeen(second.device);
}
