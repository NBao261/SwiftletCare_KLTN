import type { BirdCountDailyRecord } from '@/apis/farm-owner/analytics.api'
import type { Alert, AlertSeverity, AlertStatus, ControlMode, ControlOutput, DeviceStatus, House, RelayStates, Thresholds, TicketPriority, Zone, ZoneThresholdHistoryEntry } from '@/types'
import { SEVERITY_TO_LEVEL } from '@/constants/severity'

const DAY_MS = 86_400_000

export const LIVE_MAX_AGE_MS = 20_000

// 6 chỉ số cảm biến môi trường
export interface EnvReadings {
  temperature?: number
  humidity?: number
  light_lux?: number
  nh3_ppm?: number
  co2_ppm?: number
}

export interface Anomalies {
  tooCold: boolean
  tooHot: boolean
  temperature: boolean
  humidity: boolean
  light: boolean
  nh3: boolean
  co2: boolean
}

export function getAnomalies(data: EnvReadings, limits: Thresholds): Anomalies {
  const { temperature, humidity, light_lux, nh3_ppm, co2_ppm } = data
  const tooCold = temperature !== undefined && temperature < limits.temp_min
  const tooHot = temperature !== undefined && temperature > limits.temp_max
  return {
    tooCold,
    tooHot,
    temperature: tooCold || tooHot,
    humidity: humidity !== undefined && (humidity < limits.humidity_min || humidity > limits.humidity_max),
    light: light_lux !== undefined && light_lux > limits.light_max,
    nh3: nh3_ppm !== undefined && nh3_ppm > limits.nh3_max,
    co2: co2_ppm !== undefined && co2_ppm > limits.co2_max,
  }
}

// Trạng thái thiết bị tính là hư: lỗi, suy giảm hoặc mất kết nối (PENDING là chưa kích hoạt, không tính)
const FAULT_DEVICE_STATUSES = new Set<DeviceStatus>(['ERROR', 'DEGRADED', 'OFFLINE'])

export function isFaultDeviceStatus(status: DeviceStatus): boolean {
  return FAULT_DEVICE_STATUSES.has(status)
}

export interface ZoneIssueInput {
  readings: EnvReadings
  thresholds?: Thresholds
  // Có ít nhất 1 thiết bị ONLINE — chỉ khi đó số đo mới dùng để xét vượt ngưỡng (cùng luật ô cảm biến)
  isOnline: boolean
  hasFaultDevice: boolean
}

// Zone cần chú ý: có thiết bị hư, hoặc thiết bị đang chạy mà 1 chỉ số vượt ngưỡng của chính Zone đó
export function zoneHasIssue({ readings, thresholds, isOnline, hasFaultDevice }: ZoneIssueInput): boolean {
  if (hasFaultDevice) return true
  if (!isOnline || !thresholds) return false
  const anomalies = getAnomalies(readings, thresholds)
  return anomalies.temperature || anomalies.humidity || anomalies.light || anomalies.nh3 || anomalies.co2
}

// Trạng thái các nhà yến của farm
export type StabilityStatus = 'FAULT' | 'STABLE' | 'EMPTY'

export type StabilityDeviceType = 'sensor' | 'camera'

export interface HouseStability {
  houseId: string
  name: string
  status: StabilityStatus
  faultyDevices: number
  faultZoneName?: string
  faultDeviceType?: StabilityDeviceType
}

export interface StabilitySummary {
  faultHouses: HouseStability[]
  stableCount: number
  emptyCount: number
  hasDevices: boolean
}

interface DeviceRef {
  // Node cảm biến theo Zone; camera theo nhà (SRS v2.1.8)
  zone_id?: string
  house_id?: string
  status: DeviceStatus
  type: StabilityDeviceType
}

interface HouseStats {
  total: number
  faulty: number
  faultZoneName?: string
  faultDeviceType?: StabilityDeviceType
}

const FAULT_STATUSES: DeviceStatus[] = ['OFFLINE', 'ERROR', 'DEGRADED']
const STATUS_ORDER: Record<StabilityStatus, number> = { FAULT: 0, STABLE: 1, EMPTY: 2 }

