// Dữ liệu giả tên thiết bị con của bộ kit (do Kỹ thuật viên đặt khi lắp) — chờ API danh sách thiết bị con của sensor node
import type { ComponentKind } from '@/components/features/farm-owner/devices/zoneComponents';

// 1 thiết bị con của bộ kit: loại + tên Kỹ thuật viên đặt
export interface DeviceComponentName {
  kind: ComponentKind;
  name: string;
}

// device_id của bộ kit → thiết bị con theo thứ tự lắp; bộ kit không có trong bảng thì chưa được đặt tên
export const DEVICE_COMPONENT_NAMES: Record<string, DeviceComponentName[]> = {
  node_001: [
    { kind: 'temperature', name: 'Nhiệt độ - giữa tầng' },
    { kind: 'humidity', name: 'Độ ẩm - giữa tầng' },
    { kind: 'light', name: 'Ánh sáng - lối vào' },
    { kind: 'nh3', name: 'NH3 - sàn phân' },
    { kind: 'co2', name: 'CO2 - giữa tầng' },
    { kind: 'sound', name: 'Micro - cửa thu chim' },
    { kind: 'speaker', name: 'Loa ru cửa chính' },
    { kind: 'misting', name: 'Bơm phun sương 1' },
    { kind: 'ventilation', name: 'Quạt hút cuối nhà' },
  ],
};
