import type { HouseHealth } from '@/components/features/farm-owner/devices/deviceInventory';
import type { ComponentStatus } from '@/components/features/farm-owner/devices/zoneComponents';

// Trang chi tiết thiết bị của 1 nhà yến; id truyền qua history state, không đưa lên URL (FE_Design 13.16)
export const DEVICE_DETAIL_PATH = '/devices/detail';

export interface DeviceDetailState {
  houseId: string;
  // Có thì cuộn tới và làm nổi thiết bị này
  deviceId?: string;
}

// Màu pill tình trạng 1 nhà: tốt (xanh chanh = thiết bị online), có lỗi (cam = sự cố), chưa có thiết bị (xám)
export const HEALTH_PILL_CLASS: Record<HouseHealth, { pill: string; dot: string }> = {
  good: { pill: 'bg-accent-50 text-accent-800', dot: 'bg-accent-600' },
  fault: { pill: 'bg-orange-50 text-orange-700', dot: 'bg-safetyOrange' },
  empty: { pill: 'bg-warmGray/10 text-warmGray', dot: 'bg-warmGray/40' },
};

// Màu trạng thái 1 bộ phận: xanh chanh = đang chạy, cam = lỗi / mất kết nối, xám = tắt / chưa có số
export const COMPONENT_STATUS_CLASS: Record<ComponentStatus, { dot: string; text: string }> = {
  ok: { dot: 'bg-accent-600', text: 'text-charcoal' },
  on: { dot: 'bg-accent-600', text: 'text-charcoal' },
  off: { dot: 'bg-gray-400', text: 'text-warmGray' },
  fault: { dot: 'bg-safetyOrange', text: 'text-orange-700' },
  stale: { dot: 'bg-gray-300', text: 'text-warmGray' },
  noData: { dot: 'bg-gray-300', text: 'text-warmGray' },
  offline: { dot: 'bg-safetyOrange', text: 'text-orange-700' },
  pending: { dot: 'bg-gray-300', text: 'text-warmGray' },
  unchecked: { dot: 'bg-gray-300', text: 'text-warmGray' },
};
