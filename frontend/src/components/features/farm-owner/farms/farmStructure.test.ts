import { describe, expect, it } from 'vitest'
import { buildFarmStructure, detectBreaches, isNameTaken, mergeMetrics, wifiQuality, type StructureInput, type ZoneMetrics } from '@/components/features/farm-owner/farms/farmStructure'
import { translate } from '@/lib/i18n'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { Alert, CameraNode, Farm, HarvestBatch, House, SensorNode, Thresholds, Zone } from '@/types'

const T: Thresholds = { temp_min: 26, temp_max: 32, humidity_min: 80, humidity_max: 90, light_max: 0.2, nh3_max: 25, co2_max: 1500 }
const farm = { _id: 'f1', name: 'Farm 1', address: 'A', members: [] } as unknown as Farm
const house = { _id: 'h1', farm_id: 'f1', name: 'Nhà 1', floors: 2 } as House
const zoneA = { _id: 'zA', house_id: 'h1', name: 'Zone A', floor: 2, thresholds: T } as Zone
const zoneB = { _id: 'zB', house_id: 'h1', name: 'Zone B', floor: 1, thresholds: T } as Zone
const sensor = (id: string, zone: string, status: SensorNode['status']) => ({ _id: id, device_id: id, zone_id: zone, status, registered_at: '2026-01-01' }) as SensorNode
const camera = { _id: 'c1', device_id: 'c1', zone_id: 'zA', status: 'ONLINE', registered_at: '2026-01-01' } as CameraNode
const batch = (id: string, zone: string, date: string, grams: number, nests: number) =>
  ({ _id: id, zone_id: zone, harvest_date: date, weight_grams: grams, nest_count: nests }) as HarvestBatch

function input(over: Partial<StructureInput> = {}): StructureInput {
  return {
    farms: [farm],
    housesByFarm: new Map([['f1', [house]]]),
    zonesByHouse: new Map([['h1', [zoneA, zoneB]]]),
    sensors: [sensor('s1', 'zA', 'ONLINE'), sensor('s2', 'zB', 'OFFLINE')],
    cameras: [camera],
    alerts: [],
    harvests: [],
    metricsByZone: new Map(),
    now: new Date('2026-10-10T05:00:00Z'),
    ...over,
  }
}

describe('detectBreaches', () => {
  it('chỉ báo chỉ số vượt/dưới ngưỡng, bỏ qua chỉ số thiếu', () => {
    const m: ZoneMetrics = { temperature: 34, humidity: 70, nh3: 27, co2: 1000 }
    const b = detectBreaches(m, T)
    expect(b.map(item => [item.metric, item.direction])).toEqual([['temperature', 'high'], ['humidity', 'low'], ['nh3', 'high']])
    expect(detectBreaches(undefined, T)).toEqual([])
  })
})