export function buildHouseStability(houses: House[], zones: Zone[], devices: DeviceRef[]): HouseStability[] {
  const zoneById = new Map(zones.map(zone => [zone._id, zone]))
  const statsByHouse = new Map<string, HouseStats>()

  devices.forEach(device => {
    const zone = device.zone_id ? zoneById.get(device.zone_id) : undefined
    const houseId = device.house_id ?? zone?.house_id
    if (!houseId) return
    const stats = statsByHouse.get(houseId) ?? { total: 0, faulty: 0 }
    stats.total += 1
    if (FAULT_STATUSES.includes(device.status)) {
      stats.faulty += 1
      if (zone) stats.faultZoneName ??= zone.name
      stats.faultDeviceType ??= device.type
    }
    statsByHouse.set(houseId, stats)
  })

  return houses
    .map((house): HouseStability => {
      const stats = statsByHouse.get(house._id) ?? { total: 0, faulty: 0 }
      const status: StabilityStatus = stats.total === 0 ? 'EMPTY' : stats.faulty > 0 ? 'FAULT' : 'STABLE'
      return {
        houseId: house._id,
        name: house.name,
        status,
        faultyDevices: stats.faulty,
        faultZoneName: stats.faultZoneName,
        faultDeviceType: stats.faultDeviceType,
      }
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.faultyDevices - a.faultyDevices || a.name.localeCompare(b.name))
}

export function summarizeStability(items: HouseStability[]): StabilitySummary {
  const faultHouses = items.filter(item => item.status === 'FAULT')
  const stableCount = items.filter(item => item.status === 'STABLE').length
  const emptyCount = items.filter(item => item.status === 'EMPTY').length
  return { faultHouses, stableCount, emptyCount, hasDevices: faultHouses.length + stableCount > 0 }
}

// Chart thống kê chim
export function mergeBirdCountRecords(lists: BirdCountDailyRecord[][]): BirdCountDailyRecord[] {
  const byDate = new Map<string, { exit: number; entry: number; rates: number[] }>()

  lists.flat().forEach(record => {
    const day = byDate.get(record.date) ?? { exit: 0, entry: 0, rates: [] }
    day.exit += record.morning_exit
    day.entry += record.evening_entry
    if (record.return_rate !== null) day.rates.push(record.return_rate)
    byDate.set(record.date, day)
  })

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => ({
      date,
      morning_exit: day.exit,
      evening_entry: day.entry,
      return_rate: day.rates.length > 0 ? day.rates.reduce((sum, rate) => sum + rate, 0) / day.rates.length : null,
    }))
}

export interface BirdCountSummary {
  current: BirdCountDailyRecord[]
  total: number
  deltaPercent?: number
  avgReturnRate?: number
}

function sumEntries(records: BirdCountDailyRecord[]): number {
  return records.reduce((sum, record) => sum + record.evening_entry, 0)
}

function toDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

export function summarizeBirdCount(records: BirdCountDailyRecord[], days: number, now = Date.now()): BirdCountSummary {
  const currentFrom = toDay(now - days * DAY_MS)
  const previousFrom = toDay(now - 2 * days * DAY_MS)
  const current = records.filter(record => record.date > currentFrom)
  const previous = records.filter(record => record.date > previousFrom && record.date <= currentFrom)

  const total = sumEntries(current)
  const previousTotal = sumEntries(previous)
  const deltaPercent = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : undefined

  const rates = current.flatMap(record => (record.return_rate === null ? [] : [record.return_rate]))
  const avgReturnRate = rates.length > 0 ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : undefined

  return { current, total, deltaPercent, avgReturnRate }
}

// Trung bình số đo các Zone của nhà yến
export interface EnvAverage {
  temperature?: number
  humidity?: number
  light_lux?: number
  nh3_ppm?: number
  co2_ppm?: number
  sound_db?: number
}

const ENV_KEYS: Array<keyof EnvAverage> = ['temperature', 'humidity', 'light_lux', 'nh3_ppm', 'co2_ppm', 'sound_db']

export function averageReadings(list: EnvAverage[]): EnvAverage {
  const result: EnvAverage = {}

  ENV_KEYS.forEach(key => {
    const values = list.flatMap(item => {
      const value = item[key]
      return value === undefined ? [] : [value]
    })
    if (values.length > 0) result[key] = values.reduce((sum, value) => sum + value, 0) / values.length
  })

  return result
}

// Thứ tự nhà yến trong ô chọn, nhà ghim lên đầu
export function sortPinnedFirst<T extends { _id: string }>(houses: T[], pinned: Set<string>): T[] {
  return [...houses.filter(house => pinned.has(house._id)), ...houses.filter(house => !pinned.has(house._id))]
}

