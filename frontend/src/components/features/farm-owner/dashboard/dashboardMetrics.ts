import type { BirdCountDailyRecord } from '@/apis/farm-owner/analytics.api'
import type { AlertSeverity, AlertStatus, ControlMode, ControlOutput, DeviceStatus, RelayStates, Thresholds, ZoneThresholdHistoryEntry } from '@/types'

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

// Trạng thái thiết bị tính là hư (chấm cảnh báo của khung lọc): mất kết nối; PENDING là chưa kết nối lần đầu, không tính là hư
const FAULT_DEVICE_STATUSES = new Set<DeviceStatus>(['OFFLINE'])

// Trạng thái nhà trên Tổng quan (A-03): "Ổn định" chỉ khi có bộ điều khiển, mọi bộ online (kể cả PENDING thì cần chú ý), số đo trong ngưỡng
export function houseLiveStatus(health: 'ALERT' | 'NORMAL' | 'EMPTY', controllerStatuses: DeviceStatus[]): 'ALERT' | 'NORMAL' | 'EMPTY' {
  if (health === 'ALERT') return 'ALERT'
  if (controllerStatuses.length === 0) return 'EMPTY'
  if (controllerStatuses.some(status => status !== 'ONLINE')) return 'ALERT'
  return health
}

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

// Relay hiển thị trên Dashboard: phun sương, loa, quạt (Report 3 §8: không có relay sưởi)
export type DashboardRelayStates = RelayStates

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
    },
  }
}

// 3 relay bắt buộc trong telemetry socket: phun sương, loa, quạt
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


export const STATUS_BADGE_CLASS: Record<AlertStatus, string> = {
  ACTIVE: 'bg-infoBlue/10 text-infoBlue',
  ACKNOWLEDGED: 'bg-accent-600 text-charcoal',
  DISMISSED: 'bg-warmGray/10 text-warmGray', // EXPERT-FR-003
  RESOLVED: 'bg-warmGray/15 text-warmGray',
}


// Nguồn số liệu 1 nhà cho hàng KPI chế độ "Tất cả nhà yến" (HouseNode của màn Cấu trúc Farm)
interface HouseKpiSource {
  farm: { _id: string }
  health: 'ALERT' | 'NORMAL' | 'EMPTY'
  counts: { total: number; online: number; offline: number }
  alerts: Array<{ severity: AlertSeverity }>
}

export interface FarmKpiTotals {
  houses: number
  faultHouses: number
  devicesOnline: number
  devicesTotal: number
  // Chỉ thiết bị OFFLINE; thiết bị chờ kết nối lần đầu (PENDING) không tính là mất kết nối
  devicesOffline: number
  alertsTotal: number
}

// Cộng số liệu các nhà của 1 farm; farmId '' = cộng mọi farm
export function summarizeFarmHouses(houses: HouseKpiSource[], farmId: string): FarmKpiTotals {
  const totals: FarmKpiTotals = {
    houses: 0, faultHouses: 0, devicesOnline: 0, devicesTotal: 0, devicesOffline: 0,
    alertsTotal: 0,
  }
  for (const house of houses) {
    if (farmId && house.farm._id !== farmId) continue
    totals.houses += 1
    if (house.health === 'ALERT') totals.faultHouses += 1
    totals.devicesOnline += house.counts.online
    totals.devicesTotal += house.counts.total
    totals.devicesOffline += house.counts.offline
    totals.alertsTotal += house.alerts.length
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
