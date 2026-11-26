import { isFaultDeviceStatus } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import type { CameraNode, CameraStatus, DeviceStatus, House, SensorNode, Zone } from '@/types';

// 1 thiết bị trên trang Thiết bị (node cảm biến của Zone hoặc camera của cả nhà)
export interface DeviceItem {
  id: string;
  deviceId: string;
  type: 'sensor' | 'camera';
  status: DeviceStatus;
  houseId: string;
  // Chỉ node cảm biến; camera thuộc cả nhà yến
  zoneId?: string;
  rssi?: number;
  // Firmware của node cảm biến, phiên bản mô hình AI của camera
  version?: string;
  lastHeartbeat?: string;
  registeredAt: string;
  bootedAt?: string;
  freeHeap?: number;
  ip?: string;
  // thiết bị của bộ giả lập
  simulated?: boolean;
  // Camera: tình trạng camera IP do nút AI báo
  cameraStatus?: CameraStatus | null;
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
    bootedAt: sensor.booted_at, freeHeap: sensor.free_heap, ip: sensor.ip, simulated: sensor.simulated,
  };
}

function cameraItem(camera: CameraNode, houseId: string): DeviceItem {
  return {
    id: camera._id, deviceId: camera.device_id, type: 'camera', status: camera.status, houseId,
    version: camera.model_version, lastHeartbeat: camera.last_heartbeat, registeredAt: camera.registered_at, simulated: camera.simulated,
    cameraStatus: camera.camera_status ?? null,
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

// Cây Nhà → Zone → thiết bị cho trang Thiết bị; bỏ thiết bị đã gỡ; O(nhà + Zone + thiết bị)
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

// 1 dòng bảng Thiết bị: thiết bị kèm nhà và Zone (camera thuộc cả nhà nên không có Zone)
export interface DeviceRow {
  device: DeviceItem;
  house: House;
  zone?: Zone;
}

// Trải cây Nhà → Zone → thiết bị thành danh sách phẳng, giữ thứ tự nhà, Zone, rồi camera; O(thiết bị)
export function listDeviceRows(inventory: HouseInventory[]): DeviceRow[] {
  return inventory.flatMap(({ house, zoneGroups, cameras }) => [
    ...zoneGroups.flatMap(({ zone, devices }) => devices.map(device => ({ device, house, zone }))),
    ...cameras.map(device => ({ device, house })),
  ]);
}