// Thanh SCADA: đồng bộ, chế độ và relay của nhà yến
export function latestTimestamp(values: Array<string | undefined>): string | undefined {
  const valid = values.flatMap(value => (value ? [value] : []))
  if (valid.length === 0) return undefined
  return valid.reduce((latest, value) => (new Date(value).getTime() > new Date(latest).getTime() ? value : latest))
}

interface NodeRef {
  control_mode: ControlMode
  override_expiry?: string
  relay_states: RelayStates
}

// Relay hiển thị trên Dashboard: sưởi tuỳ chọn vì backend SRS v2 đã bỏ relay heating (ENV-FR-012)
export type DashboardRelayStates = Omit<RelayStates, 'heating'> & { heating?: boolean }

export interface NodesSummary {
  controlMode?: ControlMode
  overrideExpiry?: string
  relayStates?: DashboardRelayStates
}

export function summarizeNodes(nodes: NodeRef[]): NodesSummary {
  if (nodes.length === 0) return {}
  const manualNodes = nodes.filter(node => node.control_mode === 'MANUAL')

  return {
    controlMode: manualNodes.length > 0 ? 'MANUAL' : 'AUTO',
    overrideExpiry: latestTimestamp(manualNodes.map(node => node.override_expiry)),
    relayStates: {
      misting: nodes.some(node => node.relay_states.misting),
      speaker: nodes.some(node => node.relay_states.speaker),
      ventilation: nodes.some(node => node.relay_states.ventilation),
      // Sưởi chỉ có khi còn node gửi khoá heating (dữ liệu cũ); không có thì để trống thay vì báo TẮT
      heating: nodes.some(node => node.relay_states.heating !== undefined) ? nodes.some(node => node.relay_states.heating) : undefined,
    },
  }
}

// 3 relay bắt buộc của SRS v2 — sưởi đã bỏ nên không đòi khoá heating trong telemetry socket
const RELAY_KEYS: Array<keyof RelayStates> = ['misting', 'speaker', 'ventilation']

interface LiveControl {
  relayStates?: Partial<RelayStates>
  controlOutput?: ControlOutput
}

// Thay relay của node bằng bản socket mới nhất của zone (khi đủ 3 relay); chế độ AUTO/MANUAL giữ REST vì telemetry luôn gửi 'AUTO'
export function withLiveRelays<T extends NodeRef & { zone_id: string }>(nodes: T[], live: Map<string, LiveControl>): T[] {
  return nodes.map(node => {
    const states = live.get(node.zone_id)?.relayStates
    if (!states || !RELAY_KEYS.every(relay => typeof states[relay] === 'boolean')) return node
    return { ...node, relay_states: states as RelayStates }
  })
}

// % công suất logic mờ (phun sương/quạt) trung bình các zone đang có telemetry live
export function averageControlOutput(zoneIds: string[], live: Map<string, LiveControl>): ControlOutput | undefined {
  const outputs = zoneIds.flatMap(zoneId => {
    const output = live.get(zoneId)?.controlOutput
    return output ? [output] : []
  })
  if (outputs.length === 0) return undefined
  return {
    misting: Math.round(outputs.reduce((sum, output) => sum + output.misting, 0) / outputs.length),
    ventilation: Math.round(outputs.reduce((sum, output) => sum + output.ventilation, 0) / outputs.length),
  }
}

// Bảng nhật ký cảnh báo
export type SeverityGroup = TicketPriority

// Nhóm lọc theo 3 cấp chung (constants/severity.ts)
export function getSeverityGroup(severity: AlertSeverity): SeverityGroup {
  return SEVERITY_TO_LEVEL[severity]
}

export const STATUS_BADGE_CLASS: Record<AlertStatus, string> = {
  ACTIVE: 'bg-infoBlue/10 text-infoBlue',
  ACKNOWLEDGED: 'bg-accent-600 text-charcoal',
  RESOLVED: 'bg-warmGray/15 text-warmGray',
}

export type SensorKind = 'env' | 'temperature' | 'humidity' | 'light' | 'nh3' | 'co2' | 'camera'

const SENSOR_KIND_BY_METRIC: Record<string, SensorKind> = {
  temperature: 'temperature',
  humidity: 'humidity',
  light_lux: 'light',
  nh3_ppm: 'nh3',
  co2_ppm: 'co2',
}

const METRIC_UNIT: Record<string, string> = {
  temperature: '°C',
  humidity: '%',
  light_lux: 'lux',
  nh3_ppm: 'ppm',
  co2_ppm: 'ppm',
}

interface Breach {
  metric: string
  value: number
  limit: number
  direction: 'above' | 'below'
}

