import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import type { Alert, SensorNode, TelemetryRecord } from '@/types';

// Bộ phận của 1 node cảm biến ESP32: 5 cảm biến RS485 + micro đo âm thanh, loa ru và 2 relay chấp hành
export type ComponentKind = 'temperature' | 'humidity' | 'light' | 'nh3' | 'co2' | 'sound' | 'speaker' | 'misting' | 'ventilation';

// Trạng thái 1 bộ phận: hoạt động (có số đo) · đang bật/phát · đang tắt · lỗi · số đo đã cũ · chưa có số đo
// · node mất kết nối / chờ kết nối · chưa bấm kiểm tra
export type ComponentStatus = 'ok' | 'on' | 'off' | 'fault' | 'stale' | 'noData' | 'offline' | 'pending' | 'unchecked';

export interface ComponentItem {
  nodeId: string;
  deviceId: string;
  status: ComponentStatus;
  // Số đo mới nhất của cảm biến (đơn vị theo loại) và thời điểm đo
  value?: number;
  readingAt?: string;
  // Bản ghi node lấy lúc kiểm tra: relay, loa, giờ chạy… để hiện mục Thông số
  detail?: SensorNode;
}

export interface ComponentGroup {
  kind: ComponentKind;
  items: ComponentItem[];
  faulty: number;
}

// Kết quả 1 lần bấm "Kiểm tra thiết bị": giữ nguyên tới lần bấm sau, không tự làm mới
export interface DeviceCheck {
  readings: Map<string, TelemetryRecord>;
  alerts: Alert[];
  details: Map<string, SensorNode>;
  checkedAt: number;
}

// Thứ tự nhóm trên màn: cảm biến trước, thiết bị chấp hành sau
export const COMPONENT_KINDS: ComponentKind[] = ['temperature', 'humidity', 'light', 'nh3', 'co2', 'sound', 'speaker', 'misting', 'ventilation'];

// Cảm biến (có số đo) và thiết bị chấp hành (relay / loa)
export const SENSOR_KINDS = new Set<ComponentKind>(['temperature', 'humidity', 'light', 'nh3', 'co2', 'sound']);

// Số đo cũ hơn mốc này (so với lúc kiểm tra) thì coi là cảm biến không còn gửi; chu kỳ gửi của node vài chục giây
export const READING_FRESH_MS = 15 * 60 * 1000;

// Trường số đo trong telemetry của từng cảm biến
export const READING_FIELD: Partial<Record<ComponentKind, keyof TelemetryRecord>> = {
  temperature: 'temperature',
  humidity: 'humidity',
  light: 'light_lux',
  nh3: 'nh3_ppm',
  co2: 'co2_ppm',
  sound: 'sound_db',
};

// 5 cảm biến đi chung bus RS485 — lỗi bus thì cả 5 cùng lỗi
const RS485_KINDS = new Set<ComponentKind>(['temperature', 'humidity', 'light', 'nh3', 'co2']);

// Trạng thái tính là lỗi khi đếm (cam trên màn)
export const FAULT_STATUSES = new Set<ComponentStatus>(['fault', 'offline']);

// Bản ghi telemetry mới nhất của từng node (lịch sử backend trả mới → cũ nhưng vẫn so thời gian cho chắc)
export function latestReadingByNode(records: TelemetryRecord[]): Map<string, TelemetryRecord> {
  const latest = new Map<string, TelemetryRecord>();
  for (const record of records) {
    if (!record.node_id) continue;
    const current = latest.get(record.node_id);
    if (!current || record.timestamp > current.timestamp) latest.set(record.node_id, record);
  }
  return latest;
}

// Loại cảnh báo đang mở của từng node
function openAlertTypesByNode(alerts: Alert[]): Map<string, Set<string>> {
  const types = new Map<string, Set<string>>();
  for (const alert of alerts) {
    if (!alert.node_id || alert.status === 'RESOLVED') continue;
    const set = types.get(alert.node_id) ?? new Set<string>();
    set.add(alert.type);
    types.set(alert.node_id, set);
  }
  return types;
}

