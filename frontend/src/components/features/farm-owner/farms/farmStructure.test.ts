import { describe, expect, it } from 'vitest'
import { buildFarmStructure, detectBreaches, mergeMetrics, wifiQuality, type StructureInput, type ZoneMetrics } from '@/components/features/farm-owner/farms/farmStructure'
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
    expect(b.map(x => [x.metric, x.direction])).toEqual([['temperature', 'high'], ['humidity', 'low'], ['nh3', 'high']])
    expect(detectBreaches(undefined, T)).toEqual([])
  })
})

describe('buildFarmStructure', () => {
  it('đếm thiết bị online/offline theo zone và nhà (camera tính chung)', () => {
    const s = buildFarmStructure(input())
    expect(s.totals.counts).toEqual({ total: 3, online: 2, offline: 1 })
    expect(s.zoneById.get('zA')?.counts.total).toBe(2)
    expect(s.houseById.get('h1')?.zones).toHaveLength(2)
  })

  it('nhà "Cảnh báo" khi 1 zone vượt ngưỡng, kèm banner đầu tiên; đếm cảm biến/camera của nhà', () => {
    const s = buildFarmStructure(input({ metricsByZone: new Map([['zA', { temperature: 30, humidity: 85, nh3: 27 }]]) }))
    const h = s.houseById.get('h1')!
    expect(h.health).toBe('ALERT')
    expect(h.headline?.breach?.metric).toBe('nh3')
    expect(h.sensors + h.cameras).toBe(h.counts.total)
    expect(s.zoneById.get('zB')?.health).toBe('NORMAL')
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
    expect(h.recent.map(b => b._id)).toEqual(['b5', 'b4', 'b3'])
    expect(s.totals.monthBatches).toBe(3)
    expect(s.totals.monthLastBatchAt).toBe('2026-10-09T00:00:00Z')
  })

  it('đủ nhanh với dữ liệu lớn (mỗi tập chỉ duyệt 1 lần)', () => {
    const zones = Array.from({ length: 2000 }, (_, i) => ({ ...zoneA, _id: `z${i}` }))
    const sensors = zones.map((z, i) => sensor(`s${i}`, z._id, 'ONLINE'))
    const t0 = performance.now()
    const s = buildFarmStructure(input({ zonesByHouse: new Map([['h1', zones]]), sensors }))
    expect(s.totals.counts.total).toBe(2000)
    expect(performance.now() - t0).toBeLessThan(200)
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
