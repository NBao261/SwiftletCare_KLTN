import { isFaultDeviceStatus } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import type { CameraNode, DeviceStatus, House, SensorNode, Zone } from '@/types';

// 1 thiết bị trên trang Thiết bị & Cảm biến (node cảm biến của Zone hoặc camera của cả nhà)
export interface DeviceItem {
  id: string;
  deviceId: string;
  type: 'sensor' | 'camera';
  status: DeviceStatus;
  houseId: string;
  // Chỉ node cảm biến; camera thuộc cả nhà yến (SRS v2.1.8)
  zoneId?: string;
  rssi?: number;
  // Firmware của node cảm biến, phiên bản mô hình AI của camera
  version?: string;
  lastHeartbeat?: string;
  registeredAt: string;
  bootedAt?: string;
  freeHeap?: number;
  ip?: string;
}

export interface ZoneDeviceGroup {
  zone: Zone;
  devices: DeviceItem[];
}

// Số thiết bị theo trạng thái: lỗi = OFFLINE, chờ = PENDING
export interface DeviceTally {
  total: number;
  online: number;
  faulty: number;
  pending: number;
}

// 1 nhà yến: thiết bị chia theo Zone, camera cửa thu chim tính cho cả nhà
export interface HouseInventory {
  house: House;
  zoneGroups: ZoneDeviceGroup[];
  cameras: DeviceItem[];
  tally: DeviceTally;
}

interface InventoryInput {
  houses: House[];
  zones: Zone[];
  sensors: SensorNode[];
  cameras: CameraNode[];
  // Có thì chỉ lấy node cảm biến của Zone này (camera thuộc cả nhà nên bỏ)
  zoneId?: string;
}

function sensorItem(sensor: SensorNode, houseId: string): DeviceItem {
  return {
    id: sensor._id, deviceId: sensor.device_id, type: 'sensor', status: sensor.status, houseId, zoneId: sensor.zone_id,
    rssi: sensor.rssi, version: sensor.firmware_version, lastHeartbeat: sensor.last_heartbeat, registeredAt: sensor.registered_at,
    bootedAt: sensor.booted_at, freeHeap: sensor.free_heap, ip: sensor.ip,
  };
}

function cameraItem(camera: CameraNode, houseId: string): DeviceItem {
  return {
    id: camera._id, deviceId: camera.device_id, type: 'camera', status: camera.status, houseId,
    version: camera.model_version, lastHeartbeat: camera.last_heartbeat, registeredAt: camera.registered_at,
  };
}

// Đếm thiết bị theo trạng thái, 1 lần duyệt
export function tallyDevices(devices: DeviceItem[]): DeviceTally {
  const tally: DeviceTally = { total: devices.length, online: 0, faulty: 0, pending: 0 };
  for (const device of devices) {
    if (device.status === 'ONLINE') tally.online += 1;
    else if (device.status === 'PENDING') tally.pending += 1;
    else if (isFaultDeviceStatus(device.status)) tally.faulty += 1;
  }
  return tally;
}

