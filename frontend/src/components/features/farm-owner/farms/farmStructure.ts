import { vnYearMonth } from '@/lib/helpers'
import type { Alert, CameraNode, DeviceStatus, Farm, HarvestBatch, House, SensorNode, Thresholds, Zone } from '@/types'

/**
 * Tổng hợp Farm → House → Zone → Device cho màn "Cấu trúc Farm". Toàn bộ là hàm
 * thuần: mỗi tập dữ liệu (thiết bị, cảnh báo, thu hoạch, số đo) chỉ duyệt MỘT lần để
 * dựng Map theo zone_id, sau đó dựng cây bằng tra Map — tổng độ phức tạp O(n), không
 * có vòng lặp lồng nhau kiểu "với mỗi zone lọc lại toàn bộ thiết bị".
 */

export type Health = 'ALERT' | 'NORMAL'
/** Nhà thêm trạng thái EMPTY: chưa có zone/thiết bị nào để theo dõi (khác "bình thường") */
export type HouseHealth = Health | 'EMPTY'
export type MetricKey = 'temperature' | 'humidity' | 'light' | 'nh3' | 'co2'

/** Số đo của 1 zone (trung bình 1h từ /analytics/env/compare, hoặc giá trị realtime qua socket) */
export interface ZoneMetrics {
  temperature?: number; humidity?: number; light?: number; nh3?: number; co2?: number; sound?: number
  timestamp?: string
}

export interface Breach { metric: MetricKey; value: number; limit: number; direction: 'high' | 'low' }

export interface DeviceRow {
  id: string; deviceId: string; type: 'sensor' | 'camera'
  status: DeviceStatus; rssi?: number; firmware?: string
  lastHeartbeat?: string; registeredAt: string; zoneId: string
}

export interface DeviceCounts { total: number; online: number; offline: number }

export interface ZoneNode {
  zone: Zone; house: House; farm: Farm
  devices: DeviceRow[]; counts: DeviceCounts
  alerts: Alert[]; metrics?: ZoneMetrics; breaches: Breach[]; health: Health
  monthKg: number; lastBatch?: HarvestBatch
  /** 3 đợt thu gần nhất của zone, mới → cũ */
  recent: HarvestBatch[]
}

export interface HouseNode {
  house: House; farm: Farm; zones: ZoneNode[]
  counts: DeviceCounts; alerts: Alert[]; health: HouseHealth
  /** Số cảm biến / camera của cả nhà (số đo chỉ hiện ở cấp Zone) */
  sensors: number; cameras: number
  monthKg: number; monthNests: number; monthBatches: number
  /** 3 đợt thu gần nhất của cả nhà, mới → cũ */
  recent: HarvestBatch[]
  /** Sự cố nổi bật nhất để hiện banner trên card: vi phạm ngưỡng → cảnh báo thật → thiết bị mất kết nối */
  headline?: { zone: Zone; breach?: Breach; alert?: Alert; offlineDevices?: number }
}

export interface StructureTotals {
  houses: number; zones: number; counts: DeviceCounts
  alerts: { total: number; high: number; medium: number; low: number }
  monthKg: number; monthNests: number; monthBatches: number
  /** Lần thu muộn nhất TRONG tháng hiện tại (giờ VN) */
  monthLastBatchAt?: string
}

export interface FarmStructure {
  houses: HouseNode[]; zones: ZoneNode[]
  houseById: Map<string, HouseNode>; zoneById: Map<string, ZoneNode>
  totals: StructureTotals
}

export interface StructureInput {
  farms: Farm[]
  housesByFarm: Map<string, House[]>
  zonesByHouse: Map<string, Zone[]>
  sensors: SensorNode[]
  cameras: CameraNode[]
  alerts: Alert[]
  harvests: HarvestBatch[]
  metricsByZone: Map<string, ZoneMetrics>
  now?: Date
}

const RECENT_LIMIT = 3

/** Chèn vào danh sách "N mới nhất" (mới → cũ) — N rất nhỏ nên chèn thẳng, không cần sắp lại cả mảng */
function pushRecent(list: HarvestBatch[], batch: HarvestBatch): void {
  let i = list.findIndex(x => batch.harvest_date > x.harvest_date)
  if (i === -1) i = list.length
  list.splice(i, 0, batch)
  if (list.length > RECENT_LIMIT) list.pop()
}