const NO_ALERTS = new Set<string>();

function componentStatus(kind: ComponentKind, node: DeviceItem, check: DeviceCheck | undefined, alertTypes: Set<string>): ComponentItem {
  const detail = check?.details.get(node.id);
  const item = { nodeId: node.id, deviceId: node.deviceId, detail };
  // Node không gửi tín hiệu thì mọi bộ phận theo trạng thái node (lấy lại lúc kiểm tra nếu có)
  const nodeStatus = detail?.status ?? node.status;
  if (nodeStatus === 'PENDING') return { ...item, status: 'pending' };
  if (nodeStatus === 'OFFLINE') return { ...item, status: 'offline' };
  if (nodeStatus === 'ERROR') return { ...item, status: 'fault' };
  if (!check) return { ...item, status: 'unchecked' };

  const relays = detail?.relay_states;
  if (kind === 'speaker') {
    if (alertTypes.has('SPEAKER_FAILURE')) return { ...item, status: 'fault' };
    return { ...item, status: relays?.speaker && detail?.audio?.playing ? 'on' : 'off' };
  }
  if (kind === 'misting') {
    if (alertTypes.has('PUMP_DRY')) return { ...item, status: 'fault' };
    return { ...item, status: relays?.misting ? 'on' : 'off' };
  }
  if (kind === 'ventilation') return { ...item, status: relays?.ventilation ? 'on' : 'off' };

  if (RS485_KINDS.has(kind) && alertTypes.has('RS485_BUS_FAILURE')) return { ...item, status: 'fault' };
  const reading = check.readings.get(node.id);
  if (!reading) return { ...item, status: 'noData' };
  const field = READING_FIELD[kind];
  const raw = field ? reading[field] : undefined;
  const value = typeof raw === 'number' ? raw : undefined;
  const isFresh = check.checkedAt - new Date(reading.timestamp).getTime() <= READING_FRESH_MS;
  // Số đo đã cũ: vẫn hiện số cuối cùng kèm giờ đo
  if (!isFresh) return { ...item, status: 'stale', value, readingAt: reading.timestamp };
  // Node vẫn gửi số đo nhưng thiếu riêng cảm biến này = cảm biến không phản hồi
  if (value === undefined) return { ...item, status: 'fault', readingAt: reading.timestamp };
  return { ...item, status: 'ok', value, readingAt: reading.timestamp };
}

// Bộ phận của các node trong 1 Zone, gom theo loại (VD 10 loa ru thành 1 nhóm "Loa ru"); chưa kiểm tra thì chỉ biết trạng thái node; O(node × loại)
export function buildZoneComponents(nodes: DeviceItem[], check?: DeviceCheck): ComponentGroup[] {
  const sensorNodes = nodes.filter(node => node.type === 'sensor');
  if (sensorNodes.length === 0) return [];
  const alertTypes = openAlertTypesByNode(check?.alerts ?? []);
  return COMPONENT_KINDS.map(kind => {
    const items = sensorNodes.map(node => componentStatus(kind, node, check, alertTypes.get(node.id) ?? NO_ALERTS));
    return { kind, items, faulty: items.filter(item => FAULT_STATUSES.has(item.status)).length };
  });
}

// Tóm tắt 1 nhóm cùng loại cho hàng tiêu đề: đang chạy (có số / bật) · tắt · lỗi (kể cả mất kết nối) · chưa có số mới · chưa kiểm tra
export interface GroupSummary {
  running: number;
  off: number;
  faulty: number;
  waiting: number;
  unchecked: number;
}

export function summarizeGroup(items: ComponentItem[]): GroupSummary {
  const summary: GroupSummary = { running: 0, off: 0, faulty: 0, waiting: 0, unchecked: 0 };
  for (const item of items) {
    if (item.status === 'ok' || item.status === 'on') summary.running += 1;
    else if (item.status === 'off') summary.off += 1;
    else if (FAULT_STATUSES.has(item.status)) summary.faulty += 1;
    else if (item.status === 'unchecked') summary.unchecked += 1;
    else summary.waiting += 1;
  }
  return summary;
}