describe('buildFarmStructure', () => {
  it('đếm thiết bị online/offline theo zone và nhà; camera gắn nhà, không vào Zone (SRS v2.1.8)', () => {
    const s = buildFarmStructure(input())
    expect(s.totals.counts).toEqual({ total: 3, online: 2, offline: 1 })
    expect(s.zoneById.get('zA')?.counts.total).toBe(1)
    expect(s.houseById.get('h1')?.counts.total).toBe(3)
    expect(s.houseById.get('h1')?.cameraDevices.map(cameraDevice => cameraDevice.id)).toEqual(['c1'])
    expect(s.houseById.get('h1')?.zones).toHaveLength(2)
  })

  it('camera chỉ có house_id và cảnh báo của cả nhà vào đúng nhà', () => {
    const houseCamera = { _id: 'c2', device_id: 'c2', house_id: 'h1', status: 'OFFLINE', registered_at: '2026-01-01' } as CameraNode
    const houseAlert = { _id: 'a1', farm_id: 'f1', house_id: 'h1', type: 'EDGE_AI_DEGRADED', severity: 'HIGH', status: 'ACTIVE', created_at: '2026-10-10T00:00:00Z' } as Alert
    const s = buildFarmStructure(input({ sensors: [sensor('s1', 'zA', 'ONLINE')], cameras: [houseCamera], alerts: [houseAlert] }))
    const node = s.houseById.get('h1')
    expect(node?.counts).toEqual({ total: 2, online: 1, offline: 1 })
    expect(node?.cameras).toBe(1)
    expect(node?.alerts.map(alert => alert._id)).toEqual(['a1'])
    expect(node?.health).toBe('ALERT')
  })

  it('nhà "Cảnh báo" khi 1 zone vượt ngưỡng, kèm banner đầu tiên; đếm cảm biến/camera của nhà', () => {
    const s = buildFarmStructure(input({ metricsByZone: new Map([['zA', { temperature: 30, humidity: 85, nh3: 27 }]]) }))
    const h = s.houseById.get('h1')!
    expect(h.health).toBe('ALERT')
    expect(h.headline?.breach?.metric).toBe('nh3')
    expect(h.sensors + h.cameras).toBe(h.counts.total)
    expect(s.zoneById.get('zA')?.health).toBe('ALERT')
    expect(s.zoneById.get('zB')?.health).toBe('ALERT') // zone B có 1 cảm biến OFFLINE
  })

  it('nhà chưa có thiết bị là EMPTY, có thiết bị và không cảnh báo là NORMAL', () => {
    expect(buildFarmStructure(input({ sensors: [], cameras: [] })).houseById.get('h1')?.health).toBe('EMPTY')
    expect(buildFarmStructure(input({ sensors: [sensor('s1', 'zA', 'ONLINE')] })).houseById.get('h1')?.health).toBe('NORMAL')
    // thiết bị mất kết nối cũng là sự cố, dù chưa có cảnh báo
    const offline = buildFarmStructure(input()).houseById.get('h1')
    expect(offline?.health).toBe('ALERT')
    expect(offline?.headline?.offlineDevices).toBe(1)
  })

  it('cảnh báo ACTIVE gán đúng zone và chia mức cao/trung bình/thấp', () => {
    const alerts = [
      { _id: 'a1', zone_id: 'zA', severity: 'HIGH' }, { _id: 'a2', zone_id: 'zA', severity: 'MEDIUM' },
      { _id: 'a3', zone_id: 'zB', severity: 'MEDIUM' }, { _id: 'a4', severity: 'LOW' },
    ] as Alert[]
    const s = buildFarmStructure(input({ alerts }))
    expect(s.totals.alerts).toEqual({ total: 4, high: 1, medium: 2, low: 1 })
    expect(s.zoneById.get('zA')?.alerts).toHaveLength(2)
    expect(s.houseById.get('h1')?.alerts).toHaveLength(3)
  })

  it('sản lượng chỉ tính tháng hiện tại theo giờ VN, giữ 3 đợt gần nhất mới → cũ', () => {
    const harvests = [
      batch('b5', 'zA', '2026-10-09T00:00:00Z', 2000, 100),
      batch('b4', 'zA', '2026-10-01T00:00:00Z', 1000, 50),
      batch('b3', 'zB', '2026-09-30T20:00:00Z', 500, 20), // 03:00 ngày 1/10 giờ VN → vẫn thuộc tháng 10
      batch('b2', 'zB', '2026-09-20T00:00:00Z', 700, 30),
      batch('b1', 'zA', '2026-08-01T00:00:00Z', 900, 40),
    ]
    const s = buildFarmStructure(input({ harvests }))
    const h = s.houseById.get('h1')!
    expect(h.monthKg).toBeCloseTo(3.5)
    expect(h.monthNests).toBe(170)
    expect(h.recent.map(batch => batch._id)).toEqual(['b5', 'b4', 'b3'])
    expect(s.totals.monthBatches).toBe(3)
    expect(s.totals.monthLastBatchAt).toBe('2026-10-09T00:00:00Z')
  })

  it('1 lần thu nhiều loại yến (cùng zone + ngày) đếm là 1 đợt, cộng gộp kg và số tổ', () => {
    const harvests = [
      { ...batch('b1', 'zA', '2026-10-09T00:00:00Z', 2000, 100), nest_type: 'RAW' },
      { ...batch('b2', 'zA', '2026-10-09T00:00:00Z', 500, 20), nest_type: 'PREMIUM' },
    ] as HarvestBatch[]
    const s = buildFarmStructure(input({ harvests }))
    const h = s.houseById.get('h1')!
    expect(s.totals.monthBatches).toBe(1)
    expect(h.monthKg).toBeCloseTo(2.5)
    expect(h.recent).toHaveLength(1)
    expect(h.recent[0].nest_count).toBe(120)
  })

  it('dựng đúng cây với dữ liệu lớn', () => {
    const zones = Array.from({ length: 2000 }, (_, i) => ({ ...zoneA, _id: `z${i}` }))
    const sensors = zones.map((zone, i) => sensor(`s${i}`, zone._id, 'ONLINE'))
    const s = buildFarmStructure(input({ zonesByHouse: new Map([['h1', zones]]), sensors }))
    expect(s.zones).toHaveLength(2000)
    expect(s.totals.counts.total).toBe(2000)
  })
})

describe('helpers', () => {
  it('mergeMetrics ưu tiên realtime, rơi về trung bình 1h', () => {
    expect(mergeMetrics({ temperature: 31 }, { temperature: 29, humidity: 85 })).toEqual({
      temperature: 31, humidity: 85, light: undefined, nh3: undefined, co2: undefined, sound: undefined,
    })
    expect(mergeMetrics(undefined, { humidity: 85 })).toEqual({ humidity: 85 })
  })

  it('wifiQuality theo RSSI', () => {
    expect([-52, -58, -70, -80, undefined].map(wifiQuality)).toEqual(['excellent', 'good', 'fair', 'weak', undefined])
  })

  it('từ điển VI/EN nội suy tham số', () => {
    expect(translate(farmDict, 'vi', 'kpi.alertSplit', { high: 1, medium: 2, low: 0 })).toBe('1 cao · 2 trung bình · 0 thấp')
    expect(translate(farmDict, 'en', 'kpi.alertSplit', { high: 1, medium: 2, low: 0 })).toBe('1 high · 2 medium · 0 low')
  })
})

describe('isNameTaken', () => {
  it('so trùng không phân biệt hoa thường, khoảng trắng thừa', () => {
    expect(isNameTaken('  nhà   CHÍNH ', ['Nhà chính', 'Nhà phụ'])).toBe(true)
    expect(isNameTaken('Nhà sau', ['Nhà chính', 'Nhà phụ'])).toBe(false)
    expect(isNameTaken('', ['Nhà chính'])).toBe(false)
  })

  it('đổi tên giữ nguyên tên cũ thì không tính là trùng', () => {
    expect(isNameTaken('Nhà chính', ['Nhà chính', 'Nhà phụ'], 'Nhà chính')).toBe(false)
    expect(isNameTaken('Nhà phụ', ['Nhà chính', 'Nhà phụ'], 'Nhà chính')).toBe(true)
  })
})