/** So số đo với ngưỡng của zone — chỉ so chỉ số đã có giá trị */
export function detectBreaches(metrics: ZoneMetrics | undefined, t: Thresholds): Breach[] {
  if (!metrics) return []
  const out: Breach[] = []
  const { temperature: temp, humidity: hum, light, nh3, co2 } = metrics
  if (temp !== undefined) {
    if (temp > t.temp_max) out.push({ metric: 'temperature', value: temp, limit: t.temp_max, direction: 'high' })
    else if (temp < t.temp_min) out.push({ metric: 'temperature', value: temp, limit: t.temp_min, direction: 'low' })
  }
  if (hum !== undefined) {
    if (hum > t.humidity_max) out.push({ metric: 'humidity', value: hum, limit: t.humidity_max, direction: 'high' })
    else if (hum < t.humidity_min) out.push({ metric: 'humidity', value: hum, limit: t.humidity_min, direction: 'low' })
  }
  if (light !== undefined && light > t.light_max) out.push({ metric: 'light', value: light, limit: t.light_max, direction: 'high' })
  if (nh3 !== undefined && nh3 > t.nh3_max) out.push({ metric: 'nh3', value: nh3, limit: t.nh3_max, direction: 'high' })
  if (co2 !== undefined && co2 > t.co2_max) out.push({ metric: 'co2', value: co2, limit: t.co2_max, direction: 'high' })
  return out
}

function countDevices(devices: DeviceRow[]): DeviceCounts {
  let online = 0
  let offline = 0
  for (const d of devices) {
    if (d.status === 'ONLINE') online += 1
    else if (d.status === 'OFFLINE' || d.status === 'ERROR') offline += 1
  }
  return { total: devices.length, online, offline }
}

function addCounts(a: DeviceCounts, b: DeviceCounts): DeviceCounts {
  return { total: a.total + b.total, online: a.online + b.online, offline: a.offline + b.offline }
}

/** Gom các bản ghi vào Map theo khoá — dùng chung cho thiết bị/cảnh báo, mỗi tập duyệt đúng 1 lần */
function groupBy<T>(items: T[], keyOf: (item: T) => string | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    if (!key) continue
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }
  return map
}