function isBreach(item: unknown): item is Breach {
  if (typeof item !== 'object' || item === null) return false
  const candidate = item as Record<string, unknown>
  return typeof candidate.metric === 'string' && typeof candidate.value === 'number' && typeof candidate.limit === 'number'
}

function getFirstBreach(alert: Alert): Breach | undefined {
  const breaches = alert.metadata?.breaches
  if (!Array.isArray(breaches)) return undefined
  return breaches.find(isBreach)
}

export interface AlertBreach {
  value: number
  limit: number
  unit: string
  sign: '<' | '>'
}

export interface AlertLogRow {
  id: string
  createdAt: string
  deviceName: string
  locationName: string
  sensorKind: SensorKind
  type: Alert['type']
  breach?: AlertBreach
  severity: AlertSeverity
  status: AlertStatus
  group: SeverityGroup
}

export function buildAlertRow(alert: Alert, deviceName: string, locationName: string): AlertLogRow {
  const breach = getFirstBreach(alert)

  return {
    id: alert._id,
    createdAt: alert.created_at,
    deviceName,
    locationName,
    // Cảnh báo của cả nhà (không gắn Zone) đến từ camera đếm chim
    sensorKind: !alert.zone_id && alert.house_id ? 'camera' : breach ? SENSOR_KIND_BY_METRIC[breach.metric] ?? 'env' : 'env',
    type: alert.type,
    breach: breach && {
      value: breach.value,
      limit: breach.limit,
      unit: METRIC_UNIT[breach.metric] ?? '',
      sign: breach.direction === 'below' ? '>' : '<',
    },
    severity: alert.severity,
    status: alert.status,
    group: getSeverityGroup(alert.severity),
  }
}

// Nguồn số liệu 1 nhà cho hàng KPI chế độ "Tất cả nhà yến" (HouseNode của màn Cấu trúc Farm)
interface HouseKpiSource {
  farm: { _id: string }
  health: 'ALERT' | 'NORMAL' | 'EMPTY'
  zones: unknown[]
  counts: { total: number; online: number }
  alerts: Array<{ severity: AlertSeverity }>
  monthKg: number
  monthNests: number
  monthBatches: number
}

export interface FarmKpiTotals {
  houses: number
  faultHouses: number
  zones: number
  devicesOnline: number
  devicesTotal: number
  alertsTotal: number
  alertsByLevel: Record<TicketPriority, number>
  monthKg: number
  monthNests: number
  monthBatches: number
}

// Cộng số liệu các nhà yến thuộc 1 farm (nguồn chứa nhà của mọi farm nên lọc theo farmId)
export function summarizeFarmHouses(houses: HouseKpiSource[], farmId: string): FarmKpiTotals {
  const totals: FarmKpiTotals = {
    houses: 0, faultHouses: 0, zones: 0, devicesOnline: 0, devicesTotal: 0,
    alertsTotal: 0, alertsByLevel: { P1: 0, P2: 0, P3: 0 }, monthKg: 0, monthNests: 0, monthBatches: 0,
  }
  for (const house of houses) {
    if (house.farm._id !== farmId) continue
    totals.houses += 1
    if (house.health === 'ALERT') totals.faultHouses += 1
    totals.zones += house.zones.length
    totals.devicesOnline += house.counts.online
    totals.devicesTotal += house.counts.total
    totals.monthKg += house.monthKg
    totals.monthNests += house.monthNests
    totals.monthBatches += house.monthBatches
    for (const alert of house.alerts) {
      totals.alertsByLevel[SEVERITY_TO_LEVEL[alert.severity]] += 1
      totals.alertsTotal += 1
    }
  }
  return totals
}

// Ai đặt ngưỡng hiện hành của Zone, đọc từ threshold_history (ENV-FR-009/020): chưa từng sửa hoặc lần cuối là "đặt lại mặc định" → mặc định hệ thống
export interface ThresholdSource {
  isDefault: boolean
  role?: string
  changedAt?: string
}

export function thresholdSource(history: ZoneThresholdHistoryEntry[] | undefined): ThresholdSource {
  let last: ZoneThresholdHistoryEntry | undefined
  for (const entry of history ?? []) {
    if (!last || (entry.changed_at ?? '') > (last.changed_at ?? '')) last = entry
  }
  if (!last || last.source === 'RESET_TO_DEFAULT') return { isDefault: true, changedAt: last?.changed_at }
  return { isDefault: false, role: last.changed_by_role, changedAt: last.changed_at }
}