// Cây Nhà → Zone → thiết bị cho trang Thiết bị & Cảm biến; bỏ thiết bị đã gỡ; O(nhà + Zone + thiết bị)
export function buildDeviceInventory({ houses, zones, sensors, cameras, zoneId }: InventoryInput): HouseInventory[] {
  const houseIdByZone = new Map(zones.map(zone => [zone._id, zone.house_id]));
  const zonesByHouse = new Map<string, Zone[]>();
  for (const zone of zones) {
    if (zoneId && zone._id !== zoneId) continue;
    const list = zonesByHouse.get(zone.house_id) ?? [];
    list.push(zone);
    zonesByHouse.set(zone.house_id, list);
  }

  const sensorsByZone = new Map<string, DeviceItem[]>();
  for (const sensor of sensors) {
    const houseId = houseIdByZone.get(sensor.zone_id);
    if (sensor.decommissioned_at || !houseId) continue;
    const list = sensorsByZone.get(sensor.zone_id) ?? [];
    list.push(sensorItem(sensor, houseId));
    sensorsByZone.set(sensor.zone_id, list);
  }

  // Camera gắn theo nhà (house_id); bản ghi cũ chỉ có zone_id thì quy ra nhà chứa Zone đó
  const camerasByHouse = new Map<string, DeviceItem[]>();
  if (!zoneId) {
    for (const camera of cameras) {
      const houseId = camera.house_id ?? (camera.zone_id ? houseIdByZone.get(camera.zone_id) : undefined);
      if (camera.decommissioned_at || !houseId) continue;
      const list = camerasByHouse.get(houseId) ?? [];
      list.push(cameraItem(camera, houseId));
      camerasByHouse.set(houseId, list);
    }
  }

  return houses.map(house => {
    // Zone tạo trước lên trên, tạo sau xuống dưới: mã ObjectId tăng theo thời gian tạo nên so chuỗi mã là đủ
    const zoneGroups = [...(zonesByHouse.get(house._id) ?? [])]
      .sort((first, second) => (first._id < second._id ? -1 : first._id > second._id ? 1 : 0))
      .map(zone => ({ zone, devices: sensorsByZone.get(zone._id) ?? [] }));
    const houseCameras = camerasByHouse.get(house._id) ?? [];
    const allDevices = [...zoneGroups.flatMap(group => group.devices), ...houseCameras];
    return { house, zoneGroups, cameras: houseCameras, tally: tallyDevices(allDevices) };
  });
}

// Thời gian chạy từ lúc khởi động, tính theo phút/giờ/ngày; chưa có mốc thì undefined
export function uptimeParts(bootedAt: string | undefined, now = Date.now()): { days: number; hours: number; minutes: number } | undefined {
  if (!bootedAt) return undefined;
  const elapsedMinutes = Math.floor((now - new Date(bootedAt).getTime()) / 60_000);
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) return undefined;
  return { days: Math.floor(elapsedMinutes / 1440), hours: Math.floor((elapsedMinutes % 1440) / 60), minutes: elapsedMinutes % 60 };
}

// Tình trạng tổng hợp của 1 nhà: tốt · có thiết bị lỗi / offline · chưa có thiết bị
export type HouseHealth = 'good' | 'fault' | 'empty';

export function houseHealthOf(tally: DeviceTally): HouseHealth {
  if (tally.total === 0) return 'empty';
  return tally.faulty > 0 ? 'fault' : 'good';
}

export type InventorySortKey = 'name' | 'devices' | 'faulty';

export interface InventoryQuery {
  keyword: string;
  health: HouseHealth | '';
  sortKey: InventorySortKey;
  sortDirection: 'asc' | 'desc';
}

// Giá trị dùng để sắp xếp nhà theo từng tiêu chí (tên so theo bảng chữ tiếng Việt)
const SORT_VALUE: Record<Exclude<InventorySortKey, 'name'>, (item: HouseInventory) => number> = {
  devices: item => item.tally.total,
  faulty: item => item.tally.faulty,
};

// Lọc theo tình trạng, tìm theo tên nhà / Zone / mã thiết bị, rồi sắp xếp; trả thêm nhà khớp nhờ Zone hoặc thiết bị để tự xổ ra; O(nhà + thiết bị)
export function queryInventory(inventory: HouseInventory[], query: InventoryQuery): { items: HouseInventory[]; matchedInside: Set<string> } {
  const keyword = query.keyword.trim().toLowerCase();
  const matchedInside = new Set<string>();
  const items = inventory.filter(item => {
    if (query.health && houseHealthOf(item.tally) !== query.health) return false;
    if (!keyword || item.house.name.toLowerCase().includes(keyword)) return true;
    const isInside = item.zoneGroups.some(group => group.zone.name.toLowerCase().includes(keyword)
      || group.devices.some(device => device.deviceId.toLowerCase().includes(keyword)))
      || item.cameras.some(camera => camera.deviceId.toLowerCase().includes(keyword));
    if (isInside) matchedInside.add(item.house._id);
    return isInside;
  });
  const direction = query.sortDirection === 'asc' ? 1 : -1;
  items.sort((first, second) => {
    if (query.sortKey === 'name') return first.house.name.localeCompare(second.house.name, 'vi') * direction;
    const value = SORT_VALUE[query.sortKey];
    return (value(first) - value(second)) * direction || first.house.name.localeCompare(second.house.name, 'vi');
  });
  return { items, matchedInside };
}