export function buildFarmStructure(input: StructureInput): FarmStructure {
  const { farms, housesByFarm, zonesByHouse, sensors, cameras, alerts, harvests, metricsByZone } = input
  const now = vnYearMonth(input.now ?? new Date())

  // ── Mỗi tập dữ liệu: 1 lượt duyệt → Map theo zone ──────────────────────────
  const devicesByZone = new Map<string, DeviceRow[]>()
  const pushDevice = (row: DeviceRow) => {
    const list = devicesByZone.get(row.zoneId)
    if (list) list.push(row)
    else devicesByZone.set(row.zoneId, [row])
  }
  for (const s of sensors) {
    pushDevice({
      id: s._id, deviceId: s.device_id, type: 'sensor', status: s.status, rssi: s.rssi,
      firmware: s.firmware_version, lastHeartbeat: s.last_heartbeat, registeredAt: s.registered_at, zoneId: s.zone_id,
    })
  }
  for (const c of cameras) {
    pushDevice({
      id: c._id, deviceId: c.device_id, type: 'camera', status: c.status, firmware: c.model_version,
      lastHeartbeat: c.last_heartbeat, registeredAt: c.registered_at, zoneId: c.zone_id,
    })
  }

  const alertsByZone = groupBy(alerts, a => a.zone_id)

  // Thu hoạch: danh sách API đã sắp mới → cũ nên bản ghi đầu tiên gặp của zone chính là lần thu gần nhất
  const harvestByZone = new Map<string, { kg: number; nests: number; batches: number; last: HarvestBatch; recent: HarvestBatch[] }>()
  let monthKg = 0
  let monthNests = 0
  let monthBatches = 0
  let monthLastBatchAt: string | undefined
  for (const b of harvests) {
    const d = vnYearMonth(b.harvest_date)
    const inMonth = d.year === now.year && d.month === now.month
    let agg = harvestByZone.get(b.zone_id)
    if (!agg) {
      agg = { kg: 0, nests: 0, batches: 0, last: b, recent: [] }
      harvestByZone.set(b.zone_id, agg)
    }
    if (inMonth) {
      agg.kg += b.weight_grams / 1000
      agg.nests += b.nest_count
      agg.batches += 1
      monthKg += b.weight_grams / 1000
      monthNests += b.nest_count
      monthBatches += 1
      if (!monthLastBatchAt || b.harvest_date > monthLastBatchAt) monthLastBatchAt = b.harvest_date
    }
    if (b.harvest_date > agg.last.harvest_date) agg.last = b
    pushRecent(agg.recent, b)
  }

  // ── Dựng cây bằng tra Map ─────────────────────────────────────────────────
  const houses: HouseNode[] = []
  const zones: ZoneNode[] = []
  const houseById = new Map<string, HouseNode>()
  const zoneById = new Map<string, ZoneNode>()
  let totalCounts: DeviceCounts = { total: 0, online: 0, offline: 0 }

  for (const farm of farms) {
    for (const house of housesByFarm.get(farm._id) ?? []) {
      const zoneNodes: ZoneNode[] = []
      let counts: DeviceCounts = { total: 0, online: 0, offline: 0 }
      const houseAlerts: Alert[] = []
      let kg = 0
      let nests = 0
      let batches = 0
      const houseRecent: HarvestBatch[] = []
      let sensorCount = 0
      let cameraCount = 0
      let headline: HouseNode['headline']

      for (const zone of zonesByHouse.get(house._id) ?? []) {
        const devices = devicesByZone.get(zone._id) ?? []
        const zoneAlerts = alertsByZone.get(zone._id) ?? []
        const metrics = metricsByZone.get(zone._id)
        const breaches = detectBreaches(metrics, zone.thresholds)
        const harvest = harvestByZone.get(zone._id)
        const zoneCounts = countDevices(devices)
        const node: ZoneNode = {
          zone, house, farm, devices, counts: zoneCounts, alerts: zoneAlerts, metrics, breaches,
          health: breaches.length > 0 || zoneAlerts.length > 0 || zoneCounts.offline > 0 ? 'ALERT' : 'NORMAL',
          monthKg: harvest?.kg ?? 0, lastBatch: harvest?.last, recent: harvest?.recent ?? [],
        }
        zoneNodes.push(node)
        zones.push(node)
        zoneById.set(zone._id, node)

        counts = addCounts(counts, zoneCounts)
        for (const a of zoneAlerts) houseAlerts.push(a)
        kg += harvest?.kg ?? 0
        nests += harvest?.nests ?? 0
        batches += harvest?.batches ?? 0
        for (const b of harvest?.recent ?? []) pushRecent(houseRecent, b)
        for (const d of devices) {
          if (d.type === 'sensor') sensorCount += 1
          else cameraCount += 1
        }
        if (!headline && breaches.length > 0) headline = { zone, breach: breaches[0] }
        else if (!headline && zoneAlerts.length > 0) headline = { zone, alert: zoneAlerts[0] }
        else if (!headline && zoneCounts.offline > 0) headline = { zone, offlineDevices: zoneCounts.offline }
      }

      const houseNode: HouseNode = {
        house, farm, zones: zoneNodes, counts, alerts: houseAlerts,
        health: headline ? 'ALERT' : counts.total === 0 ? 'EMPTY' : 'NORMAL',
        sensors: sensorCount, cameras: cameraCount,
        monthKg: kg, monthNests: nests, monthBatches: batches, recent: houseRecent, headline,
      }
      houses.push(houseNode)
      houseById.set(house._id, houseNode)
      totalCounts = addCounts(totalCounts, counts)
    }
  }

  let high = 0
  let medium = 0
  let low = 0
  for (const a of alerts) {
    if (a.severity === 'CRITICAL' || a.severity === 'HIGH') high += 1
    else if (a.severity === 'MEDIUM') medium += 1
    else low += 1
  }

  return {
    houses, zones, houseById, zoneById,
    totals: {
      houses: houses.length, zones: zones.length, counts: totalCounts,
      alerts: { total: alerts.length, high, medium, low },
      monthKg, monthNests, monthBatches, monthLastBatchAt,
    },
  }
}

/** Mức tín hiệu Wi-Fi theo RSSI — dời sang lib/helpers để bảng Thiết bị của Admin dùng chung ngưỡng */
export { wifiQuality } from '@/lib/helpers'

/** Giá trị cuối cùng của mỗi chỉ số theo thứ tự ưu tiên: realtime → trung bình 1h */
export function mergeMetrics(live: ZoneMetrics | undefined, avg: ZoneMetrics | undefined): ZoneMetrics | undefined {
  if (!live) return avg
  if (!avg) return live
  return {
    temperature: live.temperature ?? avg.temperature,
    humidity: live.humidity ?? avg.humidity,
    light: live.light ?? avg.light,
    nh3: live.nh3 ?? avg.nh3,
    co2: live.co2 ?? avg.co2,
    sound: live.sound ?? avg.sound,
  }
}
